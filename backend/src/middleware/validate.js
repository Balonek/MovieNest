const { StatusCodes } = require('http-status-codes');

function toNumber(value) {
    if (value === null || value === undefined || value === '') return value;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
}

function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateObject(source, rules) {
    const errors = [];
    const output = { ...source };

    for (const [key, rule] of Object.entries(rules)) {
        const value = source?.[key];
        const isEmpty = value === undefined || value === null || value === '';

        if (isEmpty) {
            if (!rule.optional) {
                errors.push({ field: key, message: 'Field is required' });
            }
            continue;
        }

        if (rule.type === 'string') {
            if (typeof value !== 'string') {
                errors.push({ field: key, message: 'Must be a string' });
                continue;
            }
            if (rule.minLen !== undefined && value.length < rule.minLen) {
                errors.push({ field: key, message: `Must be at least ${rule.minLen} characters` });
                continue;
            }
            if (rule.maxLen !== undefined && value.length > rule.maxLen) {
                errors.push({ field: key, message: `Must be at most ${rule.maxLen} characters` });
                continue;
            }
            if (rule.format === 'email' && !isValidEmail(value)) {
                errors.push({ field: key, message: 'Must be a valid email' });
                continue;
            }
        }

        if (rule.type === 'number') {
            const n = typeof value === 'number' ? value : toNumber(value);
            if (!Number.isFinite(n)) {
                errors.push({ field: key, message: 'Must be a number' });
                continue;
            }
            if (rule.min !== undefined && n < rule.min) {
                errors.push({ field: key, message: `Must be >= ${rule.min}` });
                continue;
            }
            if (rule.max !== undefined && n > rule.max) {
                errors.push({ field: key, message: `Must be <= ${rule.max}` });
                continue;
            }
            output[key] = n;
        }
    }

    return { errors, output };
}

function validateBody(rules) {
    return function (req, res, next) {
        const { errors, output } = validateObject(req.body || {}, rules);

        if (errors.length) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: 'Validation failed', errors });
        }

        Object.assign(req.body, output);
        return next();
    };
}

module.exports = { validateBody };
