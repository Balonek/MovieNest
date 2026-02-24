const { StatusCodes } = require('http-status-codes');

function errorHandler(err, req, res, next) {
    const status = err.statusCode && Number.isInteger(err.statusCode)
        ? err.statusCode
        : StatusCodes.INTERNAL_SERVER_ERROR;

    if (status >= StatusCodes.INTERNAL_SERVER_ERROR) {
        console.error(err);
    }

    if (err.code === 'P2002') {
        return res.status(StatusCodes.CONFLICT).json({
            message: 'Conflict',
            details: err.errors?.map((e) => e.message)
        });
    }

    return res.status(status).json({ message: err.message || 'Internal server error' });
}

module.exports = { errorHandler };
