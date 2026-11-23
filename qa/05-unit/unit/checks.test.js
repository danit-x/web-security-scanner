// Unit tests for the six security check modules in utils/checks/.
const http = require("http");
const tls = require("tls");
const { EventEmitter } = require("events");
const checkSecurityHeaders = require("@server/utils/checks/checkSecurityHeaders");
const checkCookies = require("@server/utils/checks/cookieCheck");
const checkMixedContent = require("@server/utils/checks/mixedContentCheck");
const extractLibraryVersions = require("@server/utils/checks/libraryCheck");
const { checkVulnerableLibraries, isVersionBelow } = require("@server/utils/checks/vulnerableLibraryCheck");
const checkFileExposure = require("@server/utils/checks/fileExposureCheck");
const checkSsl = require("@server/utils/checks/sslCheck");
const headerRules = require("@server/config/securityHeaders");

const categories = (findings) => findings.map((f) => f.category);

describe("checkSecurityHeaders", () => {
  const allHeaders = Object.fromEntries(headerRules.map((r) => [r.header, "x"]));

  test("no headers object -> no findings (guard)", () => {
    expect(checkSecurityHeaders(undefined, "https://a.com")).toEqual([]);
  });

  test("every required header present (any case) -> no findings", () => {
    const upper = Object.fromEntries(Object.entries(allHeaders).map(([k, v]) => [k.toUpperCase(), v]));
    expect(checkSecurityHeaders(upper, "https://a.com")).toEqual([]);
  });

  test("HTTPS page with no headers reports every rule", () => {
    expect(checkSecurityHeaders({}, "https://a.com")).toHaveLength(headerRules.length);
  });

  test("HTTP page skips HTTPS-only rules such as HSTS", () => {
    const httpsOnly = headerRules.filter((r) => r.httpsOnly).length;
    expect(httpsOnly).toBeGreaterThan(0);
    expect(checkSecurityHeaders({}, "http://a.com")).toHaveLength(headerRules.length - httpsOnly);
  });
});

describe("checkCookies", () => {
  test("no Set-Cookie header -> no findings", () => {
    expect(checkCookies(undefined, true)).toEqual([]);
  });

  test("a fully hardened cookie -> no findings", () => {
    expect(checkCookies(["sid=1; Path=/; Secure; HttpOnly; SameSite=Strict"], true)).toEqual([]);
  });

  test("a bare cookie on HTTPS is missing Secure, HttpOnly and SameSite", () => {
    const f = checkCookies(["sid=1; Path=/"], true);
    expect(f.length).toBeGreaterThanOrEqual(3);
    expect(f.every((x) => ["MEDIUM", "LOW"].includes(x.severity))).toBe(true);
  });

  test("on HTTP the Secure flag is not demanded", () => {
    const https = checkCookies(["sid=1; Path=/"], true).length;
    const plain = checkCookies(["sid=1; Path=/"], false).length;
    expect(plain).toBe(https - 1);
  });

  test("SameSite=None without Secure is flagged", () => {
    expect(checkCookies(["sid=1; HttpOnly; SameSite=None"], true).length).toBeGreaterThan(0);
  });

  test("a non-array value is ignored (contract: axios always gives string[])", () => {
    expect(checkCookies("sid=1; Path=/", true)).toEqual([]);
  });
});

describe("checkMixedContent", () => {
  const page = `<html><body>
    <script src="http://cdn.example.com/a.js"></script>
    <script src="http://cdn.example.com/a.js"></script>
    <iframe src="http://x.example.com/"></iframe>
    <img src="http://img.example.com/p.png">
    <link rel="stylesheet" href="http://css.example.com/s.css">
    <img src="//safe.example.com/p.png"><img src="/local.png"><img src="data:image/png;base64,AA==">
  </body></html>`;

  test("not applicable on an HTTP page", () => {
    expect(checkMixedContent(page, "http://a.com")).toEqual([]);
  });

  test("no HTML -> no findings", () => {
    expect(checkMixedContent(null, "https://a.com")).toEqual([]);
  });

  test("reports each insecure resource once; relative, protocol-relative and data URIs are fine", () => {
    const f = checkMixedContent(page, "https://a.com");
    expect(categories(f).every((c) => c === "Mixed Content")).toBe(true);
    expect(f.filter((x) => x.description.includes("a.js"))).toHaveLength(1);
    expect(f.some((x) => x.description.includes("safe.example.com"))).toBe(false);
    expect(f.length).toBeGreaterThanOrEqual(3);
  });
});

describe("extractLibraryVersions + checkVulnerableLibraries", () => {
  test("detects versions from script URLs and inline banners", () => {
    const libs = extractLibraryVersions(`
      <script src="/js/jquery-1.12.4.min.js"></script>
      <script src="https://cdn/bootstrap/3.3.7/js/bootstrap.min.js"></script>
      <script>/*! jQuery v1.12.4 */</script>`);
    const names = libs.map((l) => l.library);
    expect(names).toContain("jquery");
    expect(libs.find((l) => l.library === "jquery").version).toBe("1.12.4");
  });

  test("no scripts -> nothing detected", () => {
    expect(extractLibraryVersions("<html></html>")).toEqual([]);
  });

  test("old jQuery maps to known CVEs; a current version does not", () => {
    const old = checkVulnerableLibraries([{ library: "jquery", version: "1.12.4" }]);
    expect(old.length).toBeGreaterThanOrEqual(2);
    expect(old.map((f) => f.description).join(" ")).toMatch(/CVE-2020-11022/);
    expect(checkVulnerableLibraries([{ library: "jquery", version: "3.7.1" }])).toEqual([]);
  });

  test("empty or missing input -> no findings", () => {
    expect(checkVulnerableLibraries([])).toEqual([]);
    expect(checkVulnerableLibraries(undefined)).toEqual([]);
  });

  test.each([
    ["3.4.9", "3.5.0", true],
    ["3.5.0", "3.5.0", false],
    ["3.5.1", "3.5.0", false],
    ["not-a-version", "3.5.0", false],
  ])("isVersionBelow(%s, %s) -> %p (BVA)", (v, t, expected) => {
    expect(isVersionBelow(v, t)).toBe(expected);
  });
});

describe("checkFileExposure (against a local server)", () => {
  let server, base;
  const routes = {
    "/.env": [200, "DB_PASSWORD=super-secret-value\nAPI_KEY=abcdef123456"],
    "/.git/config": [200, "<html><body>404 Not Found - page does not exist</body></html>"], // soft 404
    "/robots.txt": [200, "tiny"], // too short to be a real file
  };
  beforeAll((done) => {
    server = http.createServer((req, res) => {
      const [status, body] = routes[req.url] || [404, "not found"];
      res.writeHead(status, { "Content-Type": "text/plain" });
      res.end(body);
    }).listen(0, "127.0.0.1", () => {
      base = `http://127.0.0.1:${server.address().port}`;
      done();
    });
  });
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  test("reports a real exposed .env but not soft-404s or tiny bodies", async () => {
    const f = await checkFileExposure(base);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ category: "Exposed Sensitive File", severity: "HIGH" });
    expect(f[0].description).toMatch(/\.env/);
  });

  test("an unreachable host yields no findings (probe errors are not exposures)", async () => {
    expect(await checkFileExposure("http://127.0.0.1:1")).toEqual([]);
  });
});

describe("checkSsl", () => {
  afterEach(() => jest.restoreAllMocks());
  const DAY = 24 * 60 * 60 * 1000;

  // Stub tls.connect so the certificate logic runs without the network.
  const fakeTls = ({ mode = "ok", cert = {}, protocol = "TLSv1.3", authorized = true, authorizationError = null } = {}) =>
    jest.spyOn(tls, "connect").mockImplementation((_opts, onConnect) => {
      const socket = new EventEmitter();
      Object.assign(socket, {
        getPeerCertificate: () => cert, getProtocol: () => protocol,
        authorized, authorizationError, end() {}, destroy() {},
      });
      process.nextTick(() => {
        if (mode === "error") socket.emit("error", new Error("connect ECONNREFUSED"));
        else if (mode === "timeout") socket.emit("timeout");
        else onConnect();
      });
      return socket;
    });

  test("plain HTTP -> No HTTPS (HIGH), no TLS connection attempted", async () => {
    const spy = fakeTls();
    expect(categories(await checkSsl("http://a.com"))).toEqual(["No HTTPS"]);
    expect(spy).not.toHaveBeenCalled();
  });

  test("an unparsable URL -> no findings (guard)", async () => {
    expect(await checkSsl("::not a url::")).toEqual([]);
  });

  test("a healthy certificate -> no findings", async () => {
    fakeTls({ cert: { valid_to: new Date(Date.now() + 200 * DAY).toUTCString(), issuer: { CN: "CA" }, subject: { CN: "a.com" } } });
    expect(await checkSsl("https://a.com")).toEqual([]);
  });

  test.each([
    ["connection error", { mode: "error" }, "SSL Check Inconclusive"],
    ["timeout", { mode: "timeout" }, "SSL Check Inconclusive"],
    ["empty certificate", { cert: {} }, "Certificate Unavailable"],
    ["expired", { cert: { valid_to: new Date(Date.now() - 2 * DAY).toUTCString() }, authorized: false, authorizationError: "CERT_HAS_EXPIRED" }, "Expired Certificate"],
    ["expiring in 10 days", { cert: { valid_to: new Date(Date.now() + 10 * DAY).toUTCString() } }, "Certificate Expiring Soon"],
    ["self-signed", { cert: { valid_to: new Date(Date.now() + 200 * DAY).toUTCString(), issuer: { CN: "me" }, subject: { CN: "me" } }, authorized: false, authorizationError: "DEPTH_ZERO_SELF_SIGNED_CERT" }, "Self-Signed Certificate"],
    ["untrusted chain", { cert: { valid_to: new Date(Date.now() + 200 * DAY).toUTCString(), issuer: { CN: "x" }, subject: { CN: "a.com" } }, authorized: false, authorizationError: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" }, "Untrusted Certificate"],
    ["TLS 1.0", { cert: { valid_to: new Date(Date.now() + 200 * DAY).toUTCString() }, protocol: "TLSv1" }, "Outdated TLS Version"],
  ])("%s -> %s", async (_label, opts, category) => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    fakeTls(opts);
    expect(categories(await checkSsl("https://a.com"))).toContain(category);
  });

  test("expired cert is not ALSO reported as untrusted (CERT_HAS_EXPIRED is excluded)", async () => {
    fakeTls({ cert: { valid_to: new Date(Date.now() - DAY).toUTCString(), issuer: { CN: "ca" }, subject: { CN: "a" } }, authorized: false, authorizationError: "CERT_HAS_EXPIRED" });
    expect(categories(await checkSsl("https://a.com"))).toEqual(["Expired Certificate"]);
  });
});
