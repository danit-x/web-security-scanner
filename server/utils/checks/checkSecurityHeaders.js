// utils/checks/checkSecurityHeaders.js
// First of several individual "checks" — each check is its own file that
// takes whatever data it needs and returns an array of findings. Keeping
// them separate (instead of one giant controller) makes it easy to add
// more checks later (cookies, SSL, HTML-based checks, etc.) without this
// file growing forever.

const securityHeadersConfig = require("../../config/securityHeaders");

/**
 * Checks a response's headers against our reference list of security headers
 * and returns a finding for every one that's missing.
 *
 * @param {Object} headers - response.headers from axios (an object, e.g.
 *   { "content-type": "text/html", "x-frame-options": "DENY", ... }).
 *   Axios always lowercases header names on the way in, but we still
 *   lowercase our own lookup key defensively in case this function is
 *   ever called with headers from somewhere else (e.g. raw Node http).
 * @param {string} finalUrl - the final URL after redirects, used to decide
 *   whether httpsOnly checks (like HSTS) apply.
 * @returns {Array<{category, severity, description, recommendation}>}
 */
const checkSecurityHeaders = (headers, finalUrl) => {
  const findings = [];

  // Guard against being called with no headers at all.
  if (!headers || typeof headers !== "object") {
    return findings;
  }

  const isHttps =
    typeof finalUrl === "string" &&
    finalUrl.toLowerCase().startsWith("https://");

  // Build a lowercase lookup set of header names actually present in the
  // response, so "Content-Security-Policy" and "content-security-policy"
  // are treated as the same thing.
  const receivedHeaderNames = new Set(
    Object.keys(headers).map((key) => key.toLowerCase()),
  );

  for (const rule of securityHeadersConfig) {
    // Skip HTTPS-only checks (e.g. HSTS) when the site isn't served over HTTPS —
    // that header simply doesn't apply there.
    if (rule.httpsOnly && !isHttps) {
      continue;
    }

    const headerNameLower = rule.header.toLowerCase();
    const isPresent = receivedHeaderNames.has(headerNameLower);

    // Only report a finding when the header is MISSING.
    // (Checking for misconfigured/weak values, e.g. a too-permissive CSP,
    // is a good next step to add later — for now this is presence-only.)
    if (!isPresent) {
      findings.push({
        category: "Missing Security Header",
        severity: rule.severity,
        description: `${rule.header} header is missing. ${rule.description}`,
        recommendation: rule.recommendation,
      });
    }
  }

  return findings;
};

module.exports = checkSecurityHeaders;
