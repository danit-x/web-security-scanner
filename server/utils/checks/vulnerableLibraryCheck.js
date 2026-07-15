// utils/checks/vulnerableLibraryCheck.js
// Compares detected library versions (from libraryCheck.js) against the
// known-vulnerable reference list (config/vulnerableLibraries.json) and
// generates findings for any that fall below the safe version threshold.
//
// Version comparison is done with the `semver` package rather than a
// hand-rolled comparator — it correctly handles numeric comparison
// ("3.10.0" > "3.9.0") plus edge cases like pre-release tags, which a
// simple split-and-parseInt approach can get wrong.

const semver = require("semver");
const vulnerableLibraries = require("../../config/vulnerableLibraries.json");

/**
 * Returns true if `version` is strictly less than `threshold`, using
 * semver's numeric comparison rather than string comparison.
 *
 * @param {string} version
 * @param {string} threshold
 * @returns {boolean}
 */
const isVersionBelow = (version, threshold) => {
  // semver.valid() returns null for anything that isn't a clean, parseable
  // version string — guard against that instead of letting semver.lt()
  // throw on a malformed value.
  if (!semver.valid(version) || !semver.valid(threshold)) {
    return false;
  }
  return semver.lt(version, threshold);
};

/**
 * Checks a list of detected libraries against the known-vulnerable
 * reference data and returns findings for any that are outdated/vulnerable.
 *
 * @param {Array<{ library: string, version: string, source: string }>} detectedLibraries
 *   - output of utils/checks/libraryCheck.js
 * @returns {Array<{category, severity, description, recommendation}>}
 */
const checkVulnerableLibraries = (detectedLibraries) => {
  const findings = [];

  if (!Array.isArray(detectedLibraries) || detectedLibraries.length === 0) {
    return findings;
  }

  for (const detected of detectedLibraries) {
    const { library, version } = detected;

    // Skip anything that isn't a valid semver string at all — protects
    // against a malformed "version" value crashing semver.lt() below.
    if (!semver.valid(version)) {
      continue;
    }

    // Find all reference entries for this library (there may be more than
    // one CVE per library in the reference list, e.g. jQuery has two).
    const matchingRules = vulnerableLibraries.filter(
      (entry) => entry.library.toLowerCase() === library.toLowerCase(),
    );

    // Library detected but not in our reference list at all — skip
    // silently rather than reporting incomplete/unverifiable data.
    if (matchingRules.length === 0) {
      continue;
    }

    // A library can match multiple CVE entries (e.g. jQuery 1.9 is below
    // BOTH the 3.0.0 and 3.5.0 thresholds). Report every CVE it's
    // vulnerable to, not just the first/most severe — each is a distinct,
    // separately-patched issue worth knowing about.
    for (const rule of matchingRules) {
      if (isVersionBelow(version, rule.vulnerableBelow)) {
        findings.push({
          category: "Outdated / Vulnerable Library",
          severity: rule.severity,
          description: `Detected ${rule.library} version ${version}, which is below the patched version ${rule.vulnerableBelow}. ${rule.description} (${rule.cve})`,
          recommendation: `Upgrade ${rule.library} to version ${rule.vulnerableBelow} or later.`,
        });
      }
    }
  }

  return findings;
};

module.exports = { checkVulnerableLibraries, isVersionBelow };
