// Basis-path tests for middleware/authMiddleware.js (V(G) = 8, see
// qa/04-white-box/white-box-analysis.md section 5).
const jwt = require("jsonwebtoken");
const authMiddleware = require("@server/middleware/authMiddleware");

const SECRET = process.env.JWT_SECRET;

const run = (authorization) => {
  const req = { headers: authorization === undefined ? {} : { authorization } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  authMiddleware(req, res, next);
  const body = res.json.mock.calls[0]?.[0];
  return { req, res, next, status: res.status.mock.calls[0]?.[0], message: body?.message };
};

describe("authMiddleware", () => {
  afterEach(() => {
    process.env.JWT_SECRET = SECRET;
    jest.restoreAllMocks();
  });

  test("P1 no Authorization header -> 401 required", () => {
    const r = run(undefined);
    expect([r.status, r.message]).toEqual([401, "Authorization token is required"]);
    expect(r.next).not.toHaveBeenCalled();
  });

  test("P2 header without the Bearer scheme -> 401 required", () => {
    expect(run("Basic dXNlcjpwYXNz").status).toBe(401);
  });

  test("P3 'Bearer ' with an empty token -> 401 required", () => {
    expect(run("Bearer ").message).toBe("Authorization token is required");
  });

  test("P4 valid token -> next() with req.userId", () => {
    const r = run(`Bearer ${jwt.sign({ id: "user-1" }, SECRET)}`);
    expect(r.next).toHaveBeenCalledTimes(1);
    expect(r.req.userId).toBe("user-1");
  });

  test("P5 JWT_SECRET not configured -> 500", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.JWT_SECRET;
    expect(run("Bearer abc")).toMatchObject({ status: 500, message: "Server error" });
  });

  test("P6 expired token -> 401 expired", () => {
    const token = jwt.sign({ id: "u" }, SECRET, { expiresIn: -10 });
    expect(run(`Bearer ${token}`)).toMatchObject({ status: 401, message: "Authorization token has expired" });
  });

  test("P7 wrong signature -> 401 invalid", () => {
    const token = jwt.sign({ id: "u" }, "another-secret");
    expect(run(`Bearer ${token}`)).toMatchObject({ status: 401, message: "Invalid authorization token" });
  });

  test("P8 token not active yet (nbf) -> 401 invalid (DEF-007)", () => {
    const token = jwt.sign({ id: "u" }, SECRET, { notBefore: "1h" });
    expect(run(`Bearer ${token}`)).toMatchObject({ status: 401, message: "Invalid authorization token" });
  });

  test("malformed token string -> 401 invalid", () => {
    expect(run("Bearer not.a.jwt").status).toBe(401);
  });
});
