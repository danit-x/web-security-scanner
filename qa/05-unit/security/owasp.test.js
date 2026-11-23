// Phase 9: scripted security tests mapped to the OWASP Top 10 (2021).
// Complements the automated ZAP scan with checks a scanner cannot reason
// about (business logic, tokens, mass assignment). Runs against the real app
// in-process and a throw-away LOCAL database. Existing coverage elsewhere:
//   A01 IDOR                -> integration/scan.api.test.js, BDD @idor, Postman 04 History
//   A07 brute force, expiry -> integration/auth.api.test.js, BDD @rate-limit, Postman 05 Security
//   A10 redirect/rebinding  -> security/def-009-ssrf.test.js
const jwt = require("jsonwebtoken");
const { app, request, registerUser, uniqueEmail, PASSWORD } = require("../helpers/api");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { startFixtureSite } = require("../helpers/fixtureSite");
const User = require("@server/models/user");
const ScanResult = require("@server/models/ScanResults");

let alice, bob, site;
beforeAll(async () => {
  await connectTestDb();
  alice = await registerUser();
  bob = await registerUser();
  site = await startFixtureSite();
});
afterAll(async () => {
  await site.close();
  await disconnectTestDb();
});
afterEach(() => jest.restoreAllMocks());

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const login = (body) => request(app).post("/api/auth/login").send(body);
const NO_STACK = /\bat .+\.js:\d+/;

describe("A02 Cryptographic failures", () => {
  test("JWTs are HMAC-SHA256 signed and expire within 7 days", () => {
    const { header, payload } = jwt.decode(alice.token, { complete: true });
    expect(header.alg).toBe("HS256");
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(7 * 24 * 3600);
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "id"]); // no personal data in the token
  });

  test("passwords are stored as bcrypt hashes (cost >= 10), never plain text", async () => {
    const stored = await User.findById(alice.user._id).lean();
    expect(stored.password).toMatch(/^\$2[aby]\$(1\d|[2-9]\d)\$/);
  });
});

describe("A03 Injection", () => {
  test.each([
    ["operator object as email", { email: { $ne: null }, password: PASSWORD }],
    ["operator object as password", { email: "x@example.com", password: { $ne: null } }],
    ["$regex as email", { email: { $regex: ".*" }, password: PASSWORD }],
    ["$where as email", { email: { $where: "sleep(1000)" }, password: PASSWORD }],
  ])("NoSQL injection in login (%s) -> 400, no token", async (_label, body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.token).toBeUndefined();
  });

  test("NoSQL operator object as a note -> 400 'A note must be text'", async () => {
    const { _id } = (await request(app).post("/api/scan").set(auth(alice)).send({ url: `${site.url}/`, ownershipConfirmed: true })).body;
    const res = await request(app).patch(`/api/history/${_id}`).set(auth(alice)).send({ note: { $gt: "" } });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("A note must be text");
  });

  test("stored XSS: a script note is returned as inert JSON text, never as HTML", async () => {
    const { _id } = (await request(app).post("/api/scan").set(auth(alice)).send({ url: `${site.url}/`, ownershipConfirmed: true })).body;
    const payload = `<script>alert(document.cookie)</script><img src=x onerror=alert(1)>`;
    await request(app).patch(`/api/history/${_id}`).set(auth(alice)).send({ note: payload }).expect(200);
    const res = await request(app).get(`/api/history/${_id}`).set(auth(alice));
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff"); // browser may not sniff it as HTML
    expect(res.body.scan.note).toBe(payload); // stored verbatim; React escapes it when rendering
  });
});

describe("A05 Security misconfiguration", () => {
  test("hardening headers are present and the framework is not advertised", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers).toEqual(
      expect.objectContaining({
        "content-security-policy": expect.stringContaining("default-src 'self'"),
        "strict-transport-security": expect.stringMatching(/max-age=\d+/),
        "x-frame-options": "SAMEORIGIN",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cross-origin-opener-policy": "same-origin",
      }),
    );
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("an oversized JSON body (> 100 kB) is refused with 413 and no stack trace", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: "a@b.co", password: "x".repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(JSON.stringify(res.body)).not.toMatch(NO_STACK);
  });

  test("unknown routes and methods give a JSON 404 without internals", async () => {
    const res = await request(app).put("/api/scan");
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(NO_STACK);
  });
});

describe("A07 Identification and authentication failures", () => {
  test("a token with alg 'none' (unsigned) is rejected", async () => {
    const unsigned = jwt.sign({ id: alice.user._id }, null, { algorithm: "none" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${unsigned}`);
    expect(res.status).toBe(401);
  });

  test("a token signed with a different secret is rejected", async () => {
    const forged = jwt.sign({ id: alice.user._id }, "attacker-guessed-secret", { expiresIn: "1h" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  // OBS-04: digits-only passwords such as 12345678 were accepted.
  test.each([
    ["12345678", "digits only"],
    ["00000000", "repeated digit"],
  ])("weak password %s (%s) is rejected (OBS-04)", async (password) => {
    const res = await request(app).post("/api/auth/register").send({ name: "Weak", email: uniqueEmail("weak"), password });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password must contain at least one letter");
  });

  test("a password with letters and digits is still accepted (OBS-04 control)", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Ok", email: uniqueEmail("ok"), password: "abcdefg1" });
    expect(res.status).toBe(201);
  });
});

describe("A08 Software and data integrity: mass assignment", () => {
  test("register ignores client-supplied _id, createdAt and role fields", async () => {
    const fakeId = "0123456789abcdef01234567";
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Mass", email: uniqueEmail("mass"), password: PASSWORD, _id: fakeId, createdAt: "2000-01-01", role: "admin", isAdmin: true });
    expect(res.status).toBe(201);
    const stored = await User.findById(res.body.user._id).lean();
    expect(String(stored._id)).not.toBe(fakeId);
    expect(new Date(stored.createdAt).getFullYear()).toBeGreaterThan(2000);
    expect(stored.role).toBeUndefined();
    expect(stored.isAdmin).toBeUndefined();
  });

  test("scan ignores client-supplied grade, score and userId", async () => {
    const res = await request(app)
      .post("/api/scan")
      .set(auth(alice))
      .send({ url: `${site.url}/`, ownershipConfirmed: true, grade: "A", score: 100, userId: bob.user._id });
    expect(res.status).toBe(200);
    const stored = await ScanResult.findById(res.body._id).lean();
    expect(String(stored.userId)).toBe(alice.user._id);
    expect(stored.score).not.toBe(100); // the weak fixture site cannot score 100
  });

  test("a note update cannot move a scan to another user", async () => {
    const { _id } = (await request(app).post("/api/scan").set(auth(alice)).send({ url: `${site.url}/`, ownershipConfirmed: true })).body;
    await request(app).patch(`/api/history/${_id}`).set(auth(alice)).send({ note: "x", userId: bob.user._id, grade: "A" }).expect(200);
    const stored = await ScanResult.findById(_id).lean();
    expect(String(stored.userId)).toBe(alice.user._id);
    expect(stored.grade).not.toBe("A");
  });
});

describe("A10 SSRF: obfuscated internal addresses in production mode", () => {
  // A fresh user per case: the scan limiter allows 10 scans per user per
  // 15 min and counts rejected attempts too, so sharing one user turns the
  // later cases into 429s instead of testing the SSRF guard.
  let attacker;
  beforeEach(async () => {
    attacker = await registerUser();
    process.env.NODE_ENV = "production";
  });
  afterEach(() => { process.env.NODE_ENV = "test"; });

  test.each([
    "http://2130706433/", // 127.0.0.1 as one decimal number
    "http://0x7f.0.0.1/", // hex octet
    "http://0177.0.0.1/", // octal octet
    "http://127.1/", // short form
    "http://LOCALHOST/", // case
    "http://localhost./", // trailing dot
    "http://[::ffff:127.0.0.1]/", // IPv4-mapped IPv6
    "http://[::1]/", // IPv6 loopback
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://[fd00::1]/", // IPv6 unique-local
  ])("%s is refused (400)", async (url) => {
    const res = await request(app).post("/api/scan").set(auth(attacker)).send({ url, ownershipConfirmed: true });
    expect(res.status).toBe(400);
  });
});
