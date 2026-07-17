// validators/authValidators.js
// Validation rules for auth routes, using express-validator.
// These run as middleware before the controller — if validation fails,
// we short-circuit with a consistent error shape and never touch the DB.

const { body, validationResult } = require("express-validator");

// Reusable middleware that checks for validation errors collected by the
// rules above it in the route chain. Put this AFTER the body(...) checks.
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Consistent error shape: { success: false, message, errors }
    // "errors" gives the frontend field-level detail if it wants to show it,
    // but "message" alone is enough for a simple toast/alert.
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg, // first error, human-readable
      errors: errors.array(), // full list, in case frontend wants per-field detail
    });
  }

  next();
};

// Rules for POST /api/auth/register
const registerValidationRules = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name must be under 100 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(), // lowercases + strips dots in gmail etc. — keeps lookups consistent

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/\d/)
    .withMessage("Password must contain at least one number"),
];

// Rules for POST /api/auth/login
// Deliberately lighter than register — we don't want to leak password
// policy details to someone brute-forcing logins, just confirm the fields exist.
const loginValidationRules = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address"),

  body("password").notEmpty().withMessage("Password is required"),
];

module.exports = {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
};
