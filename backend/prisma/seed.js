const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');

const prisma = require('../src/lib/prisma');

function csvPath(filename) {
    return path.join(__dirname, '../../ml-service', 'data', filename);
}

function posterCsvPath() {
    return path.join(__dirname, '../../ml-service', 'data', 'movies.csv');
}

async function parseCSV(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', d => results.push(d))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
}

function normalizeTitle(raw) {
    return (raw || '')
        .replace(/\s*\(\d{4}\)\s*$/, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
        .trim();
}

async function main() {
    const posterMap = new Map();
    const postersData = await parseCSV(posterCsvPath());
    console.log(`Loaded ${postersData.length} posters from movies.csv. Process mapping...`);
    for (const row of postersData) {
        const url = row.poster_url || '';
        if (!url || !url.startsWith('http')) continue;
        const key = normalizeTitle(row.movie_title || row.title);
        if (key) posterMap.set(key, url);
    }
    console.log('Posters mapped successfully!\n');

    const moviesData = await parseCSV(csvPath('tmdb_5000_movies.csv'));
    const totalMovies = moviesData.length;
    console.log(`Starting to load ${totalMovies} movies. This may take a few minutes...`);

    for (let i = 0; i < totalMovies; i++) {
        const row = moviesData[i];

        if (i % 10 === 0 || i === totalMovies - 1) {
            process.stdout.write(`\rLoading Movies: [${i + 1} / ${totalMovies}]`);
        }

        const id = parseInt(row.id || row.movie_id, 10);
        if (isNaN(id)) continue;

        const key = normalizeTitle(row.title || row.movie_title);
        const posterUrl = posterMap.get(key) || null;

        await prisma.movie.upsert({
            where: { id },
            update: {
                posterUrl,
                voteAverage: parseFloat(row.vote_average) || null,
                overview: row.overview || null,
                releaseDate: row.release_date || null,
                genres: row.genres || '[]',
            },
            create: {
                id,
                title: row.title || row.movie_title || '',
                genres: row.genres || '[]',
                overview: row.overview || null,
                releaseDate: row.release_date || null,
                voteAverage: parseFloat(row.vote_average) || null,
                posterUrl,
            },
        });
    }
    console.log('\n✅ Movies loaded successfully!\n');

    const ratingsData = await parseCSV(csvPath('ratings_small.csv'));
    const totalRatings = ratingsData.length;
    console.log(`Starting to load ${totalRatings} ratings. Almost done...`);

    let ratingsProcessed = 0;
    for (let i = 0; i < totalRatings; i++) {
        const row = ratingsData[i];
        ratingsProcessed++;

        if (ratingsProcessed % 100 === 0 || ratingsProcessed === totalRatings) {
            process.stdout.write(`\rLoading Ratings: [${ratingsProcessed} / ${totalRatings}]`);
        }

        const userId = parseInt(row.userId || row.user_id, 10);
        const movieId = parseInt(row.movieId || row.movie_id, 10);
        const rating = parseFloat(row.rating);
        const timestamp = parseInt(row.timestamp, 10) || 0;

        if (isNaN(userId) || isNaN(movieId) || isNaN(rating)) continue;

        const movieExists = await prisma.movie.findUnique({ where: { id: movieId }, select: { id: true } });
        if (!movieExists) continue;

        try {
            await prisma.rating.upsert({
                where: { userId_movieId: { userId, movieId } },
                update: { rating },
                create: { userId, movieId, rating, timestamp },
            });
        } catch { }
    }

    console.log('\n✅ Ratings loaded successfully!\n Database Seeding Complete!');
}

main()
    .then(async () => { await prisma.$disconnect(); })
    .catch(async () => {
        await prisma.$disconnect();
        process.exit(1);
    });
