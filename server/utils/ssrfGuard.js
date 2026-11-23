// utils/ssrfGuard.js
// Connection-time SSRF protection for every outbound request the scanner makes
// (DEF-009, OWASP A10).
//
// validators/scanValidators.js checks the URL the user typed, once. That alone
// is not enough, because:
//   1. Redirects: a public page can answer "302 Location: http://169.254.169.254/"
//      and the HTTP client follows it without asking the validator again.
//   2. DNS rebinding: a hostname can resolve to a public IP when the validator
//      looks it up, then to 127.0.0.1 a moment later when the socket connects.
// So the check is repeated where it cannot be skipped: in the DNS lookup used
// by the socket itself (covers hostnames, including on every redirect), and
// in a redirect hook (covers redirects to literal IP addresses, which never go
// through DNS).
//
// Like the validator, it is enforced only in production, so developers can
// still scan their own localhost.
const dns = require("dns");
const http = require("http");
const https = require("https");
const net = require("net");
const validators = require("../validators/scanValidators");

const BLOCKED_MESSAGE = "The target resolves to a private or internal address.";

const isEnforced = () => process.env.NODE_ENV === "production";
// Looked up through the module so tests can stub which addresses count as internal.
const isBlocked = (ip) => validators.isPrivateOrReservedIp(ip);

const blockedError = (host, address) =>
  Object.assign(new Error(`${BLOCKED_MESSAGE} (${host} -> ${address})`), { code: "ESSRFBLOCKED" });

// Drop-in replacement for dns.lookup(): resolves, then refuses if ANY resolved
// address is internal (an attacker could mix one public and one private record).
function guardedLookup(hostname, options, callback) {
  if (typeof options === "function") [callback, options] = [options, {}];
  if (typeof options === "number") options = { family: options };
  options = options || {};

  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (isEnforced()) {
      const bad = addresses.find((a) => isBlocked(a.address));
      if (bad) return callback(blockedError(hostname, bad.address));
    }
    if (options.all) return callback(null, addresses);
    const [first] = addresses;
    return callback(null, first.address, first.family);
  });
}

// Throws for a literal internal IP (redirect targets and TLS hosts that are
// IPs skip DNS entirely, so guardedLookup never sees them).
function assertPublicHost(hostname) {
  if (!isEnforced() || !hostname) return;
  const host = String(hostname).replace(/^\[(.*)\]$/, "$1").toLowerCase();
  if (host === "localhost" || (net.isIP(host) && isBlocked(host))) {
    throw blockedError(hostname, host);
  }
}

// Keep-alive is off so a pooled socket can never be reused for a new hostname
// without a fresh, guarded lookup.
const httpAgent = new http.Agent({ lookup: guardedLookup, keepAlive: false });
const httpsAgent = new https.Agent({ lookup: guardedLookup, keepAlive: false });

// Spread into every axios call that touches a user-supplied target.
const safeAxiosOptions = {
  httpAgent,
  httpsAgent,
  // follow-redirects calls this before each hop; throwing aborts the request.
  beforeRedirect: (options) => assertPublicHost(options.hostname),
};

const isBlockedError = (err) => {
  for (let e = err; e; e = e.cause) if (e.code === "ESSRFBLOCKED") return true;
  return false;
};

module.exports = { guardedLookup, assertPublicHost, safeAxiosOptions, isBlockedError, BLOCKED_MESSAGE };
