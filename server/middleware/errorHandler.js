// middleware/errorHandler.js
// Global error-handling middleware. Must be registered LAST in server.js,
// after all routes. Express recognizes it as an error handler because it
// takes 4 arguments (err, req, res, next).
//
// Catches anything that reaches next(error) — from asyncHandler-wrapped
// controllers, or errors thrown synchronously in middleware — and returns
// a clean, consistent JSON error instead of an HTML stack trace or a
// server crash.

// Handles requests to routes that don't exist at all (e.g. GET /api/nonsense).
// Registered just before errorHandler, after all real routes.
const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, _next) => {
  // If a status code was already set earlier (e.g. via res.status(400)
  // before throwing), use it. Otherwise default to 500.
  let statusCode =
    res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Server error";

  // --- Translate common Mongoose/JWT error types into clean responses ---

  // Mongoose validation errors (e.g. schema constraint failed)
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }

  // Malformed MongoDB ObjectId (e.g. someone hits /api/history/not-a-real-id
  // through a route that doesn't already validate it manually)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  }

  // Duplicate key error (e.g. unique email constraint violated)
  if (err.code === 11000) {
    statusCode = 400;
    message = "Duplicate value entered for a unique field";
  }

  // JWT errors, in case any slip past authMiddleware's own handling
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authorization token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authorization token has expired";
  }

  // Log the full error server-side for debugging — never send stack
  // traces to the client, that leaks internal file paths/logic.
  console.error(`[${req.method} ${req.originalUrl}]`, err.stack || err.message);

  res.status(statusCode).json({
    success: false,
    message,
    // Only include the stack trace in the response during local development —
    // never in production, where it could leak internals to an attacker.
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
