// API tests for POST /api/scan and /api/history against the real app + local DB.
// The only scan target is a local fixture site (NODE_ENV=test, so the SSRF
// guard's development bypass applies).
const mongoose = require("mongoose");
const { app, request, registerUser } = require("../helpers/api");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { startFixtureSite, closedPortUrl } = require("../helpers/fixtureSite");
const ScanResult = require("@server/models/ScanResults");

let site, alice, bob;
beforeAll(async () => {
  await connectTestDb();
  site = await startFixtureSite();
  alice = await registerUser();
  bob = await registerUser();
});
afterAll(async () => {
  await site.close();
  await disconnectTestDb();
});
afterEach(() => jest.restoreAllMocks());

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });
const scan = (u, body) => request(app).post("/api/scan").set(auth(u)).send(body);

describe("POST /api/scan", () => {
  let report;
  beforeAll(async () => {
    report = (await scan(alice, { url: `${site.url}/`, ownershipConfirmed: true })).body;
  });

  test("produces and saves a graded report", async () => {
    expect(report).toMatchObject({ success: true, _id: expect.any(String), statusCode: 200, isSuccess: true, redirected: false });
    expect(report.grade).toMatch(/^[A-F]$/);
    expect(await ScanResult.countDocuments({ _id: report._id, userId: alice.user._id })).toBe(1);
  });

  test("score, grade and summary agree with the findings", () => {
    const { calculateGrade } = require("@server/utils/scoring");
    expect(calculateGrade(report.findings)).toEqual({ score: report.score, grade: report.grade });
    const count = (s) => report.findings.filter((f) => f.severity === s).length;
    expect(report.summary).toEqual({ critical: count("CRITICAL"), high: count("HIGH"), medium: count("MEDIUM"), low: count("LOW") });
    const grouped = Object.values(report.findingsByCategory).flat().length;
    expect(grouped).toBe(report.findings.length);
  });

  test("the fixture's known weaknesses are all detected", () => {
    const cats = new Set(report.findings.map((f) => f.category));
    expect([...cats]).toEqual(expect.arrayContaining(["Missing Security Header", "No HTTPS"]));
    expect(report.cookiesObserved).toBe(true);
    expect(report.findings.some((f) => /CVE-2020-11022/.test(f.description))).toBe(true);
  });

  test("follows redirects and reports the final URL", async () => {
    const res = await scan(alice, { url: `${site.url}/redirect`, ownershipConfirmed: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ redirected: true, finalUrl: `${site.url}/` });
  });

  test("a 404 page is still scanned and flagged isSuccess=false", async () => {
    const res = await scan(alice, { url: `${site.url}/missing`, ownershipConfirmed: true });
    expect(res.body).toMatchObject({ statusCode: 404, isSuccess: false });
  });

  test.each([
    ["ownership not confirmed", { ownershipConfirmed: false }, 400, "You must confirm you own this website or have permission to scan it."],
    ["non-http scheme allowed by isURL", { url: "ftp://127.0.0.1/file" }, 400, "URL must start with http:// or https://"],
  ])("%s -> %i", async (_label, override, status, message) => {
    const res = await scan(bob, { url: `${site.url}/`, ownershipConfirmed: true, ...override });
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
  });

  test("unreachable target -> 502 connection refused", async () => {
    const res = await scan(bob, { url: await closedPortUrl(), ownershipConfirmed: true });
    expect(res.status).toBe(502);
    expect(res.body.detail).toBe("Connection was refused by the server.");
  });

  test("401 without a token", async () => {
    expect((await request(app).post("/api/scan").send({ url: site.url, ownershipConfirmed: true })).status).toBe(401);
  });
});

describe("history, notes and delete (ownership rules)", () => {
  let aliceScans, bobScan;
  beforeAll(async () => {
    const mine = await ScanResult.find({ userId: alice.user._id }).sort({ createdAt: -1 });
    aliceScans = mine.map((s) => String(s._id));
    bobScan = (await scan(bob, { url: `${site.url}/`, ownershipConfirmed: true })).body._id;
  });

  test("GET /history lists only my scans, newest first", async () => {
    const res = await request(app).get("/api/history").set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(aliceScans.length);
    expect(res.body.scans.map((s) => s._id)).toEqual(aliceScans);
    expect(res.body.scans.every((s) => s.userId === alice.user._id)).toBe(true);
  });

  test.each([
    ["own scan", () => aliceScans[0], 200],
    ["another user's scan (IDOR)", () => bobScan, 404],
    ["unknown id", () => new mongoose.Types.ObjectId().toString(), 404],
    ["malformed id", () => "abc", 400],
  ])("GET /history/:id %s -> %i", async (_label, id, status) => {
    expect((await request(app).get(`/api/history/${id()}`).set(auth(alice))).status).toBe(status);
  });

  test("PATCH note on my scan saves it", async () => {
    const res = await request(app).patch(`/api/history/${aliceScans[0]}`).set(auth(alice)).send({ note: "Add CSP" });
    expect(res.status).toBe(200);
    expect((await ScanResult.findById(aliceScans[0])).note).toBe("Add CSP");
  });

  test.each([
    ["another user's scan", () => bobScan, { note: "x" }, 404],
    ["malformed id", () => "abc", { note: "x" }, 400],
    ["note too long", () => aliceScans[0], { note: "n".repeat(501) }, 400],
  ])("PATCH %s -> %i", async (_label, id, body, status) => {
    expect((await request(app).patch(`/api/history/${id()}`).set(auth(alice)).send(body)).status).toBe(status);
  });

  test("DELETE: other user's scan 404, malformed 400, my scan 200 then gone", async () => {
    expect((await request(app).delete(`/api/history/${bobScan}`).set(auth(alice))).status).toBe(404);
    expect(await ScanResult.exists({ _id: bobScan })).toBeTruthy();
    expect((await request(app).delete("/api/history/abc").set(auth(alice))).status).toBe(400);
    const del = await request(app).delete(`/api/history/${aliceScans[0]}`).set(auth(alice));
    expect(del.body).toEqual({ success: true, message: "Scan deleted" });
    expect((await request(app).get(`/api/history/${aliceScans[0]}`).set(auth(alice))).status).toBe(404);
  });
});

describe("hardening", () => {
  test("unknown route -> 404 JSON", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test("helmet headers present, X-Powered-By hidden", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
