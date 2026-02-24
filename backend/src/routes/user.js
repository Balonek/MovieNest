const express = require('express');
const router = express.Router();

const { authenticateToken } = require("../middleware/auth");
const { validateBody } = require("../middleware/validate");

const {
    userRegister,
    userLogin,
    showUser,
    updateUser,
    changePassword
} = require('../controllers/userController');

router.post(
    "/register",
    validateBody({
        userName: { type: "string", minLen: 3, maxLen: 512 },
        email: { type: "string", format: "email", minLen: 3, maxLen: 255 },
        password: { type: "string", minLen: 6, maxLen: 255 },
    }),
    userRegister
);

router.post(
    "/login",
    validateBody({
        email: { type: "string", format: "email", minLen: 3, maxLen: 255 },
        password: { type: "string", minLen: 6, maxLen: 255 },
    }),
    userLogin
);

router.put(
    "/change-password",
    authenticateToken,
    validateBody({
        oldPassword: { type: "string", minLen: 6, maxLen: 255 },
        newPassword: { type: "string", minLen: 6, maxLen: 255 },
    }),
    changePassword
);
router.get("/me", authenticateToken, showUser);
router.put(
    "/update",
    authenticateToken,
    validateBody({
        userName: { type: "string", optional: true, minLen: 3, maxLen: 512 },
        email: { type: "string", format: "email", optional: true, minLen: 3, maxLen: 255 },
    }),
    updateUser
);

module.exports = router;
