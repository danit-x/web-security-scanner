// routes/scanRoutes.js
// Handles the security scan endpoint and scan history retrieval.
// Only authenticated users can trigger scans or view history.

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Auth middleware — sets req.userId from the verified JWT.
const authMiddleware = require("../middleware/authMiddleware");

const {
  scanValidationRules,
  handleValidationErrors,
} = require("../validators/scanValidators");

// Controller for running scans (Day 3+).
const { runScan } = require("../controllers/scanController");

// ScanResult model — needed directly here since history is a simple
// read operation with no extra business logic worth putting in a controller.
// (If this grows more complex later, move it into scanController.js.)
const ScanResult = require("../models/ScanResult");

const { scanLimiter } = require("../middleware/rateLimiter");

const asyncHandler = require("../utils/asyncHandler");

// Order matters: auth first (so we know req.userId for the rate limit key),
// then rate limit, then input validation, then the actual controller.
// @route   POST /api/scan
// @desc    Run a basic security scan against a target URL
// @access  Private
router.post(
  "/scan",
  authMiddleware,
  scanLimiter,
  scanValidationRules,
  handleValidationErrors,
  runScan,
);

// @route   GET /api/history
// @desc    Get all scan results belonging to the logged-in user,
//          most recent first
// @access  Private

// @route   GET /api/history
router.get(
  "/history",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const scans = await ScanResult.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    res.status(200).json({ success: true, count: scans.length, scans });
  }),
);

// @route   GET /api/history/:id
router.get(
  "/history/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid scan ID" });
    }

    const scan = await ScanResult.findById(id);

    if (!scan) {
      return res
        .status(404)
        .json({ success: false, message: "Scan result not found" });
    }

    if (scan.userId.toString() !== req.userId) {
      return res
        .status(404)
        .json({ success: false, message: "Scan result not found" });
    }

    res.status(200).json({ success: true, scan });
  }),
);

module.exports = router;
