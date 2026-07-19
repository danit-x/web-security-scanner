// utils/checks/fileExposureCheck.js
// Checks for common sensitive files accidentally left exposed on the server
// (e.g. .env with secrets, .git/config revealing repo internals, backup
// files, private keys). Requests are made in parallel to keep scan time down.

const axios = require("axios");

// -----------------------------------------------------------------------
// Reference list of sensitive paths to probe, with severity + explanation.
// Kept as data (like config/securityHeaders.js) so new paths can be added
// without touching the checking logic below.
// -----------------------------------------------------------------------
const sensitivePaths = [
  {
    path: ".env",
    severity: "HIGH",
    description:
      "A .env file is publicly accessible. These files typically contain database credentials, API keys, and other secrets.",
    recommendation:
      "Remove .env from the web root or block access to it in your server config (e.g. deny access to dotfiles in nginx/Apache), and rotate any secrets it may have exposed.",
  },
  {
    path: ".git/config",
    severity: "HIGH",
    description:
      "The .git/config file is publicly accessible, meaning the entire .git directory may be downloadable — potentially exposing full source code history, including secrets ever committed, even ones since removed.",
    recommendation:
      "Remove the .git directory from the deployed web root, or block access to it entirely in your server config. Rotate any secrets that may have ever been committed.",
  },
  {
    path: "id_rsa",
    severity: "HIGH",
    description:
      "A private SSH key (id_rsa) appears to be publicly accessible. This could allow an attacker to impersonate the server or a user for SSH/Git access.",
    recommendation:
      "Remove the private key from the web root immediately and rotate/replace the corresponding key pair everywhere it is trusted.",
  },
  {
    path: "backup.sql",
    severity: "MEDIUM",
    description:
      "A database backup file (backup.sql) appears to be publicly accessible, potentially exposing your entire database contents including user data and credentials.",
    recommendation:
      "Remove database backups from the web-accessible directory and store them somewhere not served over HTTP.",
  },
  {
    path: "wp-config.php.bak",
    severity: "MEDIUM",
    description:
      "A backup of wp-config.php appears to be publicly accessible. Unlike the live .php file (which gets executed), a .bak file is served as plain text, potentially exposing WordPress database credentials and secret keys.",
    recommendation:
      "Remove backup files (.bak, .old, .orig, ~) from the web root — they bypass PHP execution and get served as raw text.",
  },
  {
    path: "config.json",
    severity: "MEDIUM",
    description:
      "A config.json file is publicly accessible. Depending on its contents, this may expose API keys, internal URLs, or other configuration details not meant for public view.",
    recommendation:
      "Move configuration files outside the web root, or verify this specific file contains no sensitive values.",
  },
  {
    path: ".htaccess",
    severity: "LOW",
    description:
      "The .htaccess file is publicly accessible. It usually does not contain secrets, but it can reveal internal routing rules, redirects, or security rules that give an attacker insight into the server setup.",
    recommendation:
      "Configure the web server to deny access to dotfiles by default.",
  },
  {
    path: ".DS_Store",
    severity: "LOW",
    description:
      "A .DS_Store file (a macOS Finder metadata file) is publicly accessible. This can leak the names of other files and folders on the server that were never meant to be public.",
    recommendation:
      "Remove .DS_Store files from the deployment and add them to .gitignore / deployment excludes so they never get uploaded again.",
  },
  {
    path: "package.json",
    severity: "LOW",
    description:
      "package.json is publicly accessible. This is common and often harmless, but it does reveal your exact dependency versions, which can help an attacker look for known vulnerabilities in those specific versions.",
    recommendation:
      "Not usually critical, but consider blocking access to package.json on production if you want to minimize information disclosure.",
  },
];

// Requests that come back with a body shorter than this are almost
// certainly not real file content (a real .env or backup.sql file is
// rarely under 20 bytes).
const MIN_CONTENT_LENGTH = 20;

// Phrases commonly found in a site's custom "soft 404" page — some servers
// return status 200 for literally any path and just render their normal
// error/not-found page instead of a real 404 status. If we see these in
// the body, treat it as NOT exposed even though the status was 200.
const SOFT_404_INDICATORS = [
  "404",
  "not found",
  "page not found",
  "cannot get",
  "does not exist",
  "<!doctype html", // a full HTML page is very unlikely to be the real content of a .env/.sql/.git file
  "<html",
];

/**
 * Heuristic: does this response actually look like real exposed file
 * content, or does it look like a generic "not found" page that happened
 * to return status 200?
 *
 * @param {string} path - the sensitive path being checked, e.g. ".env"
 * @param {string} body - response body as a string
 * @returns {boolean}
 */
const looksLikeRealFile = (path, body) => {
  if (typeof body !== "string") return false;

  const trimmed = body.trim();

  // Too short to be a real file of this kind.
  if (trimmed.length < MIN_CONTENT_LENGTH) return false;

  const lower = trimmed.toLowerCase();

  // If it looks like an HTML error/not-found page, it's a false positive —
  // the server is soft-404ing (returning 200 for any path).
  const looksLikeSoft404 = SOFT_404_INDICATORS.some((indicator) =>
    lower.includes(indicator),
  );
  if (looksLikeSoft404) return false;

  return true;
};

/**
 * Probes a single sensitive path against the target's base URL.
 *
 * @param {string} baseUrl - e.g. "https://example.com" (no trailing slash)
 * @param {Object} rule - one entry from sensitivePaths
 * @returns {Promise<Object|null>} a finding object, or null if not exposed
 */
const probePath = async (baseUrl, rule) => {
  const targetUrl = `${baseUrl.replace(/\/$/, "")}/${rule.path}`;

  try {
    const response = await axios.get(targetUrl, {
      timeout: 5000, // lightweight/fast — don't let one slow path stall the whole check
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 SecScanner/1.0",
      },
      validateStatus: () => true, // we want to inspect the status ourselves, not throw on 404
      maxRedirects: 0, // a redirect (e.g. to a login page) means it's NOT directly exposed
    });

    // Only status 200 is a candidate — 404/403/301/302/etc. mean it's not
    // directly and publicly exposed as a raw file.
    if (response.status !== 200) {
      return null;
    }

    const body =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data ?? "");

    if (!looksLikeRealFile(rule.path, body)) {
      return null;
    }

    // Looks like a genuine exposure — build the finding.
    return {
      category: "Exposed Sensitive File",
      severity: rule.severity,
      description: `${rule.path} — ${rule.description}`,
      recommendation: rule.recommendation,
    };
  } catch (_err) {
    // Network error probing this one path (timeout, DNS, refused, etc.)
    // This is NOT a finding — it just means we couldn't check this path,
    // so we silently skip it rather than reporting a false "exposed".
    return null;
  }
};

/**
 * Checks a target site for common exposed sensitive files.
 *
 * @param {string} baseUrl - the site's base URL, e.g. "https://example.com"
 * @returns {Promise<Array<{category, severity, description, recommendation}>>}
 */
const checkFileExposure = async (baseUrl) => {
  // Run all probes in parallel so this check doesn't slow the scan down
  // linearly with the number of paths — Promise.all waits for the SLOWEST
  // one, not the sum of all of them.
  const results = await Promise.all(
    sensitivePaths.map((rule) => probePath(baseUrl, rule)),
  );

  // Filter out the nulls (paths that were not exposed / failed to check).
  return results.filter((finding) => finding !== null);
};

module.exports = checkFileExposure;
