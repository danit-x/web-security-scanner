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
  // Prefer a status carried by the error itself (body-parser sets
  // err.status = 400 for malformed JSON, the CORS check sets 403). Next, a
  // status already set on the response (e.g. notFound's 404). Otherwise 500.
  // Before DEF-002/DEF-003, err.status was ignored, so client errors became 500s.
  const errStatus = Number(err.status || err.statusCode);
  let statusCode =
    errStatus >= 400 && errStatus < 600
      ? errStatus
      : res.statusCode && res.statusCode !== 200
        ? res.statusCode
        : 500;
  let message = err.message || "Server error";

  // Malformed JSON body: don't echo the parser's internal message.
  if (err.type === "entity.parse.failed") {
    message = "Malformed JSON in request body";
  }

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
    // Only include the stack trace for genuine server errors (5xx) during
    // local development — never in production, where it could leak internals
    // to an attacker, and never for client errors (4xx), where the stack only
    // points at the client's own mistake.
    ...(process.env.NODE_ENV !== "production" &&
      statusCode >= 500 && { stack: err.stack }),
  });
};

module.exports = { notFound, errorHandler };
