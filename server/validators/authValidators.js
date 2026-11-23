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
    .withMessage("Name must be 100 characters or fewer"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    // Only lower-case: the address is stored exactly as typed. normalizeEmail()
    // used to strip Gmail dots and +tags here, but login never did the same,
    // so those users could not log back in (DEF-001).
    .toLowerCase(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    // Validators check a string *copy* of the value, so a JSON number passed
    // every rule and then crashed bcrypt.hash() with a 500 (DEF-005).
    .isString()
    .withMessage("Password must be text")
    .bail()
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

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .bail()
    .isString() // bcrypt.compare() throws on non-strings (DEF-005)
    .withMessage("Password must be text"),
];

module.exports = {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
};
