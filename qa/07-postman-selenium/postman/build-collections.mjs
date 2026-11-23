// qa/07-postman-selenium/postman/build-collections.mjs
// Generates the two Postman collections (v2.1 format) from readable code, so
// the JSON stays consistent. Re-run after editing:
//   node qa/07-postman-selenium/postman/build-collections.mjs
// The generated *.postman_collection.json files can be imported into the
// Postman app or run with the Postman CLI (see run-postman.ps1).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const lines = (s) => s.trim().split("\n");
const script = (type, src) => ({ listen: type, script: { type: "text/javascript", exec: lines(src) } });

// ---------- request builder ----------
const AUTH = {
  alice: "Bearer {{aliceToken}}",
  bob: "Bearer {{bobToken}}",
};

function request(name, method, path, { body, raw, auth, headers = [], pre, tests, description } = {}) {
  const header = [...headers];
  if (auth) header.push({ key: "Authorization", value: AUTH[auth] ?? auth });
  const item = {
    name,
    request: {
      method,
      header,
      url: { raw: `{{baseUrl}}${path}`, host: ["{{baseUrl}}"], path: path.split("/").filter(Boolean) },
      description,
    },
    event: [],
  };
  if (body !== undefined || raw !== undefined) {
    header.push({ key: "Content-Type", value: "application/json" });
    item.request.body = {
      mode: "raw",
      raw: raw ?? JSON.stringify(body, null, 2),
      options: { raw: { language: "json" } },
    };
  }
  if (pre) item.event.push(script("prerequest", pre));
  if (tests) item.event.push(script("test", tests));
  return item;
}

const folder = (name, description, item) => ({ name, description, item });

// Small reusable test snippets
const status = (code) => `pm.test("status is ${code}", () => pm.response.to.have.status(${code}));`;
const message = (msg) =>
  `pm.test("message is '${msg.replace(/'/g, "\\'")}'", () => pm.expect(pm.response.json().message).to.eql(${JSON.stringify(msg)}));`;
const noToken = `pm.test("no token issued", () => pm.expect(pm.response.json().token).to.be.undefined);`;
const slowScan = `pm.variables.set("maxResponseMs", 10000); // a scan makes real outbound requests`;

const userSchema = {
  type: "object",
  required: ["success", "token", "user"],
  properties: {
    success: { const: true },
    token: { type: "string", pattern: "^[\\w-]+\\.[\\w-]+\\.[\\w-]+$" },
    user: {
      type: "object",
      required: ["_id", "name", "email", "createdAt"],
      additionalProperties: false,
      properties: {
        _id: { type: "string", pattern: "^[a-f0-9]{24}$" },
        name: { type: "string" },
        email: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
};

const scanSchema = {
  type: "object",
  required: ["success", "_id", "grade", "score", "summary", "findings", "findingsByCategory", "statusCode"],
  properties: {
    success: { const: true },
    _id: { type: "string", pattern: "^[a-f0-9]{24}$" },
    grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: {
      type: "object",
      required: ["critical", "high", "medium", "low"],
      properties: {
        critical: { type: "integer" },
        high: { type: "integer" },
        medium: { type: "integer" },
        low: { type: "integer" },
      },
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["category", "severity", "description"],
        properties: { severity: { enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"] } },
      },
    },
  },
};

// ---------- collection-level scripts (run around EVERY request) ----------
const collectionPre = `
// The API trusts one proxy hop, so X-Forwarded-For is the client IP the rate
// limiters see. One random IP per run keeps repeated runs independent.
pm.request.headers.upsert({ key: "X-Forwarded-For", value: pm.environment.get("clientIp") || "10.0.0.1" });
`;

const collectionTests = `
// Checks applied to every response (non-functional / contract checks)
const limit = Number(pm.variables.get("maxResponseMs") || pm.environment.get("maxResponseMs") || 2000);
pm.test(\`[all] responds within \${limit} ms\`, () => pm.expect(pm.response.responseTime).to.be.below(limit));
pm.test("[all] JSON response", () => pm.expect(pm.response.headers.get("Content-Type") || "").to.include("application/json"));
pm.test("[all] no stack trace leaked", () => pm.expect(pm.response.text()).to.not.match(/\\bat .+\\.js:\\d+/));
pm.test("[all] X-Powered-By hidden", () => pm.response.to.not.have.header("X-Powered-By"));
`;

// ---------- main collection ----------
const main = {
  info: {
    name: "WebSec Scanner API (EC4206 QA)",
    description:
      "Phase 7 API test suite for the Website Security Scanner. Run against the LOCAL QA API only (environment: local). " +
      "Requests are chained: register -> token -> scan -> history. Two users (Alice, Bob) test access control (IDOR).",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  event: [script("prerequest", collectionPre), script("test", collectionTests)],
  item: [
    folder("00 Setup", "Health check and per-run variables", [
      request("Health check (TC-API-01)", "GET", "/health", {
        pre: `
// New identity for this run: unique emails and client IPs, so the run can be repeated.
const r = () => Math.floor(Math.random() * 254) + 1;
pm.environment.set("runId", Date.now().toString(36));
pm.environment.set("clientIp", \`10.\${r()}.\${r()}.\${r()}\`);
pm.environment.set("bruteForceIp", \`10.\${r()}.\${r()}.\${r()}\`);
pm.environment.set("aliceEmail", \`alice.\${pm.environment.get("runId")}@example.com\`);
pm.environment.set("bobEmail", \`bob.\${pm.environment.get("runId")}@example.com\`);
pm.request.headers.upsert({ key: "X-Forwarded-For", value: pm.environment.get("clientIp") });
`,
        tests: `
${status(200)}
pm.test("body is {status: ok}", () => pm.expect(pm.response.json()).to.eql({ status: "ok" }));
pm.test("helmet: X-Content-Type-Options nosniff (TC-API-03)", () => pm.response.to.have.header("X-Content-Type-Options", "nosniff"));
pm.test("helmet: X-Frame-Options set", () => pm.response.to.have.header("X-Frame-Options"));
pm.test("helmet: Content-Security-Policy set", () => pm.response.to.have.header("Content-Security-Policy"));
`,
      }),
    ]),

    folder("01 Auth", "Registration and login", [
      request("Register Alice (TC-REG-01)", "POST", "/auth/register", {
        body: { name: "Alice", email: "{{aliceEmail}}", password: "{{password}}" },
        tests: `
${status(201)}
pm.test("response matches the user contract (JSON schema)", () => pm.response.to.have.jsonSchema(${JSON.stringify(userSchema)}));
pm.test("password never returned (TC-REG-11)", () => pm.expect(pm.response.text()).to.not.match(/password/i));
pm.environment.set("aliceToken", pm.response.json().token);
pm.environment.set("aliceId", pm.response.json().user._id);
`,
      }),
      request("Register Bob", "POST", "/auth/register", {
        body: { name: "Bob", email: "{{bobEmail}}", password: "{{password}}" },
        tests: `
${status(201)}
pm.environment.set("bobToken", pm.response.json().token);
pm.environment.set("bobId", pm.response.json().user._id);
`,
      }),
      request("Register duplicate, different case (TC-REG-02, TC-REG-09)", "POST", "/auth/register", {
        pre: `pm.variables.set("upperEmail", pm.environment.get("aliceEmail").toUpperCase());`,
        body: { name: "Imposter", email: "{{upperEmail}}", password: "{{password}}" },
        tests: `${status(400)}\n${message("User already exists")}\n${noToken}`,
      }),
      request("Register with 7-char password (TC-REG-03, BVA)", "POST", "/auth/register", {
        body: { name: "Short", email: "short.{{runId}}@example.com", password: "Passw0r" },
        tests: `${status(400)}\n${message("Password must be at least 8 characters long")}`,
      }),
      request("Register with numeric password (DEF-005 regression)", "POST", "/auth/register", {
        raw: '{\n  "name": "Num",\n  "email": "num.{{runId}}@example.com",\n  "password": 12345678\n}',
        tests: `${status(400)}\n${message("Password must be text")}`,
      }),
      request("Login Alice (TC-LOG-01)", "POST", "/auth/login", {
        body: { email: "{{aliceEmail}}", password: "{{password}}" },
        tests: `
${status(200)}
pm.test("response matches the user contract (JSON schema)", () => pm.response.to.have.jsonSchema(${JSON.stringify(userSchema)}));
pm.test("same user as registered", () => pm.expect(pm.response.json().user._id).to.eql(pm.environment.get("aliceId")));
pm.environment.set("aliceToken", pm.response.json().token);
`,
      }),
      request("Login wrong password (TC-LOG-02)", "POST", "/auth/login", {
        body: { email: "{{aliceEmail}}", password: "WrongPass1" },
        tests: `${status(401)}\n${message("Invalid email or password")}\n${noToken}`,
      }),
      request("Login unknown email, same message (TC-LOG-03)", "POST", "/auth/login", {
        body: { email: "nobody.{{runId}}@example.com", password: "{{password}}" },
        tests: `${status(401)}\n${message("Invalid email or password")}\n${noToken}`,
      }),
      request("Login missing password (TC-LOG-04)", "POST", "/auth/login", {
        body: { email: "{{aliceEmail}}" },
        tests: `${status(400)}\n${message("Password is required")}`,
      }),
      request("Login malformed JSON (TC-API-05, DEF-002 regression)", "POST", "/auth/login", {
        raw: '{"email": "{{aliceEmail}}", ',
        tests: `${status(400)}\npm.test("no stack property", () => pm.expect(pm.response.json().stack).to.be.undefined);`,
      }),
    ]),

    folder("02 Token", "JWT-protected route /auth/me", [
      request("Me with valid token (TC-AUTH-01)", "GET", "/auth/me", {
        auth: "alice",
        tests: `${status(200)}\npm.test("returns Alice", () => pm.expect(pm.response.json().user.email).to.eql(pm.environment.get("aliceEmail")));`,
      }),
      request("Me without token (TC-AUTH-02)", "GET", "/auth/me", {
        tests: `${status(401)}\n${message("Authorization token is required")}`,
      }),
      request("Me with tampered token (TC-AUTH-03)", "GET", "/auth/me", {
        pre: `
// Flip one character in the signature part of Alice's real token.
const t = pm.environment.get("aliceToken");
const last = t.slice(-1) === "A" ? "B" : "A";
pm.variables.set("tamperedToken", t.slice(0, -1) + last);
`,
        auth: "Bearer {{tamperedToken}}",
        tests: `${status(401)}\n${message("Invalid authorization token")}`,
      }),
      request("Me with empty bearer value (TC-AUTH-05)", "GET", "/auth/me", {
        auth: "Bearer ",
        tests: `${status(401)}\n${message("Authorization token is required")}`,
      }),
    ]),

    folder("03 Scan", "POST /scan against the local fixture website only", [
      request("Scan fixture as Alice (TC-SCAN-01)", "POST", "/scan", {
        auth: "alice",
        pre: slowScan,
        body: { url: "{{fixtureUrl}}", ownershipConfirmed: true },
        tests: `
${status(200)}
const r = pm.response.json();
pm.test("report matches the scan contract (JSON schema)", () => pm.response.to.have.jsonSchema(${JSON.stringify(scanSchema)}));
pm.test("summary counts agree with findings", () => {
  const n = (s) => r.findings.filter((f) => f.severity === s).length;
  pm.expect(r.summary).to.eql({ critical: n("CRITICAL"), high: n("HIGH"), medium: n("MEDIUM"), low: n("LOW") });
});
pm.test("fixture weaknesses detected", () => {
  const cats = r.findings.map((f) => f.category);
  pm.expect(cats).to.include.members(["Missing Security Header", "No HTTPS", "Cookie Missing HttpOnly Flag", "Outdated / Vulnerable Library"]);
});
pm.environment.set("aliceScanId", r._id);
`,
      }),
      request("Scan fixture as Bob", "POST", "/scan", {
        auth: "bob",
        pre: slowScan,
        body: { url: "{{fixtureUrl}}", ownershipConfirmed: true },
        tests: `${status(200)}\npm.environment.set("bobScanId", pm.response.json()._id);`,
      }),
      request("Scan without ownership confirmation (TC-SCAN-02)", "POST", "/scan", {
        auth: "alice",
        body: { url: "{{fixtureUrl}}", ownershipConfirmed: false },
        tests: `${status(400)}\n${message("You must confirm you own this website or have permission to scan it.")}`,
      }),
      request("Scan URL without protocol (TC-SCAN-03)", "POST", "/scan", {
        auth: "alice",
        body: { url: "example.com", ownershipConfirmed: true },
        tests: `${status(400)}\n${message("Please provide a valid URL including http:// or https://")}`,
      }),
      request("Scan empty URL (TC-SCAN-04)", "POST", "/scan", {
        auth: "alice",
        body: { url: "", ownershipConfirmed: true },
        tests: `${status(400)}\n${message("A URL is required")}`,
      }),
      request("Scan ftp:// URL (TC-SCAN-05)", "POST", "/scan", {
        auth: "alice",
        body: { url: "ftp://127.0.0.1/file", ownershipConfirmed: true },
        tests: `${status(400)}\n${message("URL must start with http:// or https://")}`,
      }),
      request("Scan unreachable host (TC-SCAN-06)", "POST", "/scan", {
        auth: "alice",
        pre: slowScan,
        body: { url: "{{deadUrl}}", ownershipConfirmed: true },
        tests: `${status(502)}\n${message("Site could not be reached.")}`,
      }),
      request("Scan without login (TC-SCAN-07)", "POST", "/scan", {
        body: { url: "{{fixtureUrl}}", ownershipConfirmed: true },
        tests: status(401),
      }),
    ]),

    folder("04 History", "History, notes, delete, and access control between users", [
      request("List my history (TC-HIS-01)", "GET", "/history", {
        auth: "alice",
        tests: `
${status(200)}
const b = pm.response.json();
pm.test("exactly my one scan", () => pm.expect(b.count).to.eql(1));
pm.test("every scan belongs to me", () => b.scans.forEach((s) => pm.expect(s.userId).to.eql(pm.environment.get("aliceId"))));
pm.test("Bob's scan is not listed", () => pm.expect(b.scans.map((s) => s._id)).to.not.include(pm.environment.get("bobScanId")));
`,
      }),
      request("Open my scan (TC-HIS-02)", "GET", "/history/{{aliceScanId}}", {
        auth: "alice",
        tests: `${status(200)}\npm.test("same scan", () => pm.expect(pm.response.json().scan._id).to.eql(pm.environment.get("aliceScanId")));`,
      }),
      request("Open Bob's scan as Alice (TC-HIS-03, IDOR)", "GET", "/history/{{bobScanId}}", {
        auth: "alice",
        tests: `${status(404)}\n${message("Scan result not found")}`,
      }),
      request("Open malformed id (TC-HIS-04)", "GET", "/history/abc", {
        auth: "alice",
        tests: `${status(400)}\n${message("Invalid scan ID")}`,
      }),
      request("Open unknown id (TC-HIS-05)", "GET", "/history/000000000000000000000000", {
        auth: "alice",
        tests: `${status(404)}\n${message("Scan result not found")}`,
      }),
      request("Add note to my scan (TC-NOTE-01)", "PATCH", "/history/{{aliceScanId}}", {
        auth: "alice",
        body: { note: "Add a Content-Security-Policy header" },
        tests: status(200),
      }),
      request("Note was saved", "GET", "/history/{{aliceScanId}}", {
        auth: "alice",
        tests: `${status(200)}\npm.test("note persisted", () => pm.expect(pm.response.json().scan.note).to.eql("Add a Content-Security-Policy header"));`,
      }),
      request("Note of 501 chars (TC-NOTE-02, BVA)", "PATCH", "/history/{{aliceScanId}}", {
        auth: "alice",
        pre: `pm.variables.set("longNote", "n".repeat(501));`,
        body: { note: "{{longNote}}" },
        tests: `${status(400)}\n${message("A note cannot be longer than 500 characters")}`,
      }),
      request("Non-string note (TC-NOTE-03)", "PATCH", "/history/{{aliceScanId}}", {
        auth: "alice",
        raw: '{ "note": 42 }',
        tests: `${status(400)}\n${message("A note must be text")}`,
      }),
      request("Note on Bob's scan as Alice (TC-NOTE-04, IDOR)", "PATCH", "/history/{{bobScanId}}", {
        auth: "alice",
        body: { note: "hacked" },
        tests: status(404),
      }),
      request("Delete Bob's scan as Alice (TC-DEL-02, IDOR)", "DELETE", "/history/{{bobScanId}}", {
        auth: "alice",
        tests: status(404),
      }),
      request("Bob's scan still exists, unchanged", "GET", "/history/{{bobScanId}}", {
        auth: "bob",
        tests: `${status(200)}\npm.test("note untouched", () => pm.expect(pm.response.json().scan.note || "").to.eql(""));`,
      }),
      request("Delete my scan (TC-DEL-01)", "DELETE", "/history/{{aliceScanId}}", {
        auth: "alice",
        tests: `${status(200)}\npm.test("confirmation body", () => pm.expect(pm.response.json()).to.eql({ success: true, message: "Scan deleted" }));`,
      }),
      request("Deleted scan is gone", "GET", "/history/{{aliceScanId}}", {
        auth: "alice",
        tests: status(404),
      }),
    ]),

    folder("05 Security", "Hardening: routing, CORS, brute-force throttling", [
      request("Unknown route (TC-API-02)", "GET", "/does-not-exist", {
        tests: `${status(404)}\npm.test("success false", () => pm.expect(pm.response.json().success).to.eql(false));`,
      }),
      request("CORS: allowed origin echoed", "GET", "/health", {
        headers: [{ key: "Origin", value: "{{clientOrigin}}" }],
        tests: `${status(200)}\npm.test("Access-Control-Allow-Origin is the client", () => pm.response.to.have.header("Access-Control-Allow-Origin", pm.environment.get("clientOrigin")));`,
      }),
      request("CORS: other origin refused (TC-API-04, DEF-003 regression)", "GET", "/health", {
        headers: [{ key: "Origin", value: "https://evil.example" }],
        tests: `${status(403)}\npm.test("no CORS allow header", () => pm.response.to.not.have.header("Access-Control-Allow-Origin"));`,
      }),
      request("Brute force: wrong password x6 from one IP (TC-LOG-05)", "POST", "/auth/login", {
        description: "Loops on itself with pm.execution.setNextRequest: attempts 1-5 must be 401, attempt 6 must be 429.",
        pre: `
const n = Number(pm.environment.get("bfCount") || 0) + 1;
pm.environment.set("bfCount", n);
pm.request.headers.upsert({ key: "X-Forwarded-For", value: pm.environment.get("bruteForceIp") });
`,
        body: { email: "{{aliceEmail}}", password: "Guess{{bfCount}}xx" },
        tests: `
const n = Number(pm.environment.get("bfCount"));
if (n <= 5) {
  pm.test(\`attempt \${n}: 401 (allowed, wrong password)\`, () => pm.response.to.have.status(401));
  pm.execution.setNextRequest(pm.info.requestName); // run this request again
} else {
  pm.test("attempt 6: 429 throttled", () => pm.response.to.have.status(429));
  ${message("Too many login attempts. Please try again in 15 minutes.")}
  pm.test("RateLimit headers present", () => pm.response.to.have.header("RateLimit-Policy"));
  pm.environment.unset("bfCount");
}
`,
      }),
      request("Correct password is also blocked from the throttled IP", "POST", "/auth/login", {
        pre: `pm.request.headers.upsert({ key: "X-Forwarded-For", value: pm.environment.get("bruteForceIp") });`,
        body: { email: "{{aliceEmail}}", password: "{{password}}" },
        tests: `${status(429)}\n${noToken}`,
      }),
      request("Another IP can still log in", "POST", "/auth/login", {
        body: { email: "{{aliceEmail}}", password: "{{password}}" },
        tests: status(200),
      }),
    ]),
  ],
};

// ---------- data-driven collection (one request, one iteration per CSV row) ----------
const dataDriven = {
  info: {
    name: "WebSec Register: data-driven (EC4206 QA)",
    description:
      "Runs POST /auth/register once per row of register-cases.csv (Phase 3 equivalence classes and boundary values).",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  event: [script("test", collectionTests)],
  item: [
    request("Register: {{caseId}}", "POST", "/auth/register", {
      pre: `
// Build the body from the current CSV row. RUN in an email becomes a unique
// run id; nameLength generates long names; passwordType=number sends a number.
const d = pm.iterationData;
const run = pm.environment.get("ddRunId") || Date.now().toString(36);
pm.environment.set("ddRunId", run);
const r = () => Math.floor(Math.random() * 254) + 1;
pm.request.headers.upsert({ key: "X-Forwarded-For", value: \`10.\${r()}.\${r()}.\${r()}\` });
const name = d.get("nameLength") ? "N".repeat(Number(d.get("nameLength"))) : String(d.get("name") ?? "");
const email = String(d.get("email") ?? "").replace("RUN", run + pm.info.iteration);
let password = String(d.get("password") ?? "");
if (d.get("passwordType") === "number") password = Number(password);
pm.variables.set("body", JSON.stringify({ name, email, password }));
`,
      raw: "{{body}}",
      tests: `
const d = pm.iterationData;
const expected = Number(d.get("expectedStatus"));
pm.test(\`\${d.get("caseId")}: status \${expected}\`, () => pm.response.to.have.status(expected));
if (d.get("expectedMessage")) {
  pm.test(\`\${d.get("caseId")}: message\`, () => pm.expect(pm.response.json().message).to.eql(d.get("expectedMessage")));
}
if (expected === 201) pm.test(\`\${d.get("caseId")}: token issued\`, () => pm.expect(pm.response.json().token).to.be.a("string"));
`,
    }),
  ],
};

for (const [file, data] of [
  ["websec-api.postman_collection.json", main],
  ["websec-register-data-driven.postman_collection.json", dataDriven],
]) {
  writeFileSync(join(here, file), JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", file);
}
