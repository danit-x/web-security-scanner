// utils/checks/mixedContentCheck.js
// Checks an HTTPS page's HTML for "mixed content" — resources loaded over
// plain HTTP on an otherwise-secure page. Browsers block or warn on this,
// and it undermines the encryption HTTPS is supposed to provide.

const cheerio = require("cheerio");

// Which tags + attributes to inspect, and how severe it is if that
// particular kind of resource is loaded insecurely. Scripts and iframes
// are riskier (they can execute code / control page content) than images.
const RESOURCE_SELECTORS = [
  { selector: "script[src]", attr: "src", severity: "HIGH", label: "script" },
  { selector: "iframe[src]", attr: "src", severity: "HIGH", label: "iframe" },
  {
    selector: "link[href]",
    attr: "href",
    severity: "MEDIUM",
    label: "stylesheet/link",
  },
  { selector: "img[src]", attr: "src", severity: "MEDIUM", label: "image" },
];

/**
 * Checks whether a URL found in the HTML is explicitly HTTP (mixed content),
 * as opposed to a relative URL, a protocol-relative URL, or already HTTPS.
 *
 * Correctly IGNORES:
 *   "/images/logo.png"        (relative — inherits the page's protocol)
 *   "images/logo.png"         (relative)
 *   "//cdn.example.com/x.js"  (protocol-relative — inherits page's protocol)
 *   "https://example.com/x"   (already secure)
 *   "data:image/png;base64,.." (inline data URI, not a network request)
 *
 * Correctly FLAGS:
 *   "http://example.com/x.js" (explicitly insecure)
 *
 * @param {string} url - the raw src/href attribute value from the HTML
 * @returns {boolean}
 */
const isHttpUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();

  // Only explicit http:// counts as mixed content. Relative paths,
  // protocol-relative "//" URLs, and data URIs are all fine — they either
  // inherit the page's own (secure) protocol or aren't a network request.
  return /^http:\/\//i.test(trimmed);
};

/**
 * Checks parsed HTML for mixed content (HTTP resources on an HTTPS page).
 *
 * @param {string} html - the raw HTML body fetched from the target
 * @param {string} finalUrl - the final URL after redirects, used to decide
 *   whether this check applies at all (only relevant on HTTPS pages)
 * @returns {Array<{category, severity, description, recommendation}>}
 */
const checkMixedContent = (html, finalUrl) => {
  const findings = [];

  // Mixed content only matters on HTTPS pages — an HTTP page has no
  // "secure connection" to undermine in the first place (that's already
  // flagged separately by the SSL/TLS check).
  const isHttps =
    typeof finalUrl === "string" &&
    finalUrl.toLowerCase().startsWith("https://");
  if (!isHttps) {
    return findings;
  }

  if (!html || typeof html !== "string") {
    return findings;
  }

  let $;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    // Malformed HTML that cheerio can't parse — skip this check rather
    // than crashing the scan over it.
    console.error("Mixed content check: failed to parse HTML —", err.message);
    return findings;
  }

  // Track insecure URLs we've already reported per resource type, so a
  // page loading the same insecure script 10 times doesn't produce 10
  // identical findings — just one, clearly.
  const seenByLabel = {};

  for (const { selector, attr, severity, label } of RESOURCE_SELECTORS) {
    $(selector).each((_, element) => {
      const url = $(element).attr(attr);

      if (!isHttpUrl(url)) return;

      seenByLabel[label] = seenByLabel[label] || new Set();
      if (seenByLabel[label].has(url)) return; // already reported this exact URL
      seenByLabel[label].add(url);

      findings.push({
        category: "Mixed Content",
        severity,
        description: `This HTTPS page loads a ${label} over an insecure http:// connection: ${url}. Browsers may block this resource or show a "not fully secure" warning, and it can be intercepted or modified in transit.`,
        recommendation: `Update this ${label} reference to use https:// instead of http://, or use a protocol-relative/relative URL so it always matches the page's own protocol.`,
      });
    });
  }

  return findings;
};

module.exports = checkMixedContent;
