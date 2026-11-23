// Fault-tolerance tests for runScan (ISO 25010 reliability): every check
// module fails, the page fetch fails in different ways, or the DB save fails.
// The scan must degrade gracefully, never crash or hang.
jest.mock("@server/utils/checks/checkSecurityHeaders", () => jest.fn(() => { throw new Error("headers boom"); }));
jest.mock("@server/utils/checks/sslCheck", () => jest.fn(() => Promise.reject(new Error("ssl boom"))));
jest.mock("@server/utils/checks/fileExposureCheck", () => jest.fn(() => Promise.reject(new Error("files boom"))));
jest.mock("@server/utils/checks/cookieCheck", () => jest.fn(() => { throw new Error("cookie boom"); }));
jest.mock("@server/utils/checks/mixedContentCheck", () => jest.fn(() => { throw new Error("mixed boom"); }));
jest.mock("@server/utils/checks/libraryCheck", () => jest.fn(() => { throw new Error("library boom"); }));

const axios = require("axios");
const { app, request, registerUser } = require("../helpers/api");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { startFixtureSite } = require("../helpers/fixtureSite");
const ScanResult = require("@server/models/ScanResults");

let site, user, user2;
beforeAll(async () => {
  await connectTestDb();
  site = await startFixtureSite();
  user = await registerUser();
  user2 = await registerUser();
});
afterAll(async () => { await site.close(); await disconnectTestDb(); });
beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

const scan = (u = user) =>
  request(app).post("/api/scan").set("Authorization", `Bearer ${u.token}`)
    .send({ url: `${site.url}/`, ownershipConfirmed: true });

test("every check throwing -> 200 report made of six LOW 'Check Failed' findings", async () => {
  const res = await scan();
  expect(res.status).toBe(200);
  expect(res.body.findings.map((f) => f.category).sort()).toEqual([
    "Cookie Check Failed", "File Exposure Check Failed", "Library Check Failed",
    "Mixed Content Check Failed", "SSL Check Failed", "Security Headers Check Failed",
  ]);
  expect(res.body.findings.every((f) => f.severity === "LOW")).toBe(true);
  expect(res.body).toMatchObject({ score: 82, grade: "B" }); // 100 - 6 x 3
});

test("DB save failure -> report still returned with saved:false", async () => {
  jest.spyOn(ScanResult, "create").mockRejectedValueOnce(new Error("db down"));
  const res = await scan();
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ success: true, saved: false });
  expect(res.body._id).toBeUndefined();
});

test.each([
  ["ECONNABORTED", 408, undefined],
  ["ENOTFOUND", 502, "DNS lookup failed — the domain may not exist."],
  ["ECONNRESET", 502, "Connection was reset by the server."],
  ["CERT_HAS_EXPIRED", 502, "SSL/TLS certificate issue: CERT_HAS_EXPIRED"],
  ["DEPTH_ZERO_SELF_SIGNED_CERT", 502, "SSL/TLS certificate issue: DEPTH_ZERO_SELF_SIGNED_CERT"],
  ["EWHATEVER", 502, "something odd"],
])("fetch error %s -> %i", async (code, status, detail) => {
  jest.spyOn(axios, "get").mockRejectedValueOnce(Object.assign(new Error("something odd"), { code }));
  const res = await scan(code.startsWith("E") ? user2 : user); // spread the 10-scans-per-user limit
  expect(res.status).toBe(status);
  if (detail) expect(res.body.detail).toBe(detail);
});
