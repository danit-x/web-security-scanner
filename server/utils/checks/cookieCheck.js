// utils/checks/cookieCheck.js
// Checks any cookies set by the response for missing security attributes:
// Secure, HttpOnly, and SameSite. Each cookie is checked independently
// since different cookies on the same site can have different purposes
// (and therefore different risk levels).

/**
 * Parses a single raw Set-Cookie header string into its name and a set of
 * lowercase attribute flags for easy checking.
 *
 * Example raw cookie string:
 *   "sessionId=abc123; Path=/; HttpOnly; Secure; SameSite=Strict"
 *
 * @param {string} rawCookie
 * @returns {{ name: string, attributes: Set<string>, sameSiteValue: string|null }}
 */
const parseCookie = (rawCookie) => {
  // Split on ";" to get [ "name=value", "Path=/", "HttpOnly", "Secure", "SameSite=Strict" ]
  const parts = rawCookie.split(";").map((part) => part.trim());

  // First part is always "name=value"
  const [nameValue] = parts;
  const name = nameValue.split("=")[0];

  // Remaining parts are attributes — normalize to lowercase for matching,
  // since browsers treat these case-insensitively (Secure, secure, SECURE
  // are all equivalent).
  const attributeParts = parts.slice(1);
  const attributes = new Set(
    attributeParts.map((attr) => attr.split("=")[0].trim().toLowerCase()),
  );

  // Capture the actual SameSite value (Strict / Lax / None) so we can
  // flag "None" specifically, not just treat any SameSite as fine.
  const sameSitePart = attributeParts.find((attr) =>
    attr.toLowerCase().startsWith("samesite="),
  );
  const sameSiteValue = sameSitePart ? sameSitePart.split("=")[1].trim() : null;

  return { name, attributes, sameSiteValue };
};

/**
 * Checks a single parsed cookie and returns findings for any missing/weak
 * security attributes.
 *
 * @param {{ name: string, attributes: Set<string>, sameSiteValue: string|null }} cookie
 * @param {boolean} isHttps - whether the site was served over HTTPS (Secure
 *   flag only makes sense to recommend on HTTPS sites)
 * @returns {Array<{category, severity, description, recommendation}>}
 */
const checkCookie = (cookie, isHttps) => {
  const findings = [];
  const { name, attributes, sameSiteValue } = cookie;

  // --- Secure flag ---
  // Only meaningful to flag on HTTPS sites — on a plain HTTP site there's
  // no encrypted connection to require the cookie to travel over anyway
  // (that gets flagged separately by the SSL check).
  if (isHttps && !attributes.has("secure")) {
    findings.push({
      category: "Cookie Missing Secure Flag",
      severity: "MEDIUM",
      description: `The cookie "${name}" is missing the Secure flag. Without it, the browser may send this cookie over an unencrypted HTTP connection, exposing it to interception.`,
      recommendation: `Set the Secure flag on the "${name}" cookie so it is only ever sent over HTTPS.`,
    });
  }

  // --- HttpOnly flag ---
  if (!attributes.has("httponly")) {
    findings.push({
      category: "Cookie Missing HttpOnly Flag",
      severity: "MEDIUM",
      description: `The cookie "${name}" is missing the HttpOnly flag. Without it, client-side JavaScript can read this cookie's value, making it a target for theft via Cross-Site Scripting (XSS).`,
      recommendation: `Set the HttpOnly flag on the "${name}" cookie to prevent client-side scripts from accessing it.`,
    });
  }

  // --- SameSite attribute ---
  if (!attributes.has("samesite")) {
    findings.push({
      category: "Cookie Missing SameSite Attribute",
      severity: "MEDIUM",
      description: `The cookie "${name}" does not specify a SameSite attribute. Without it, the cookie may be sent along with cross-site requests, which can expose the site to Cross-Site Request Forgery (CSRF) attacks.`,
      recommendation: `Set SameSite=Lax or SameSite=Strict on the "${name}" cookie, depending on whether it needs to work across site navigations.`,
    });
  } else if (sameSiteValue && sameSiteValue.toLowerCase() === "none") {
    // SameSite=None is explicitly the "send on all cross-site requests"
    // setting — it disables the protection entirely, so it's worth
    // flagging even though the attribute is technically present.
    findings.push({
      category: "Cookie Uses SameSite=None",
      severity: "LOW",
      description: `The cookie "${name}" uses SameSite=None, which allows it to be sent on all cross-site requests, removing CSRF protection this attribute would otherwise provide.`,
      recommendation: `Use SameSite=Lax or SameSite=Strict for "${name}" unless cross-site delivery is a genuine requirement (e.g. third-party embeds).`,
    });
  }

  return findings;
};

/**
 * Checks all cookies set by the response for missing security attributes.
 *
 * @param {string[] | undefined} setCookieHeader - response.headers['set-cookie']
 *   from axios, an array of raw Set-Cookie strings (or undefined if none set)
 * @param {boolean} isHttps - whether the final scanned URL was HTTPS
 * @returns {Array<{category, severity, description, recommendation}>}
 */
const checkCookies = (setCookieHeader, isHttps) => {
  // No cookies at all — informational only, not a security finding.
  // Returning an empty array keeps this consistent with the other checks
  // (all of which return "no findings" as []), while the controller can
  // still report "no cookies observed" separately in the response if wanted.
  if (
    !setCookieHeader ||
    !Array.isArray(setCookieHeader) ||
    setCookieHeader.length === 0
  ) {
    return [];
  }

  const findings = [];

  for (const rawCookie of setCookieHeader) {
    const parsed = parseCookie(rawCookie);
    findings.push(...checkCookie(parsed, isHttps));
  }

  return findings;
};

module.exports = checkCookies;
