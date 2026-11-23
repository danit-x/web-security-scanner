// DEF-010 (phase 9, OWASP A05): the React client was served with no security
// headers (no CSP, no clickjacking protection, no nosniff). ZAP flagged it on
// the production build. client/security-headers.json is the single source of
// truth; vercel.json (production) and `vite preview` (local check) must both
// serve it. This test fails if either drifts.
const fs = require("node:fs");
const path = require("node:path");

const CLIENT = path.resolve(__dirname, "../../../client");
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(CLIENT, f), "utf8"));

describe("DEF-010 client security headers", () => {
  const spec = readJson("security-headers.json");
  const prodApi = spec.productionApiOrigin;

  // Build the header list exactly as vite.config.js does, for a given API origin.
  const expected = (apiOrigin) => {
    const csp = Object.entries(spec.contentSecurityPolicy)
      .map(([k, v]) => `${k} ${v.join(" ")}`.trim())
      .join("; ")
      .replace("%API_ORIGIN%", apiOrigin);
    return { ...spec.headers, "Content-Security-Policy": csp };
  };

  test("the CSP blocks the risky defaults: inline/remote script, framing, plugins", () => {
    const csp = spec.contentSecurityPolicy;
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["script-src"]).toEqual(["'self'"]); // no 'unsafe-inline', no 'unsafe-eval'
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["connect-src"]).toEqual(["'self'", "%API_ORIGIN%"]);
  });

  test("vercel.json serves every header on every path, with the production API origin", () => {
    const vercel = readJson("vercel.json");
    const rule = (vercel.headers || []).find((h) => h.source === "/(.*)");
    expect(rule).toBeDefined();
    const served = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
    expect(served).toEqual(expected(prodApi));
  });

  test("the SPA rewrite is kept (React Router deep links still work)", () => {
    expect(readJson("vercel.json").rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }]);
  });

  test("vite.config.js applies the same headers to `vite preview`", () => {
    const config = fs.readFileSync(path.join(CLIENT, "vite.config.js"), "utf8");
    expect(config).toMatch(/security-headers\.json/);
    expect(config).toMatch(/preview:\s*{[^}]*headers/s);
  });
});
