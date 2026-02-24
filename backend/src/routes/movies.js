const { StatusCodes } = require('http-status-codes');
const express = require('express');
const { optionalAuthenticateToken } = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

const { fixPoster } = require('../utils/fixPoster');

router.get('/stats', optionalAuthenticateToken, async (req, res, next) => {
    try {
        const [totalMovies, totalUsers, totalFavorites, ratingAgg] = await Promise.all([
            prisma.movie.count(),
            prisma.user.count(),
            prisma.favorite.count(),
            prisma.movie.aggregate({ _avg: { voteAverage: true } }),
        ]);

        let userAvgRating = null;
        if (req.user) {
            const userAgg = await prisma.favorite.aggregate({
                _avg: { score: true },
                where: { userId: req.user.id, score: { not: null } }
            });
            if (userAgg._avg.score) {
                userAvgRating = parseFloat(userAgg._avg.score.toFixed(1));
            }
        }

        return res.json({
            totalMovies,
            totalUsers,
            totalFavorites,
            avgRating: ratingAgg._avg.voteAverage
                ? parseFloat(ratingAgg._avg.voteAverage.toFixed(1))
                : null,
            userAvgRating
        });
    } catch (err) {
        return next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const genre = req.query.genre || '';
        const sort = req.query.sort || 'popular';

        let movies, total;
        if (req.query.ids) {
            const ids = req.query.ids.split(',').map(Number).filter(Boolean);
            movies = await prisma.movie.findMany({ where: { id: { in: ids } } });
            total = movies.length;
        } else if (search) {
            movies = await prisma.movie.findMany({
                where: { title: { contains: search } },
                take: limit
            });
            total = movies.length;
        } else {
            const skip = (page - 1) * limit;
            const where = {};

            if (genre) {
                where.genres = { contains: genre };
            }

            const orderBy = sort === 'newest'
                ? { releaseDate: 'desc' }
                : { voteAverage: 'desc' };

            [movies, total] = await Promise.all([
                prisma.movie.findMany({ where, skip, take: limit, orderBy }),
                prisma.movie.count({ where }),
            ]);
        }

        movies = movies.map(fixPoster);
        return res.json({ movies, total, page, limit });
    } catch (err) {
        return next(err);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid movie ID' });

        const movie = await prisma.movie.findUnique({
            where: { id },
            include: { ratings: { take: 5, orderBy: { rating: 'desc' } } }
        });
        if (!movie) return res.status(StatusCodes.NOT_FOUND).json({ message: 'Movie not found' });
        return res.json({ movie: fixPoster(movie) });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
