// app.js
// Builds and exports the Express app WITHOUT connecting to MongoDB or
// listening on a port. server.js does those two things; tests (Jest +
// supertest) import this file directly so they can exercise the real
// middleware and routes in-process.
//
// Environment variables (CLIENT_URL, JWT_SECRET, ...) must already be loaded
// before this file is required.
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

// Security middleware imports
const { generalLimiter } = require("./middleware/rateLimiter");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Trust the first proxy hop (Render, Vercel, etc. sit in front of us).
// Without this, req.ip returns the proxy's internal IP for every request,
// which breaks IP-based rate limiting (loginLimiter, and scanLimiter's
// fallback) since every user would look identical. Must be set before
// any middleware that reads req.ip.
app.set("trust proxy", 1);

// --- Security middleware (should run before routes) ---

// Helmet sets a batch of sensible security headers by default:
// X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security,
// hides X-Powered-By, etc. Nice touch since this is itself a security project.
app.use(helmet());

// CORS: restrict to the actual frontend origin instead of allowing all
// origins (which is what happens if cors() is omitted entirely, as it was
// before this change). CLIENT_URL is env-based so dev vs production can
// point at different frontends without touching code.
const allowedOrigins = [process.env.CLIENT_URL || "http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests with no origin header (Postman, curl, server-to-server)
      // are allowed through — browsers always send an origin, so this only
      // affects non-browser tools, not real cross-origin website requests.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // 403, not a server error: the request is refused on purpose (DEF-003).
        const error = new Error("Not allowed by CORS");
        error.status = 403;
        callback(error);
      }
    },
    credentials: true, // allows cookies/Authorization headers if needed later
  }),
);

// Middleware to parse JSON bodies
app.use(express.json());

// General rate limiting across all /api routes — blunts spam/brute-force
// on top of the stricter, route-specific limiters (login, scan) applied
// inside their own route files.
app.use("/api", generalLimiter);

const authRoutes = require("./routes/authRoutes");
const scanRoutes = require("./routes/scanRoutes");

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api", scanRoutes); // mounts POST /api/scan, GET /api/history, GET /api/history/:id

app.use(notFound); // 404 handler — catches requests to routes that don't exist

// Global error handler — must be LAST. Catches everything forwarded
// via next(error), including from asyncHandler-wrapped controllers.
app.use(errorHandler);

module.exports = app;
