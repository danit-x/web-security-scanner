// routes/scanRoutes.js
// Handles the security scan endpoint. Only authenticated users can trigger a scan.

const express = require("express");
const router = express.Router();

// Import the auth middleware you built on Day 2.
// Adjust the path if your middleware file lives elsewhere.
const authMiddleware = require("../middleware/authMiddleware");

// Import the controller that actually performs the scan logic.
// Keeping the scan logic in a controller keeps this routes file clean.
const { runScan } = require("../controllers/scanController");

// @route   POST /api/scan
// @desc    Run a basic security scan against a target URL
// @access  Private (requires valid JWT / session — enforced by authMiddleware)
router.post("/scan", authMiddleware, runScan);

module.exports = router;
