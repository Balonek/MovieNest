const { StatusCodes } = require('http-status-codes');
const express = require('express');
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

const { fixPoster } = require('../utils/fixPoster');

const { exec } = require('child_process');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function runPythonScript(args) {
    return new Promise((resolve, reject) => {
        const cmd = `python3 ml-service/api_cli.py ${args.join(' ')}`;
        exec(cmd, { cwd: require('path').join(__dirname, '../../..') }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Python error: ${error.message} \nSTDOUT: ${stdout} \nSTDERR: ${stderr}`);
                return reject(new Error(`Python execution failed: ${stdout || stderr || error.message}`));
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                reject(new Error("Failed to parse Python output"));
            }
        });
    });
}

router.get('/popular', async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        let cache = await prisma.recommendationCache.findUnique({
            where: { userId_type: { userId: -1, type: 'popular' } }
        });
        const now = new Date();
        const isStale = !cache || (now - new Date(cache.updatedAt) > ONE_DAY_MS);

        if (isStale) {
            const fetchAndUpdate = async () => {
                try {
                    console.log("Fetching new popular recommendations from Python...");
                    const data = await runPythonScript(['--mode', 'popular', '--top-n', '100', '--data-dir', 'ml-service/data']);
                    if (data.ok && data.items) {
                        console.log("Python returned items. First item:", data.items[0]);
                        const tmdbIds = data.items.slice(0, 50).map(i => {
                            const val = i.id || i.movieId || i.movie_id;
                            return val ? parseInt(val) : null;
                        }).filter(Boolean);
                        console.log("Extracted IDs to search in DB:", tmdbIds);
                        const movies = await prisma.movie.findMany({
                            where: { id: { in: tmdbIds }, posterUrl: { not: null } }
                        });

                        await prisma.recommendationCache.upsert({
                            where: { userId_type: { userId: -1, type: 'popular' } },
                            update: { moviesJson: JSON.stringify(movies), updatedAt: now },
                            create: { userId: -1, type: 'popular', moviesJson: JSON.stringify(movies) }
                        });
                        return movies;
                    }
                } catch (e) {
                    console.error("Failed to update popular cache", e);
                }
                return null;
            };

            if (!cache) {
                const movies = await fetchAndUpdate();
                if (!movies) return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to load recommendations" });
                return res.json({ ok: true, movies: movies.slice(0, limit).map(fixPoster) });
            } else {
                fetchAndUpdate();
            }
        }

        const movies = JSON.parse(cache.moviesJson);
        return res.json({ ok: true, movies: movies.slice(0, limit).map(fixPoster) });

    } catch (err) {
        return next(err);
    }
});

router.get('/personalized', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 10, 30);

        const favorites = await prisma.favorite.findMany({
            where: { userId },
            include: { movie: { select: { id: true, genres: true } } },
        });

        if (favorites.length === 0) {
            return res.json({ ok: true, movies: [], personalized: false });
        }

        const favMovieIds = new Set(favorites.map(f => f.movieId));

        if (favorites.length >= 15) {
            let cache = await prisma.recommendationCache.findUnique({
                where: { userId_type: { userId: userId, type: 'personalized' } }
            });
            const now = new Date();
            const isStale = !cache || (now - new Date(cache.updatedAt) > ONE_DAY_MS);

            if (isStale) {
                const fetchAndUpdate = async () => {
                    try {
                        console.log(`Fetching new personalized SVD for user ${userId}...`);
                        const data = await runPythonScript(['--mode', 'svd', '--user-id', userId, '--k', limit * 2, '--data-dir', 'ml-service/data']);

                        if (data.ok && data.items) {
                            const tmdbIds = data.items.map(i => {
                                const val = i.id || i.movieId || i.movie_id;
                                return val ? parseInt(val) : null;
                            }).filter(Boolean);

                            const movies = await prisma.movie.findMany({
                                where: {
                                    id: { in: tmdbIds, notIn: [...favMovieIds] },
                                    posterUrl: { not: null },
                                }
                            });

                            const orderedMovies = [];
                            for (const tid of tmdbIds) {
                                const m = movies.find(x => x.id === tid);
                                if (m) orderedMovies.push(m);
                            }

                            await prisma.recommendationCache.upsert({
                                where: { userId_type: { userId: userId, type: 'personalized' } },
                                update: { moviesJson: JSON.stringify(orderedMovies), updatedAt: now },
                                create: { userId: userId, type: 'personalized', moviesJson: JSON.stringify(orderedMovies) }
                            });
                            return orderedMovies;
                        }
                    } catch (e) {
                        console.error("Failed to update personalized SVD cache", e);
                    }
                    return null;
                };

                if (!cache) {
                    const movies = await fetchAndUpdate();
                    if (!movies) return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to load personalized recommendations" });
                    return res.json({ ok: true, movies: movies.slice(0, limit).map(fixPoster), personalized: true });
                } else {
                    fetchAndUpdate();
                }
            }

            const movies = JSON.parse(cache.moviesJson);
            return res.json({ ok: true, movies: movies.slice(0, limit).map(fixPoster), personalized: true });
        }

        const genreSet = new Set();
        for (const fav of favorites) {
            const genres = JSON.parse(fav.movie.genres || '[]');
            for (const g of genres) {
                if (g && g.name) genreSet.add(g.name);
            }
        }

        const genreList = [...genreSet].slice(0, 6);

        let recommended = [];
        if (genreList.length > 0) {
            const orConditions = genreList.map(g => ({ genres: { contains: g } }));
            recommended = await prisma.movie.findMany({
                where: {
                    AND: [
                        { id: { notIn: [...favMovieIds] } },
                        { voteAverage: { not: null } },
                        { posterUrl: { not: null } },
                        { OR: orConditions },
                    ],
                },
                orderBy: { voteAverage: 'desc' },
                take: limit,
            });
        }

        if (recommended.length < limit) {
            const extra = await prisma.movie.findMany({
                where: {
                    id: { notIn: [...favMovieIds, ...recommended.map(m => m.id)] },
                    voteAverage: { not: null },
                    posterUrl: { not: null },
                },
                orderBy: { voteAverage: 'desc' },
                take: limit - recommended.length,
            });
            recommended = [...recommended, ...extra];
        }

        return res.json({ ok: true, movies: recommended.map(fixPoster), personalized: true, basedOnGenres: genreList });
    } catch (err) {
        return next(err);
    }
});

router.get('/random', async (req, res, next) => {
    try {
        const top = await prisma.movie.findMany({
            where: { voteAverage: { not: null }, posterUrl: { not: null } },
            orderBy: { voteAverage: 'desc' },
            take: 500,
            select: { id: true },
        });

        if (!top.length) return res.status(StatusCodes.NOT_FOUND).json({ message: 'No movies available' });

        const idx = Math.floor(Math.random() * top.length);
        const movieId = top[idx].id;

        const movie = await prisma.movie.findUnique({ where: { id: movieId } });
        return res.json({ ok: true, movie: fixPoster(movie) });
    } catch (err) {
        return next(err);
    }
});

router.get('/genre', async (req, res, next) => {
    try {
        const genre = req.query.genre || '';
        if (!genre) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'genre is required' });
        const limit = Math.min(parseInt(req.query.limit) || 10, 30);

        const movies = await prisma.movie.findMany({
            where: {
                genres: { contains: genre },
                voteAverage: { not: null },
                posterUrl: { not: null },
            },
            orderBy: { voteAverage: 'desc' },
            take: limit,
        });

        return res.json({ ok: true, movies: movies.map(fixPoster), genre });
    } catch (err) {
        return next(err);
    }
});

router.get('/movie/:id', async (req, res, next) => {
    try {
        const movieId = parseInt(req.params.id);
        if (isNaN(movieId)) return res.status(StatusCodes.BAD_REQUEST).json({ ok: false, message: 'Invalid movie id' });
        const limit = Math.min(parseInt(req.query.limit) || 10, 20);

        const movie = await prisma.movie.findUnique({ where: { id: movieId } });
        if (!movie) return res.status(StatusCodes.NOT_FOUND).json({ ok: false, message: 'Movie not found' });

        const data = await runPythonScript([
            '--mode', 'overview',
            '--title', `"${movie.title.replace(/"/g, '')}"`,
            '--top-n', '40',
            '--data-dir', 'ml-service/data'
        ]);

        let movies = [];
        if (data.ok && data.items && data.items.length > 0) {
            const tmdbIds = data.items
                .map(i => { const v = i.id || i.movieId || i.movie_id; return v ? parseInt(v) : null; })
                .filter(Boolean)
                .filter(id => id !== movieId);

            const found = await prisma.movie.findMany({
                where: { id: { in: tmdbIds }, posterUrl: { not: null } }
            });
            movies = tmdbIds.map(id => found.find(m => m.id === id)).filter(Boolean).slice(0, limit);
        }

        return res.json({ ok: true, movies: movies.map(fixPoster) });
    } catch (e) {
        console.error('Similar movies error:', e.message);
        try {
            const movieId = parseInt(req.params.id);
            const limit = parseInt(req.query.limit) || 10;
            const movie = await prisma.movie.findUnique({ where: { id: movieId } });
            const genres = JSON.parse(movie?.genres || '[]');
            const firstGenre = genres[0]?.name;
            const fallback = await prisma.movie.findMany({
                where: { genres: firstGenre ? { contains: firstGenre } : {}, posterUrl: { not: null }, id: { not: movieId } },
                orderBy: { voteAverage: 'desc' },
                take: limit
            });
            return res.json({ ok: true, movies: fallback.map(fixPoster) });
        } catch { return next(e); }
    }
});

module.exports = router;
