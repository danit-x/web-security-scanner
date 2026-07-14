// controllers/scanController.js
// Handles the logic for POST /api/scan.
// For now this is just a STUB: it accepts a url and echoes it back,
// so we can confirm the route + auth middleware work end-to-end
// before writing the real header/SSL/HTML scanning logic.

// @desc    Run a security scan against a target URL (stub version)
// @route   POST /api/scan
// @access  Private (authMiddleware runs before this and sets req.userId)
const runScan = async (req, res) => {
  try {
    const { url } = req.body;

    // Basic validation — make sure a url was actually sent
    if (!url) {
      return res.status(400).json({ message: "Please provide a url to scan" });
    }

    // req.userId was set by authMiddleware after verifying the JWT.
    // Logging/returning it here proves the auth chain is working too.
    console.log(`Scan requested by user ${req.userId} for url: ${url}`);

    // TEMPORARY: just echo the url back instead of actually scanning it.
    // Once this round-trip is confirmed working, we'll replace this
    // with real logic (axios fetch + header checks + cheerio parsing, etc.)
    return res.status(200).json({
      message: "Scan request received (stub — no real scan performed yet)",
      url,
      requestedBy: req.userId,
    });
  } catch (error) {
    console.error("Scan error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { runScan };
