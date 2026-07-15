// controllers/scanController.js
// Handles the logic for POST /api/scan.
// Hour 3: distinguishes between different failure types (DNS, connection
// refused, timeout) and captures the final URL after redirects.
const checkSecurityHeaders = require("../utils/checks/checkSecurityHeaders");
const checkSsl = require("../utils/checks/sslCheck");
const checkFileExposure = require("../utils/checks/fileExposureCheck");
const checkCookies = require("../utils/checks/cookieCheck");

const axios = require("axios");

// @desc    Run a security scan against a target URL
// @route   POST /api/scan
// @access  Private (authMiddleware runs before this and sets req.userId)
const runScan = async (req, res) => {
  try {
    const { url } = req.body;

    // --- Basic validation (from earlier steps) ---
    if (!url || typeof url !== "string" || url.trim() === "") {
      return res.status(400).json({ message: "Please provide a url to scan" });
    }

    const trimmedUrl = url.trim();

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return res.status(400).json({
        message: "URL must start with http:// or https://",
      });
    }

    try {
      new URL(trimmedUrl);
    } catch (err) {
      return res.status(400).json({ message: "Please provide a valid URL" });
    }

    console.log(`Scan requested by user ${req.userId} for url: ${trimmedUrl}`);

    // --- Fetch the target page ---
    let response;
    try {
      response = await axios.get(trimmedUrl, {
        timeout: 8000, // 8 seconds — don't let slow/hanging sites block us

        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 SecScanner/1.0",
        },

        // Don't throw on 4xx/5xx — we still want to inspect those responses.
        // Only network-level failures (DNS, timeout, connection refused)
        // will land in the catch block below.
        validateStatus: () => true,

        // axios follows redirects by default; keep it explicit for clarity.
        maxRedirects: 5,
      });
    } catch (fetchError) {
      // --- Differentiate WHY the request failed ---

      // 1. Timeout: axios sets this specific code when `timeout` is exceeded.
      if (fetchError.code === "ECONNABORTED") {
        return res.status(408).json({
          message: "Site took too long to respond.",
        });
      }

      // 2. DNS lookup failure — the hostname doesn't resolve at all.
      if (fetchError.code === "ENOTFOUND") {
        return res.status(502).json({
          message: "Site could not be reached.",
          detail: "DNS lookup failed — the domain may not exist.",
        });
      }

      // 3. Connection actively refused by the target (nothing listening on that port).
      if (fetchError.code === "ECONNREFUSED") {
        return res.status(502).json({
          message: "Site could not be reached.",
          detail: "Connection was refused by the server.",
        });
      }

      // 4. Connection reset mid-request (server dropped the connection).
      if (fetchError.code === "ECONNRESET") {
        return res.status(502).json({
          message: "Site could not be reached.",
          detail: "Connection was reset by the server.",
        });
      }

      // 5. SSL/TLS certificate problems — still "unreachable" from our
      // perspective, but worth calling out separately since it's a common
      // case for a security scanner specifically.
      if (
        fetchError.code === "CERT_HAS_EXPIRED" ||
        fetchError.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
        fetchError.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
      ) {
        return res.status(502).json({
          message: "Site could not be reached.",
          detail: `SSL/TLS certificate issue: ${fetchError.code}`,
        });
      }

      // 6. Anything else we didn't explicitly plan for — generic fallback.
      console.error(
        "Unhandled fetch error:",
        fetchError.code,
        fetchError.message,
      );
      return res.status(502).json({
        message: "Site could not be reached.",
        detail: fetchError.message,
      });
    }

    // --- Capture the final URL after any redirects ---
    // If the site redirected (e.g. http -> https, or example.com -> www.example.com),
    // axios's underlying request object tracks the final resolved URL.
    // This matters for the report: findings should reflect what was actually
    // scanned, not just what the user typed in.
    const finalUrl =
      response.request?.res?.responseUrl || // Node http adapter (most common)
      response.request?._currentUrl || // fallback for some axios versions
      trimmedUrl; // fallback: no redirect info available

    if (finalUrl !== trimmedUrl) {
      console.log(`Redirected: ${trimmedUrl} -> ${finalUrl}`);
    }

    // --- Handle non-2xx responses ---
    // Decision: we still return the status code and continue reporting,
    // rather than hard-failing. A 404 or 500 page still has response headers
    // worth checking (missing CSP, no HSTS, etc.), so partial scanning is
    // more useful than refusing outright. We just flag it clearly for the user.
    const isSuccess = response.status >= 200 && response.status < 300;

    // --- Run the security headers check ---
    const headerFindings = checkSecurityHeaders(response.headers, finalUrl);

    // Separate from the axios fetch above — this opens its own raw TLS
    // --- Run the SSL/TLS check ---
    // --- Run the SSL/TLS check ---
    // Wrapped in its own try/catch as a safety net: checkSsl() already
    // handles its own connection failures internally and returns a finding
    // for them, but this guards against any unexpected/unhandled error
    // inside the check itself so it can NEVER crash the whole scan request.
    let sslFindings = [];
    try {
      sslFindings = await checkSsl(finalUrl);
    } catch (err) {
      console.error("SSL check threw unexpectedly:", err.message);
      sslFindings = [
        {
          category: "SSL Check Failed",
          severity: "LOW",
          description:
            "The SSL/TLS check could not complete due to an unexpected error.",
          recommendation:
            "Manually verify the site's certificate in a browser.",
        },
      ];
    }

    // --- Run the exposed sensitive files check ---
    // Uses just the origin (protocol + host), not the full finalUrl with any
    // path/query — we're probing baseUrl + "/.env" etc, not finalUrl + that.
    let fileExposureFindings = [];
    try {
      const baseUrl = new URL(finalUrl).origin;
      fileExposureFindings = await checkFileExposure(baseUrl);
    } catch (err) {
      console.error("File exposure check failed:", err.message);
      fileExposureFindings = [
        {
          category: "File Exposure Check Failed",
          severity: "LOW",
          description:
            "Could not complete the sensitive file exposure check due to an unexpected error.",
          recommendation:
            "Manually verify common sensitive paths are not publicly accessible.",
        },
      ];
    }

    // --- Run the cookie flags check ---
    const isHttps = finalUrl.toLowerCase().startsWith("https://");
    let cookieFindings = [];
    let cookiesObserved = false;

    try {
      const setCookieHeader = response.headers["set-cookie"];
      cookiesObserved =
        Array.isArray(setCookieHeader) && setCookieHeader.length > 0;
      cookieFindings = checkCookies(setCookieHeader, isHttps);
    } catch (err) {
      console.error("Cookie check failed:", err.message);
      cookieFindings = [
        {
          category: "Cookie Check Failed",
          severity: "LOW",
          description:
            "Could not complete the cookie flags check due to an unexpected error.",
          recommendation:
            "Manually inspect Set-Cookie headers in browser dev tools.",
        },
      ];
    }

    const findings = [
      ...headerFindings,
      ...sslFindings,
      ...fileExposureFindings,
      ...cookieFindings,
    ];

    // TEMPORARY: still just echoing a summary — real header/HTML analysis
    // comes in the next step.
    return res.status(200).json({
      message: isSuccess
        ? "Target page fetched successfully."
        : `Target responded with status ${response.status} — partial scan only.`,
      requestedUrl: trimmedUrl,
      finalUrl,
      redirected: finalUrl !== trimmedUrl,
      requestedBy: req.userId,
      statusCode: response.status,
      isSuccess,
      headersReceived: Object.keys(response.headers),
      htmlLength: response.data ? response.data.length : 0,
      findings, // NEW
      findingsCount: findings.length, // NEW
      cookiesObserved, // NEW: true/false — informational, separate from findings
    });
  } catch (error) {
    console.error("Scan error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { runScan };
