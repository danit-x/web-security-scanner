// Unit tests for validators/authValidators.js and validators/scanValidators.js.
const dns = require("dns");
const { validationResult } = require("express-validator");
const {
  registerValidationRules,
  loginValidationRules,
  handleValidationErrors,
} = require("@server/validators/authValidators");
const scanValidators = require("@server/validators/scanValidators");

const run = async (rules, body) => {
  const req = { body };
  for (const rule of rules) await rule.run(req);
  return { req, errors: validationResult(req).array().map((e) => e.msg) };
};
const withEnv = async (env, fn) => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = env;
  try { return await fn(); } finally { process.env.NODE_ENV = original; }
};
const valid = { name: "Ann", email: "ann@example.com", password: "Passw0rd1" };

describe("registerValidationRules", () => {
  test("a valid body has no errors and the email is lower-cased, not rewritten", async () => {
    const { req, errors } = await run(registerValidationRules, { ...valid, email: " A.B+c@Gmail.COM " });
    expect(errors).toEqual([]);
    expect(req.body.email).toBe("a.b+c@gmail.com");
  });

  test.each([
    ["name missing", { name: undefined }, "Name is required"],
    ["name only spaces", { name: "   " }, "Name is required"],
    ["name 101 chars", { name: "n".repeat(101) }, "Name must be 100 characters or fewer"],
    ["email missing", { email: "" }, "Email is required"],
    ["email malformed", { email: "user@" }, "Please provide a valid email address"],
    ["password missing", { password: "" }, "Password is required"],
    ["password number", { password: 12345678 }, "Password must be text"],
    ["password 7 chars", { password: "abcdef1" }, "Password must be at least 8 characters long"],
    ["password without digit", { password: "abcdefgh" }, "Password must contain at least one number"],
  ])("%s -> %s", async (_label, override, message) => {
    const { errors } = await run(registerValidationRules, { ...valid, ...override });
    expect(errors[0]).toBe(message);
  });

  test("name of exactly 100 characters is accepted", async () => {
    expect((await run(registerValidationRules, { ...valid, name: "n".repeat(100) })).errors).toEqual([]);
  });
});

describe("loginValidationRules", () => {
  test.each([
    ["valid", {}, undefined],
    ["email missing", { email: "" }, "Email is required"],
    ["email malformed", { email: "nope" }, "Please provide a valid email address"],
    ["email is an object (operator injection)", { email: { $ne: null } }, "Please provide a valid email address"],
    ["password missing", { password: "" }, "Password is required"],
    ["password is an object", { password: { $ne: null } }, "Password must be text"],
  ])("%s", async (_label, override, message) => {
    const { errors } = await run(loginValidationRules, { email: valid.email, password: valid.password, ...override });
    expect(errors[0]).toBe(message);
  });
});

describe("handleValidationErrors", () => {
  test("returns 400 with the first message and the full list", async () => {
    const { req } = await run(registerValidationRules, { ...valid, password: "short1" });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    handleValidationErrors(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: false,
      message: "Password must be at least 8 characters long",
      errors: expect.any(Array),
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() when there are no errors", async () => {
    const { req } = await run(registerValidationRules, valid);
    const next = jest.fn();
    handleValidationErrors(req, {}, next);
    expect(next).toHaveBeenCalled();
  });

  test("the scan validator module exports the same behaviour", async () => {
    const { req } = await run(scanValidators.noteValidationRules, {});
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    scanValidators.handleValidationErrors(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    const { req: ok } = await run(scanValidators.noteValidationRules, { note: "fine" });
    const next = jest.fn();
    scanValidators.handleValidationErrors(ok, {}, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("scanValidationRules (SSRF guard)", () => {
  afterEach(() => jest.restoreAllMocks());
  const scan = (url, env) => withEnv(env, async () => (await run(scanValidators.scanValidationRules, { url })).errors);

  test.each([
    ["missing", undefined, "A URL is required"],
    ["no scheme", "example.com", "Please provide a valid URL including http:// or https://"],
    ["javascript:", "javascript:alert(1)", "Please provide a valid URL including http:// or https://"],
  ])("format: %s", async (_label, url, message) => {
    expect((await scan(url, "development"))[0]).toBe(message);
  });

  test("development allows private targets (documented bypass)", async () => {
    expect(await scan("http://10.0.0.5", "development")).toEqual([]);
    expect(await scan("http://localhost:5173", "development")).toEqual([]);
  });

  test.each([
    ["ftp scheme", "ftp://example.com", "Only http and https URLs are allowed"],
    ["localhost", "http://localhost:3000", "Scanning localhost or internal hostnames is not allowed"],
    ["0.0.0.0", "http://0.0.0.0", "Scanning localhost or internal hostnames is not allowed"],
    ["loopback", "http://127.0.0.1", "Scanning private or internal IP addresses is not allowed"],
    ["10/8", "http://10.0.0.5", "Scanning private or internal IP addresses is not allowed"],
    ["172.16/12", "http://172.16.0.1", "Scanning private or internal IP addresses is not allowed"],
    ["192.168/16", "http://192.168.1.1", "Scanning private or internal IP addresses is not allowed"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data", "Scanning private or internal IP addresses is not allowed"],
    ["IPv6 loopback", "http://[::1]/", "Scanning private or internal IP addresses is not allowed"],
    ["IPv4-mapped IPv6", "http://[::ffff:169.254.169.254]/", "Scanning private or internal IP addresses is not allowed"],
  ])("production blocks %s", async (_label, url, message) => {
    expect(await scan(url, "production")).toEqual([message]);
  });

  test("172.32.0.1 is just outside 172.16/12 and goes on to DNS (BVA)", async () => {
    const lookup = jest.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "172.32.0.1", family: 4 });
    expect(await scan("http://172.32.0.1", "production")).toEqual([]);
    expect(lookup).toHaveBeenCalled();
  });

  test("DNS rebinding: a public name resolving to a private IP is blocked", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "10.9.8.7", family: 4 });
    expect(await scan("http://rebind.example.com", "production")).toEqual([
      "This domain resolves to a private or internal IP address",
    ]);
  });

  test("a public name resolving to a public IP is allowed", async () => {
    jest.spyOn(dns.promises, "lookup").mockResolvedValue({ address: "93.184.216.34", family: 4 });
    expect(await scan("https://public.example.com", "production")).toEqual([]);
  });

  test("an unresolvable domain is rejected", async () => {
    jest.spyOn(dns.promises, "lookup").mockRejectedValue(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }));
    expect(await scan("http://nope.example.com", "production")).toEqual(["Could not resolve the provided domain"]);
  });
});

describe("noteValidationRules", () => {
  test.each([
    ["text", { note: "Fix CSP" }, []],
    ["empty string", { note: "" }, []],
    ["500 chars", { note: "n".repeat(500) }, []],
    ["500 chars + trailing space", { note: `${"n".repeat(500)} ` }, []],
    ["501 chars", { note: "n".repeat(501) }, ["A note cannot be longer than 500 characters"]],
    ["missing", {}, ["A note is required"]],
    ["number", { note: 42 }, ["A note must be text"]],
  ])("%s", async (_label, body, expected) => {
    expect((await run(scanValidators.noteValidationRules, body)).errors).toEqual(expected);
  });
});
