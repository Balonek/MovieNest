const { StatusCodes } = require('http-status-codes');
const prisma = require('../lib/prisma');

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

async function authenticateToken(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Missing or invalid Authorization header' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (!user) {
      return res.status(StatusCodes.FORBIDDEN).json({ message: 'Invalid or expired token' });
    }

    req.user = { id: user.id, email: user.email, name: user.name };
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return next(error);
  }
}

async function optionalAuthenticateToken(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  try {
    const user = await prisma.user.findUnique({ where: { sessionToken: token } });
    if (user) {
      req.user = { id: user.id, email: user.email, name: user.name };
    }
  } catch (error) {
    console.error('Optional auth error:', error);
  }

  return next();
}

module.exports = { authenticateToken, optionalAuthenticateToken };
