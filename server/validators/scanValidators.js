// validators/scanValidators.js
// Validates the target URL for POST /api/scan and blocks SSRF attempts —
// i.e. someone using this scanner to probe internal/private network
// resources rather than a real public website.

const dns = require("dns").promises;
const { body, validationResult } = require("express-validator");

// Private / reserved IP ranges we refuse to scan in production.
// This list covers the common SSRF targets: loopback, private LAN ranges,
// link-local (includes cloud metadata endpoints like 169.254.169.254),
// and a few less common but still-relevant reserved blocks.
const BLOCKED_IP_RANGES = [
  /^127\./, // loopback (127.0.0.0/8)
  /^10\./, // private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // private Class B (172.16.0.0 - 172.31.255.255)
  /^192\.168\./, // private Class C
  /^169\.254\./, // link-local (includes AWS/GCP/Azure metadata service)
  /^0\./, // "this network"
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 unique local
  /^fe80:/, // IPv6 link-local
];

const BLOCKED_HOSTNAMES = ["localhost", "0.0.0.0"];

// Checks a resolved IP address string against the blocked ranges above.
const isPrivateOrReservedIp = (ip) =>
  BLOCKED_IP_RANGES.some((pattern) => pattern.test(ip));

// The main SSRF guard. Runs as an async custom validator inside the
// express-validator chain below.
const blockPrivateTargets = async (value) => {
  // In development, allow everything through so you can scan your own
  // localhost dev server. This is intentional and documented — SSRF
  // protection is a production concern, not a local-dev concern, since
  // in dev there's no "internal network" to leak to besides your own machine.
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Only allow http/https — file://, ftp://, gopher:// etc. are classic
  // SSRF/exfiltration vectors and have no business being "scanned" here.
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only http and https URLs are allowed");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new Error("Scanning localhost or internal hostnames is not allowed");
  }

  // If the hostname is already a literal IP, check it directly.
  if (isPrivateOrReservedIp(hostname)) {
    throw new Error("Scanning private or internal IP addresses is not allowed");
  }

  // IMPORTANT: this is the part that stops "DNS rebinding" style SSRF —
  // someone could register a public domain like "evil.example.com" that
  // resolves to 127.0.0.1 or a private IP. Blocking the literal hostname
  // string isn't enough; we have to resolve it and check the real IP too.
  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateOrReservedIp(address)) {
      throw new Error(
        "This domain resolves to a private or internal IP address",
      );
    }
  } catch (error) {
    // If DNS lookup itself fails (bad domain, doesn't exist), surface that
    // clearly rather than a generic error.
    if (error.message.includes("private or internal")) throw error;
    throw new Error("Could not resolve the provided domain");
  }

  return true;
};

// Validation chain for POST /api/scan
const scanValidationRules = [
  body("url")
    .trim()
    .notEmpty()
    .withMessage("A URL is required")
    .isURL({ require_protocol: true })
    .withMessage("Please provide a valid URL including http:// or https://")
    .bail() // stop here if isURL already failed, no point running the async check
    .custom(blockPrivateTargets),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

module.exports = { scanValidationRules, handleValidationErrors };
