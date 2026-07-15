// utils/checks/sslCheck.js
// Checks the target site's HTTPS/TLS setup: whether it uses HTTPS at all,
// and if so, whether its certificate is expired/expiring soon, self-signed,
// or using an outdated TLS protocol version.

const tls = require("tls");

// How many days before expiry we start warning about it.
const EXPIRY_WARNING_DAYS = 30;

// TLS versions considered outdated/insecure today (TLS 1.0 and 1.1 are
// deprecated by all major browsers; TLS 1.2+ is the current minimum).
const WEAK_TLS_VERSIONS = ["TLSv1", "TLSv1.1", "SSLv3"];

/**
 * Opens a raw TLS connection to host:443 and resolves with the peer
 * certificate + negotiated protocol version. Does NOT reject the promise
 * on cert errors (expired/self-signed) — we WANT to inspect those certs,
 * not just fail — so `rejectUnauthorized: false` is used deliberately here.
 *
 * @param {string} hostname
 * @returns {Promise<{ cert: Object, protocol: string, authorized: boolean, authorizationError: string|null }>}
 */
const getCertificateInfo = (hostname) => {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname, // needed for SNI — many hosts serve different certs per hostname
        rejectUnauthorized: false, // don't throw on invalid certs; we want to inspect them
        timeout: 8000, // match the same 8s budget used for the main axios fetch
      },
      () => {
        // Connection succeeded (TCP + TLS handshake completed, even if the
        // cert itself is invalid — that's expected, we check that ourselves).
        const cert = socket.getPeerCertificate();
        const protocol = socket.getProtocol(); // e.g. "TLSv1.2", "TLSv1.3"
        const authorized = socket.authorized; // false if cert is invalid/self-signed/expired
        const authorizationError = socket.authorizationError || null;

        socket.end();
        resolve({ cert, protocol, authorized, authorizationError });
      },
    );

    // Network-level failures: DNS, connection refused, timeout, etc.
    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS connection timed out"));
    });
  });
};

/**
 * Runs the SSL/TLS check for a scanned URL.
 *
 * @param {string} finalUrl - the final URL after redirects (from the axios fetch)
 * @returns {Promise<Array<{category, severity, description, recommendation}>>}
 */
const checkSsl = async (finalUrl) => {
  const findings = [];

  let parsed;
  try {
    parsed = new URL(finalUrl);
  } catch (err) {
    // Shouldn't happen (finalUrl already came from a successful fetch),
    // but guard defensively rather than crashing the whole scan.
    return findings;
  }

  // --- 1. Is the site using HTTPS at all? ---
  if (parsed.protocol !== "https:") {
    findings.push({
      category: "No HTTPS",
      severity: "HIGH",
      description:
        "This site is served over plain HTTP, not HTTPS. All traffic — including any passwords, cookies, or form data — travels unencrypted and can be intercepted or modified in transit (e.g. on public wifi).",
      recommendation:
        "Obtain a TLS certificate (e.g. via Let's Encrypt) and serve the site exclusively over HTTPS, redirecting all HTTP requests to HTTPS.",
    });
    // Skip further TLS checks — there's no certificate to inspect.
    return findings;
  }

  // --- 2. Connect and pull certificate details ---
  let certInfo;
  try {
    certInfo = await getCertificateInfo(parsed.hostname);
  } catch (err) {
    // IMPORTANT: a failed raw TLS connection here does NOT necessarily mean
    // the site is insecure. Some servers/firewalls/CDNs behave oddly with a
    // bare tls.connect() (WAF blocking non-browser clients, IP allowlisting,
    // SNI quirks, etc.) even though HTTPS works perfectly fine in a real
    // browser. Since we can't actually confirm anything about the cert in
    // this case, report it as "unable to verify" (MEDIUM, informational)
    // rather than implying a concrete problem like an expired/self-signed
    // cert (which stay HIGH/CRITICAL).
    console.error(
      `SSL check could not connect to ${parsed.hostname}: ${err.message}`,
    );
    findings.push({
      category: "SSL Check Inconclusive",
      severity: "MEDIUM",
      description: `Could not independently verify this site's SSL/TLS certificate (${err.message}). This may be caused by network restrictions, a firewall, or non-standard server behavior — it does not necessarily mean the certificate is invalid.`,
      recommendation:
        "Manually verify the certificate in a browser (click the padlock icon) to confirm it is valid, not expired, and issued by a trusted authority.",
    });
    return findings;
  }

  const { cert, protocol, authorized, authorizationError } = certInfo;

  // getPeerCertificate() can return an empty object if something went wrong
  // internally (rare, but guard against it).
  if (!cert || Object.keys(cert).length === 0) {
    findings.push({
      category: "Certificate Unavailable",
      severity: "MEDIUM",
      description:
        "Connected over HTTPS, but no certificate details could be retrieved.",
      recommendation:
        "Manually verify the server's TLS certificate configuration.",
    });
    return findings;
  }

  // --- 3. Expiry check ---
  if (cert.valid_to) {
    const expiryDate = new Date(cert.valid_to);
    const now = new Date();
    const msUntilExpiry = expiryDate.getTime() - now.getTime();
    const daysUntilExpiry = Math.floor(msUntilExpiry / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      findings.push({
        category: "Expired Certificate",
        severity: "CRITICAL",
        description: `The SSL certificate expired on ${expiryDate.toDateString()}. Browsers will show visitors a security warning, and encryption guarantees can no longer be trusted.`,
        recommendation: "Renew the SSL certificate immediately.",
      });
    } else if (daysUntilExpiry <= EXPIRY_WARNING_DAYS) {
      findings.push({
        category: "Certificate Expiring Soon",
        severity: "MEDIUM",
        description: `The SSL certificate expires in ${daysUntilExpiry} day(s), on ${expiryDate.toDateString()}. If it lapses, browsers will block or warn visitors.`,
        recommendation:
          "Renew the SSL certificate before it expires — ideally set up auto-renewal.",
      });
    }
  }

  // --- 4. Self-signed / untrusted certificate check ---
  // `authorized` is false whenever Node couldn't verify the cert against a
  // trusted CA — this covers self-signed certs, expired certs, and
  // hostname mismatches. We already report expiry separately above, so
  // here we specifically look for the self-signed/untrusted-issuer case.
  if (!authorized) {
    const isSelfSigned =
      cert.issuer &&
      cert.subject &&
      JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);

    if (isSelfSigned) {
      findings.push({
        category: "Self-Signed Certificate",
        severity: "HIGH",
        description:
          "This site uses a self-signed certificate rather than one issued by a trusted Certificate Authority. Browsers will show visitors a security warning, and there is no independent verification that the site is who it claims to be.",
        recommendation:
          "Replace the self-signed certificate with one from a trusted CA, such as Let's Encrypt (free) or a commercial provider.",
      });
    } else if (
      authorizationError &&
      authorizationError !== "CERT_HAS_EXPIRED"
    ) {
      // CERT_HAS_EXPIRED is already covered by the expiry check above —
      // avoid reporting it twice.
      findings.push({
        category: "Untrusted Certificate",
        severity: "HIGH",
        description: `The certificate could not be verified as trusted: ${authorizationError}.`,
        recommendation:
          "Ensure the certificate is issued by a trusted CA and the full certificate chain (including intermediates) is correctly installed on the server.",
      });
    }
  }

  // --- 5. Weak/old TLS protocol version ---
  if (protocol && WEAK_TLS_VERSIONS.includes(protocol)) {
    findings.push({
      category: "Outdated TLS Version",
      severity: "HIGH",
      description: `The server negotiated ${protocol}, which is deprecated and considered insecure. Modern browsers are dropping support for it, and it has known cryptographic weaknesses.`,
      recommendation:
        "Disable TLS 1.0/1.1 (and SSLv3) on the server and require TLS 1.2 or higher.",
    });
  }

  return findings;
};

module.exports = checkSsl;
