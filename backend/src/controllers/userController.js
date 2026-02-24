const { StatusCodes } = require('http-status-codes');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = require('../lib/prisma');

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function userRegister(req, res) {
    try {
        const { userName, email, password } = req.body || {};
        if (!userName || !email || !password) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'userName, email and password are required' });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(StatusCodes.CONFLICT).json({ message: 'User already exists' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const token = generateSessionToken();

        const user = await prisma.user.create({
            data: { email, password: hashed, name: userName, sessionToken: token }
        });

        return res.status(StatusCodes.CREATED).json({
            token,
            user: { id: user.id, userName: user.name, email: user.email }
        });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(StatusCodes.CONFLICT).json({ message: 'Email already in use' });
        }
        console.error('Register error:', err);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
}

async function userLogin(req, res, next) {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'email and password are required' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
        }

        const token = generateSessionToken();
        await prisma.user.update({ where: { id: user.id }, data: { sessionToken: token } });

        return res.json({
            token,
            user: { id: user.id, userName: user.name, email: user.email }
        });
    } catch (err) {
        return next(err);
    }
}

async function showUser(req, res) {
    return res.json({
        user: { id: req.user.id, userName: req.user.name, email: req.user.email }
    });
}

async function updateUser(req, res, next) {
    try {
        const { userName, email } = req.body || {};
        if (!userName && !email) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Nothing to update' });
        }

        const data = {};
        if (userName) data.name = userName;
        if (email) data.email = email;

        const updated = await prisma.user.update({ where: { id: req.user.id }, data });

        return res.json({ user: { id: updated.id, userName: updated.name, email: updated.email } });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(StatusCodes.CONFLICT).json({ message: 'Email or name already in use' });
        }
        return next(err);
    }
}

async function changePassword(req, res, next) {
    try {
        const { oldPassword, newPassword } = req.body || {};
        if (!oldPassword || !newPassword) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Old password and new password are required' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        }

        const ok = await bcrypt.compare(oldPassword, user.password);
        if (!ok) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid old password' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

        return res.json({ message: 'Password updated' });
    } catch (err) {
        return next(err);
    }
}

module.exports = { userRegister, userLogin, showUser, updateUser, changePassword };
