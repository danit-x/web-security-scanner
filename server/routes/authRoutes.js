// authRoutes.js
const express = require("express");
const { register, login, getMe } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} = require("../validators/authValidators");

const { loginLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Mounted at /api/auth in server.js
// Validation rules run first, then handleValidationErrors checks the result,
// then (only if valid) the actual controller runs.

router.post(
  "/register",
  // registerLimiter,         Optional: rate limiter if you have one
  registerValidationRules, //Optional: validation middleware
  handleValidationErrors, // Optional: validation error handler
  register,
);

router.post(
  "/login",
  loginLimiter,
  loginValidationRules,
  handleValidationErrors,
  login,
);

router.get("/me", authMiddleware, getMe);

module.exports = router;
