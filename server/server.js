// server.js
require("dotenv").config({
  path: __dirname + "/.env",
});
const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");

// Security middleware imports
const { generalLimiter } = require("./middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

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
        callback(new Error("Not allowed by CORS"));
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
const scanRoutes = require("./routes/scanRoutes"); // new: scan endpoint routes

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api", scanRoutes); // mounts POST /api/scan, GET /api/history, GET /api/history/:id

const startServer = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not defined in the environment");
    }

    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
