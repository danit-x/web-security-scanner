// middleware/rateLimiter.js
// Rate limiters to prevent abuse of the API — especially the /api/scan
// route, which is the most expensive/abusable endpoint (it makes outbound
// HTTP requests to arbitrary target sites on our server's behalf).

const { ipKeyGenerator } = require("express-rate-limit");
const rateLimit = require("express-rate-limit");

// Limits scan requests to 10 per 15 minutes.
// Keyed by user ID when logged in (since /api/scan is behind authMiddleware
// and req.userId is always set), falling back to IP otherwise. Using the
// user ID instead of just IP prevents one user on a shared/NAT'd IP
// (e.g. university wifi) from being penalized for other users' activity.
const scanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window per key
  standardHeaders: true, // return RateLimit-* headers so clients can see remaining quota
  legacyHeaders: false, // disable deprecated X-RateLimit-* headers
  keyGenerator: (req) => req.userId || ipKeyGenerator(req.ip),
  // Consistent error shape matching the rest of the API
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many scan requests. Please try again in 15 minutes.",
    });
  },
});

// A looser, general-purpose limiter for the rest of the API (auth routes,
// history, etc.) — mainly to blunt brute-force login attempts and general
// spam rather than protect an expensive operation.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
    });
  },
});

// A stricter limiter specifically for login, to slow down brute-force
// password guessing without punishing normal browsing of the rest of the API.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip), // no req.userId yet at login time, so IP only
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again in 15 minutes.",
    });
  },
});

module.exports = { scanLimiter, generalLimiter, loginLimiter };
