// config/securityHeaders.js
// Reference list of important HTTP security headers to check for.
//
// This is kept as pure DATA (not logic) on purpose — the scanController
// will just loop over this array and check if each header is present in
// the response. Adding a new header check later means adding one object
// here, not touching the scanning logic itself.
//
// `severity` values match the enum in models/ScanResults.js exactly:
// LOW | MEDIUM | HIGH | CRITICAL — so a finding built from one of these
// entries can be saved straight into a ScanResult document.
//
// `httpsOnly: true` means this header only matters on HTTPS sites — e.g.
// HSTS is meaningless on a plain HTTP site, so the controller should skip
// that check (or handle it separately) when the scanned site is HTTP-only.

const securityHeaders = [
  {
    header: "Content-Security-Policy",
    severity: "HIGH",
    description:
      "Content-Security-Policy (CSP) restricts which sources of scripts, styles, images, and other resources the browser is allowed to load. Without it, the site has no defense-in-depth against Cross-Site Scripting (XSS) — if an attacker manages to inject a script, the browser will run it with no restrictions.",
    recommendation:
      "Add a Content-Security-Policy header, starting with a strict baseline like default-src 'self' and loosening it only for sources you explicitly trust.",
    httpsOnly: false,
  },
  {
    header: "Strict-Transport-Security",
    severity: "HIGH",
    description:
      "HTTP Strict Transport Security (HSTS) tells browsers to only ever connect to this site over HTTPS, never HTTP. Without it, users can be silently downgraded to an insecure connection (e.g. via a man-in-the-middle attack on public wifi) even if the site itself supports HTTPS.",
    recommendation:
      "Add a Strict-Transport-Security header, e.g. max-age=31536000; includeSubDomains, once you are confident HTTPS works reliably across the whole site.",
    httpsOnly: true, // only meaningful when the site is served over HTTPS
  },
  {
    header: "X-Frame-Options",
    severity: "MEDIUM",
    description:
      "X-Frame-Options controls whether the page can be embedded inside an <iframe> on another site. Without it, an attacker can load your page inside an invisible iframe on a malicious site and trick users into clicking things they did not mean to (clickjacking).",
    recommendation:
      "Add X-Frame-Options: DENY (or SAMEORIGIN if you need to frame your own pages), or use the frame-ancestors directive in a CSP header instead.",
    httpsOnly: false,
  },
  {
    header: "X-Content-Type-Options",
    severity: "MEDIUM",
    description:
      'X-Content-Type-Options: nosniff stops browsers from trying to guess ("MIME sniff") a file\'s content type instead of trusting the declared Content-Type header. Without it, a browser might execute a file uploaded as an image as if it were JavaScript or HTML, opening the door to XSS.',
    recommendation:
      "Add the header X-Content-Type-Options: nosniff to every response.",
    httpsOnly: false,
  },
  {
    header: "Referrer-Policy",
    severity: "LOW",
    description:
      "Referrer-Policy controls how much information about the current page is sent in the Referer header when a user clicks a link to another site. Without it, browsers may default to sending the full URL — including sensitive query parameters like tokens or search terms — to third-party sites.",
    recommendation:
      "Add a Referrer-Policy header, e.g. strict-origin-when-cross-origin, to limit what is leaked to other sites.",
    httpsOnly: false,
  },
  {
    header: "Permissions-Policy",
    severity: "LOW",
    description:
      "Permissions-Policy lets a site explicitly disable browser features it does not use (camera, microphone, geolocation, etc.), reducing the impact if a third-party script or an XSS bug tries to abuse one of those APIs.",
    recommendation:
      "Add a Permissions-Policy header disabling features the site does not need, e.g. geolocation=(), camera=(), microphone=().",
    httpsOnly: false,
  },
];

module.exports = securityHeaders;
