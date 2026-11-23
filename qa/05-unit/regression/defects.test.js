// qa/05-unit/regression/defects.test.js
// TDD regression tests: one describe block per logged defect/observation.
// Written BEFORE the fixes (RED), then kept forever so the bug can't return.
const dns = require("dns");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const { app, request, registerUser, uniqueEmail, PASSWORD } = require("../helpers/api");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const { calculateScore, calculateGrade } = require("@server/utils/scoring");
const authMiddleware = require("@server/middleware/authMiddleware");
const { scanValidationRules } = require("@server/validators/scanValidators");

beforeAll(connectTestDb);
afterAll(disconnectTestDb);

const runScanRules = async (url, nodeEnv) => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    const req = { body: { url } };
    for (const rule of scanValidationRules) await rule.run(req);
    return validationResult(req).array().map((e) => e.msg);
  } finally {
    process.env.NODE_ENV = original;
  }
};

describe("DEF-001 email addresses are stored and matched exactly as typed", () => {
  const typed = `First.Last+qa.${Date.now()}@Gmail.com`;

  test("register keeps dots and +tag (only lower-cases)", async () => {
    const { res } = await registerUser({ email: typed });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(typed.toLowerCase());
  });

  test("login with the exact address used at registration succeeds", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: typed, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test("login is case-insensitive and ignores surrounding spaces", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `  ${typed.toUpperCase()} `, password: PASSWORD });
    expect(res.status).toBe(200);
  });
});

describe("DEF-008 valid addresses rejected by the User model's email regex", () => {
  test.each([
    ["+tag on a non-Gmail domain", (t) => `user+tag.${t}@example.com`],
    ["4-letter TLD", (t) => `user.${t}@example.info`],
    ["6-letter TLD", (t) => `user.${t}@example.online`],
  ])("%s can register", async (_label, make) => {
    const { res } = await registerUser({ email: make(Date.now()) });
    expect(res.status).toBe(201);
  });
});

describe("DEF-002 malformed JSON body", () => {
  test("returns 400 JSON without a stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body).not.toHaveProperty("stack");
  });
});

describe("DEF-003 disallowed CORS origin", () => {
  test("is refused with 403, no ACAO header and no stack trace", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://evil.example");
    expect(res.status).toBe(403);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.body).not.toHaveProperty("stack");
  });

  test("the real frontend origin is still allowed", async () => {
    const res = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});

describe("DEF-004 localhost targets", () => {
  test("are accepted by the validator in development", async () => {
    expect(await runScanRules("http://localhost:5070/", "development")).toEqual([]);
  });

  test("are still blocked in production, now by the hostname check (OBS-05 part 1)", async () => {
    expect(await runScanRules("http://localhost:3000", "production")).toEqual([
      "Scanning localhost or internal hostnames is not allowed",
    ]);
  });
});

describe("DEF-005 non-string password", () => {
  test("register with a numeric password returns 400, not 500", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Num", email: uniqueEmail("num"), password: 12345678 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password must be text");
  });

  test("login with a numeric password returns 400, not 500", async () => {
    const { body } = await registerUser();
    const res = await request(app).post("/api/auth/login").send({ email: body.email, password: 12345678 });
    expect(res.status).toBe(400);
  });
});

describe("DEF-006 calculateScore with a null finding", () => {
  test("ignores the null entry instead of throwing", () => {
    expect(calculateScore([null])).toBe(100);
    expect(calculateGrade([null, { severity: "LOW" }])).toEqual({ score: 97, grade: "A" });
  });
});

describe("DEF-007 token that is not active yet (nbf in the future)", () => {
  test("returns 401, not 500", () => {
    const token = jwt.sign({ id: "u1" }, process.env.JWT_SECRET, { notBefore: "1h" });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    const next = jest.fn();
    authMiddleware({ headers: { authorization: `Bearer ${token}` } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("OBS-02 name length message matches the rule", () => {
  test("101 characters -> 'Name must be 100 characters or fewer'", async () => {
    const { res } = await registerUser({ name: "n".repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Name must be 100 characters or fewer");
  });
});

describe("OBS-05 IPv6 literals are checked by the private-IP rule", () => {
  const PRIVATE_IP = "Scanning private or internal IP addresses is not allowed";

  test.each([
    "http://[::1]/",
    "http://[::]/",
    "http://[fd00::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
    "http://[::ffff:169.254.169.254]/",
  ])("production blocks %s with the private-IP message", async (url) => {
    expect(await runScanRules(url, "production")).toEqual([PRIVATE_IP]);
  });

  // Guard tests for the DEF-004 change (require_tld: false lets more hostnames
  // reach the SSRF guard): obfuscated forms of 127.0.0.1 must still be blocked.
  test.each(["http://2130706433/", "http://0x7f.0.0.1/", "http://127.1/", "http://0177.0.0.1/"])(
    "production still blocks the obfuscated loopback %s",
    async (url) => {
      const errors = await runScanRules(url, "production");
      expect(errors).toHaveLength(1);
      expect(errors[0]).not.toBe("This domain resolves to a private or internal IP address");
    },
  );

  test("a public IPv6 literal is still allowed", async () => {
    const spy = jest.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "2606:4700:4700::1111", family: 6 });
    try {
      expect(await runScanRules("http://[2606:4700:4700::1111]/", "production")).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
