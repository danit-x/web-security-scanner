// utils/checks/libraryCheck.js
// Detects known frontend libraries (and their versions) used on the scanned
// page, by inspecting <script src> URLs and falling back to inline script
// content for version comments/banners. Detection logic only — cross-
// referencing against config/vulnerableLibraries.json happens in the next
// step (this file's job is just "what libraries + versions are present?").

const cheerio = require("cheerio");

// -----------------------------------------------------------------------
// Per-library regex patterns.
//
// Each library has TWO kinds of patterns:
//   - urlPatterns: match against a <script src="..."> URL
//   - inlinePatterns: match against inline <script> text content (used as
//     a fallback for libraries bundled/self-hosted with no version in the
//     URL, e.g. a local /js/jquery.min.js with the version only inside a
//     comment banner at the top of the file)
//
// Every pattern MUST have exactly one capture group: the version number.
// Kept as data (not hardcoded per-library if/else logic) so adding a new
// library later just means adding a new object to this array.
// -----------------------------------------------------------------------
const libraryPatterns = [
  {
    library: "jquery",
    urlPatterns: [
      // e.g. ".../jquery-3.4.1.min.js" or ".../jquery/3.4.1/jquery.min.js"
      /jquery[.-](\d+\.\d+\.\d+)/i,
      /jquery\/(\d+\.\d+\.\d+)\//i,
    ],
    inlinePatterns: [
      // e.g. "/*! jQuery v3.4.1 | ... */"
      /jquery\s*v?(\d+\.\d+\.\d+)/i,
    ],
  },
  {
    library: "bootstrap",
    urlPatterns: [
      // e.g. ".../bootstrap.min.js?v=4.3.1" or ".../bootstrap/4.3.1/js/bootstrap.min.js"
      /bootstrap[.-](\d+\.\d+\.\d+)/i,
      /bootstrap\/(\d+\.\d+\.\d+)\//i,
    ],
    inlinePatterns: [
      // e.g. "/*! Bootstrap v4.3.1 (https://getbootstrap.com/) */"
      /bootstrap\s*v?(\d+\.\d+\.\d+)/i,
    ],
  },
  {
    library: "angular",
    urlPatterns: [
      // e.g. ".../angular.js/1.6.9/angular.min.js" or "angular-1.6.9.min.js"
      /angular[.-](\d+\.\d+\.\d+)/i,
      /angular(?:\.js)?\/(\d+\.\d+\.\d+)\//i,
    ],
    inlinePatterns: [
      // AngularJS embeds its version as a JS string like: full: "1.6.9"
      /angularjs?\s*v?(\d+\.\d+\.\d+)/i,
    ],
  },
  {
    library: "lodash",
    urlPatterns: [
      // e.g. ".../lodash.min.js?v=4.17.19" or ".../lodash/4.17.19/lodash.min.js"
      /lodash[.-](\d+\.\d+\.\d+)/i,
      /lodash\/(\d+\.\d+\.\d+)\//i,
    ],
    inlinePatterns: [
      // e.g. "/**\n * @license\n * Lodash <small>lodash.com/license</small>\n * Version 4.17.19"
      /lodash\D{0,40}?(\d+\.\d+\.\d+)/i,
    ],
  },
  {
    library: "moment",
    urlPatterns: [
      // e.g. ".../moment.min.js?v=2.29.1" or ".../moment.js/2.29.1/moment.min.js"
      /moment[.-](\d+\.\d+\.\d+)/i,
      /moment(?:\.js)?\/(\d+\.\d+\.\d+)\//i,
    ],
    inlinePatterns: [
      // Moment.js embeds a version string internally, e.g. version = '2.29.1'
      /moment\.js\s*v?(\d+\.\d+\.\d+)/i,
      /version\s*[:=]\s*['"](\d+\.\d+\.\d+)['"]/i,
    ],
  },
];

/**
 * Tries each of a library's URL patterns against a single script src.
 * Returns the first matched version, or null.
 *
 * @param {string} src
 * @param {RegExp[]} patterns
 * @returns {string|null}
 */
const matchPatterns = (text, patterns) => {
  if (!text) return null;

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
};

/**
 * Scans the fetched HTML for known libraries and their versions.
 *
 * @param {string} html - the raw HTML body fetched from the target
 * @returns {Array<{ library: string, version: string, source: 'url'|'inline' }>}
 *   One entry per DETECTED library (deduplicated by library name — if the
 *   same library is found more than once, only the first detected version
 *   is kept, since a page realistically only loads one version of a given
 *   library at a time).
 */
const extractLibraryVersions = (html) => {
  const detected = [];
  const foundLibraries = new Set(); // avoid duplicate entries for the same library

  if (!html || typeof html !== "string") {
    return detected;
  }

  let $;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    console.error("Library check: failed to parse HTML —", err.message);
    return detected;
  }

  // --- Pass 1: check <script src="..."> URLs ---
  $("script[src]").each((_, element) => {
    const src = $(element).attr("src");
    if (!src) return;

    for (const lib of libraryPatterns) {
      if (foundLibraries.has(lib.library)) continue; // already found this one

      const version = matchPatterns(src, lib.urlPatterns);
      if (version) {
        detected.push({ library: lib.library, version, source: "url" });
        foundLibraries.add(lib.library);
      }
    }
  });

  // --- Pass 2: fallback — check inline <script> content for version banners ---
  // Only useful for libraries NOT already found via URL (e.g. self-hosted
  // bundles with no version in the filename/path).
  $("script:not([src])").each((_, element) => {
    const inlineText = $(element).html();
    if (!inlineText) return;

    for (const lib of libraryPatterns) {
      if (foundLibraries.has(lib.library)) continue; // already found this one

      const version = matchPatterns(inlineText, lib.inlinePatterns);
      if (version) {
        detected.push({ library: lib.library, version, source: "inline" });
        foundLibraries.add(lib.library);
      }
    }
  });

  return detected;
};

module.exports = extractLibraryVersions;
