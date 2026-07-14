// controllers/scanController.js
// Handles the logic for POST /api/scan.
// Hour 2: now fetches the actual target page using axios so we have
// real headers/HTML/status to analyze in later steps.

const axios = require("axios");

// @desc    Run a security scan against a target URL
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

    // 2. Must start with http:// or https://
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return res.status(400).json({
        message: "URL must start with http:// or https://",
      });
    }

    // 3. Stricter structural check using the built-in URL constructor
    try {
      new URL(trimmedUrl);
    } catch (err) {
      return res.status(400).json({ message: "Please provide a valid URL" });
    }

    console.log(`Scan requested by user ${req.userId} for url: ${trimmedUrl}`);

    // 4. Fetch the target page.
    let response;
    try {
      response = await axios.get(trimmedUrl, {
        // Vibe-coded sites may be slow or hang — don't let our server hang with them.
        timeout: 8000, // 8 seconds

        // Some servers block requests with no/default user-agent (like axios's
        // default "axios/1.x.x"), so we pretend to be a normal browser.
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 SecScanner/1.0",
        },

        // Don't throw on 4xx/5xx responses — we WANT to inspect error pages
        // too (e.g. a 403 might still leak headers worth checking).
        // We'll only let axios throw on network-level failures (timeout, DNS, etc.)
        validateStatus: () => true,
      });
    } catch (fetchError) {
      // Network-level failure: DNS not found, connection refused, timeout, etc.
      if (fetchError.code === "ECONNABORTED") {
        return res.status(408).json({
          message: "Target site took too long to respond (timeout)",
        });
      }

      console.error("Fetch error:", fetchError.message);
      return res.status(502).json({
        message: "Could not reach the target URL",
        detail: fetchError.message,
      });
    }

    // TEMPORARY: for now just confirm what we got back from the fetch.
    // In later steps we'll pull out response.headers, response.data (HTML),
    // response.status, and cookies to build the actual findings + grade.
    return res.status(200).json({
      message: "Target page fetched successfully (stub — no analysis yet)",
      url: trimmedUrl,
      requestedBy: req.userId,
      statusCode: response.status,
      headersReceived: Object.keys(response.headers), // just the header names for now
      htmlLength: response.data ? response.data.length : 0,
    });
  } catch (error) {
    console.error("Scan error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { runScan };
