// controllers/scanController.js
// Handles the logic for POST /api/scan.
// Fetches the target URL, runs all security checks, scores the results,
// saves the report to MongoDB, and returns it to the client.

const checkSecurityHeaders = require("../utils/checks/checkSecurityHeaders");
const checkSsl = require("../utils/checks/sslCheck");
const checkFileExposure = require("../utils/checks/fileExposureCheck");
const checkCookies = require("../utils/checks/cookieCheck");
const checkMixedContent = require("../utils/checks/mixedContentCheck");
const extractLibraryVersions = require("../utils/checks/libraryCheck");
const {
  checkVulnerableLibraries,
} = require("../utils/checks/vulnerableLibraryCheck");
const { calculateGrade } = require("../utils/scoring");

const ScanResult = require("../models/ScanResult");
const asyncHandler = require("../utils/asyncHandler");

const axios = require("axios");

const groupFindingsByCategory = (findings) => {
  const grouped = {};
  for (const finding of findings) {
    const key = finding.category || "Other";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(finding);
  }
  return grouped;
};

const summarizeSeverity = (findings) => {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    const key = (finding.severity || "").toLowerCase();
    if (key in summary) {
      summary[key] += 1;
    }
  }
  return summary;
};

// @desc    Run a security scan against a target URL
// @route   POST /api/scan
// @access  Private (authMiddleware runs before this and sets req.userId)
//
// Wrapped in asyncHandler as a safety net — if something outside the
// specific try/catch blocks below throws (a genuine bug rather than an
// expected failure mode), it's forwarded to the global error handler
// instead of crashing the server or hanging the request.
const runScan = asyncHandler(async (req, res) => {
  const { url } = req.body;

  // --- Basic validation ---
  if (!url || typeof url !== "string" || url.trim() === "") {
    return res
      .status(400)
      .json({ success: false, message: "Please provide a url to scan" });
  }
  // In the basic validation section, add this check right after the URL checks:
  const { url, ownershipConfirmed } = req.body; // was: const { url } = req.body;

  // ...(existing url validation stays the same)...

  // NEW: reject the scan entirely if ownership wasn't confirmed. This is
  // the real enforcement point — the frontend checkbox is a UX nudge, but
  // the backend is what actually stops an unconfirmed scan from running.
  if (ownershipConfirmed !== true) {
    return res.status(400).json({
      success: false,
      message:
        "You must confirm you own this website or have permission to scan it.",
    });
  }
  const trimmedUrl = url.trim();

  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return res.status(400).json({
      success: false,
      message: "URL must start with http:// or https://",
    });
  }

  try {
    new URL(trimmedUrl);
  } catch (err) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide a valid URL" });
  }

  console.log(`Scan requested by user ${req.userId} for url: ${trimmedUrl}`);

  // --- Fetch the target page ---
  let response;
  try {
    response = await axios.get(trimmedUrl, {
      timeout: 8000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 SecScanner/1.0",
      },
      validateStatus: () => true,
      maxRedirects: 5,
    });
  } catch (fetchError) {
    if (fetchError.code === "ECONNABORTED") {
      return res
        .status(408)
        .json({ success: false, message: "Site took too long to respond." });
    }
    if (fetchError.code === "ENOTFOUND") {
      return res.status(502).json({
        success: false,
        message: "Site could not be reached.",
        detail: "DNS lookup failed — the domain may not exist.",
      });
    }
    if (fetchError.code === "ECONNREFUSED") {
      return res.status(502).json({
        success: false,
        message: "Site could not be reached.",
        detail: "Connection was refused by the server.",
      });
    }
    if (fetchError.code === "ECONNRESET") {
      return res.status(502).json({
        success: false,
        message: "Site could not be reached.",
        detail: "Connection was reset by the server.",
      });
    }
    if (
      fetchError.code === "CERT_HAS_EXPIRED" ||
      fetchError.code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
      fetchError.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
    ) {
      return res.status(502).json({
        success: false,
        message: "Site could not be reached.",
        detail: `SSL/TLS certificate issue: ${fetchError.code}`,
      });
    }

    console.error(
      "Unhandled fetch error:",
      fetchError.code,
      fetchError.message,
    );
    return res.status(502).json({
      success: false,
      message: "Site could not be reached.",
      detail: fetchError.message,
    });
  }

  const finalUrl =
    response.request?.res?.responseUrl ||
    response.request?._currentUrl ||
    trimmedUrl;

  if (finalUrl !== trimmedUrl) {
    console.log(`Redirected: ${trimmedUrl} -> ${finalUrl}`);
  }

  const isSuccess = response.status >= 200 && response.status < 300;
  const redirected = finalUrl !== trimmedUrl;

  // --- Security headers ---
  let headerFindings = [];
  try {
    headerFindings = checkSecurityHeaders(response.headers, finalUrl);
  } catch (err) {
    console.error("Security headers check failed:", err.message);
    headerFindings = [
      {
        category: "Security Headers Check Failed",
        severity: "LOW",
        description:
          "Could not complete the security headers check due to an unexpected error.",
        recommendation:
          "Manually inspect response headers using browser dev tools.",
      },
    ];
  }

  // --- SSL/TLS ---
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
        recommendation: "Manually verify the site's certificate in a browser.",
      },
    ];
  }

  // --- Exposed sensitive files ---
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

  // --- Cookie flags ---
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

  // --- Mixed content ---
  let mixedContentFindings = [];
  try {
    mixedContentFindings = checkMixedContent(response.data, finalUrl);
  } catch (err) {
    console.error("Mixed content check failed:", err.message);
    mixedContentFindings = [
      {
        category: "Mixed Content Check Failed",
        severity: "LOW",
        description:
          "Could not complete the mixed content check due to an unexpected error.",
        recommendation:
          "Manually inspect the browser console for mixed content warnings.",
      },
    ];
  }

  // --- Outdated/vulnerable libraries ---
  let libraryFindings = [];
  try {
    const detectedLibraries = extractLibraryVersions(response.data);
    libraryFindings = checkVulnerableLibraries(detectedLibraries);
  } catch (err) {
    console.error("Vulnerable library check failed:", err.message);
    libraryFindings = [
      {
        category: "Library Check Failed",
        severity: "LOW",
        description:
          "Could not complete the outdated/vulnerable library check due to an unexpected error.",
        recommendation:
          "Manually review frontend library versions used on this page.",
      },
    ];
  }

  // --- Combine + score ---
  const findings = [
    ...headerFindings,
    ...sslFindings,
    ...fileExposureFindings,
    ...cookieFindings,
    ...mixedContentFindings,
    ...libraryFindings,
  ];

  const { score, grade } = calculateGrade(findings);
  const findingsByCategory = groupFindingsByCategory(findings);
  const summary = summarizeSeverity(findings);

  // --- Persist to MongoDB ---
  let savedScan;
  try {
    savedScan = await ScanResult.create({
      userId: req.userId,
      url: trimmedUrl,
      grade,
      score,
      summary,
      findings,
      ownershipConfirmed: true,
    });
  } catch (dbErr) {
    // Scan still succeeded even if saving failed — log it, don't block
    // the user from seeing their report.
    console.error("Failed to save scan result:", dbErr.message);
  }

  const responseBody = savedScan
    ? {
        success: true,
        ...savedScan.toJSON(),
        finalUrl,
        redirected,
        statusCode: response.status,
        isSuccess,
        cookiesObserved,
        findingsByCategory,
      }
    : {
        success: true,
        url: trimmedUrl,
        finalUrl,
        redirected,
        grade,
        score,
        summary,
        findings,
        findingsByCategory,
        saved: false,
      };

  return res.status(200).json(responseBody);
  // Note: no outer try/catch here anymore — asyncHandler catches anything
  // that escapes the specific try/catch blocks above and forwards it to
  // the global error handler in middleware/errorHandler.js.
});

module.exports = { runScan };
