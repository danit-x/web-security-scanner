// controllers/scanController.js
// Handles the logic for POST /api/scan.
// Currently a STUB: validates the url, then just echoes it back,
// so we can confirm validation + route + auth middleware all work
// before writing the real header/SSL/HTML scanning logic.

// @desc    Run a security scan against a target URL (stub version)
// @route   POST /api/scan
// @access  Private (authMiddleware runs before this and sets req.userId)
const runScan = async (req, res) => {
  try {
    const { url } = req.body;

    // 1. Check it's a non-empty string at all
    if (!url || typeof url !== "string" || url.trim() === "") {
      return res.status(400).json({ message: "Please provide a url to scan" });
    }

    const trimmedUrl = url.trim();

    // 2. Must start with http:// or https:// — reject ftp://, javascript:, etc.
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return res.status(400).json({
        message: "URL must start with http:// or https://",
      });
    }

    // 3. Use the built-in URL constructor as a stricter structural check.
    // This catches malformed URLs that pass the regex but aren't valid,
    // e.g. "http://" alone, or "https:// broken url".
    try {
      new URL(trimmedUrl);
    } catch (err) {
      return res.status(400).json({ message: "Please provide a valid URL" });
    }

    // req.userId was set by authMiddleware after verifying the JWT.
    console.log(`Scan requested by user ${req.userId} for url: ${trimmedUrl}`);

    // TEMPORARY: just echo the url back instead of actually scanning it.
    // Once this round-trip is confirmed working, we'll replace this
    // with real logic (axios fetch + header checks + cheerio parsing, etc.)
    return res.status(200).json({
      message: "Scan request received (stub — no real scan performed yet)",
      url: trimmedUrl,
      requestedBy: req.userId,
    });
  } catch (error) {
    console.error("Scan error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { runScan };
