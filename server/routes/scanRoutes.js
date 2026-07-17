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
router.get("/history", authMiddleware, async (req, res) => {
  try {
    // Only fetch scans that belong to the requesting user.
    // req.userId comes from the decoded JWT in authMiddleware — never trust
    // a userId passed in the request body/query for this kind of lookup.
    const scans = await ScanResult.find({ userId: req.userId })
      // Sort by createdAt descending (scannedAt is just a virtual alias
      // for createdAt, so we sort on the real field).
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: scans.length,
      scans,
    });
  } catch (error) {
    console.error("Get history error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching scan history" });
  }
});

// @route   GET /api/history/:id
// @desc    Get a single scan result by ID — only if it belongs to the
//          requesting user
// @access  Private
router.get("/history/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Validate that the ID is even a well-formed Mongo ObjectId before
  // querying. Without this, an invalid ID string throws a CastError
  // which we'd otherwise have to handle separately below.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid scan ID" });
  }

  try {
    const scan = await ScanResult.findById(id);

    // Case 1: no scan exists at all with this ID.
    if (!scan) {
      return res.status(404).json({ message: "Scan result not found" });
    }

    // Case 2: a scan exists, but it belongs to a different user.
    // IMPORTANT: return 404 here instead of 403. Returning 403 would
    // confirm to an attacker that a scan with this ID exists at all
    // (just not theirs) — 404 leaks no information either way.
    if (scan.userId.toString() !== req.userId) {
      return res.status(404).json({ message: "Scan result not found" });
    }

    return res.status(200).json({ scan });
  } catch (error) {
    console.error("Get single scan error:", error.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching scan result" });
  }
});

module.exports = router;
