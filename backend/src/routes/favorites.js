const { StatusCodes } = require('http-status-codes');
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const prisma = require('../lib/prisma');

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const favs = await prisma.favorite.findMany({
            where: { userId: req.user.id },
            include: { movie: true },
            orderBy: { id: 'desc' }
        });
        const movies = favs.map(f => ({
            ...f.movie,
            status: f.status,
            score: f.score
        }));
        return res.json({ movies });
    } catch (err) {
        return next(err);
    }
});

router.post('/', authenticateToken, async (req, res, next) => {
    try {
        const movieId = Number(req.body.movieId);
        if (!Number.isInteger(movieId) || movieId <= 0) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'movieId is required and must be a positive integer' });
        const status = req.body.status || null;
        const s = Number(req.body.score);
        const score = Number.isFinite(s) ? s : null;

        const fav = await prisma.favorite.upsert({
            where: { userId_movieId: { userId: req.user.id, movieId } },
            create: { userId: req.user.id, movieId, status, score },
            update: { status, score },
            include: { movie: true }
        });
        return res.status(StatusCodes.CREATED).json({ message: 'Added to list', favorite: fav });
    } catch (err) {
        return next(err);
    }
});

router.patch('/:movieId', authenticateToken, async (req, res, next) => {
    try {
        const movieId = Number(req.params.movieId);
        if (isNaN(movieId)) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid movie ID' });
        const data = {};
        if (req.body.status !== undefined) data.status = req.body.status;
        if (req.body.score !== undefined) {
            const s = Number(req.body.score);
            data.score = Number.isFinite(s) ? s : null;
        }

        const fav = await prisma.favorite.update({
            where: { userId_movieId: { userId: req.user.id, movieId } },
            data,
            include: { movie: true }
        });
        return res.status(StatusCodes.OK).json({ message: 'Updated', favorite: fav });
    } catch (err) {
        return next(err);
    }
});

router.get('/:movieId/check', authenticateToken, async (req, res, next) => {
    try {
        const movieId = Number(req.params.movieId);
        if (isNaN(movieId)) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid movie ID' });
        const entry = await prisma.favorite.findUnique({
            where: { userId_movieId: { userId: req.user.id, movieId } }
        });
        return res.json({
            isFavorite: !!entry,
            status: entry?.status || null,
            score: entry?.score || null
        });
    } catch (err) {
        return next(err);
    }
});

router.delete('/:movieId', authenticateToken, async (req, res, next) => {
    try {
        const movieId = Number(req.params.movieId);
        if (isNaN(movieId)) return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid movie ID' });
        await prisma.favorite.delete({
            where: { userId_movieId: { userId: req.user.id, movieId } }
        });
        return res.status(StatusCodes.OK).json({ message: 'Removed from list' });
    } catch (err) {
        return next(err);
    }
});

module.exports = router;
