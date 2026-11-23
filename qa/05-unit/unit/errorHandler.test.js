// Unit tests for middleware/errorHandler.js (V(G) = 11) and asyncHandler.
const { notFound, errorHandler } = require("@server/middleware/errorHandler");
const asyncHandler = require("@server/utils/asyncHandler");

const mockRes = (statusCode = 200) => {
  const res = { statusCode, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((b) => { res.body = b; return res; });
  return res;
};
const handle = (err, res = mockRes()) => {
  errorHandler(err, { method: "GET", originalUrl: "/x" }, res, () => {});
  return res;
};
const named = (name, props = {}) => Object.assign(new Error(name), { name }, props);

describe("errorHandler", () => {
  const env = process.env.NODE_ENV;
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => { process.env.NODE_ENV = env; jest.restoreAllMocks(); });

  test.each([
    ["plain Error", new Error("boom"), 500, "boom"],
    ["error with status 400 (DEF-002)", Object.assign(new Error("bad"), { status: 400 }), 400, "bad"],
    ["error with statusCode 403", Object.assign(new Error("no"), { statusCode: 403 }), 403, "no"],
    ["malformed JSON body", Object.assign(new Error("Unexpected end"), { status: 400, type: "entity.parse.failed" }), 400, "Malformed JSON in request body"],
    ["Mongoose ValidationError", named("ValidationError", { errors: { a: { message: "A bad" }, b: { message: "B bad" } } }), 400, "A bad, B bad"],
    ["Mongoose CastError", named("CastError"), 400, "Invalid ID format"],
    ["duplicate key", Object.assign(new Error("dup"), { code: 11000 }), 400, "Duplicate value entered for a unique field"],
    ["JsonWebTokenError", named("JsonWebTokenError"), 401, "Invalid authorization token"],
    ["TokenExpiredError", named("TokenExpiredError"), 401, "Authorization token has expired"],
    ["error without a message", Object.assign(new Error(), { message: "" }), 500, "Server error"],
  ])("%s -> %i", (_label, err, status, message) => {
    const res = handle(err);
    expect(res.statusCode).toBe(status);
    expect(res.body).toMatchObject({ success: false, message });
  });

  test("out-of-range err.status is ignored", () => {
    expect(handle(Object.assign(new Error("x"), { status: 200 })).statusCode).toBe(500);
  });

  test("a status already set on the response (notFound) is kept", () => {
    expect(handle(new Error("Route not found"), mockRes(404)).statusCode).toBe(404);
  });

  test("development: stack only on 5xx, never on 4xx", () => {
    process.env.NODE_ENV = "development";
    expect(handle(new Error("boom")).body).toHaveProperty("stack");
    expect(handle(Object.assign(new Error("bad"), { status: 400 })).body).not.toHaveProperty("stack");
  });

  test("production: never a stack trace", () => {
    process.env.NODE_ENV = "production";
    expect(handle(new Error("boom")).body).not.toHaveProperty("stack");
  });
});

describe("notFound", () => {
  test("sets 404 and forwards an error naming the URL", () => {
    const res = mockRes();
    const next = jest.fn();
    notFound({ originalUrl: "/api/nope" }, res, next);
    expect(res.statusCode).toBe(404);
    expect(next.mock.calls[0][0].message).toBe("Route not found: /api/nope");
  });
});

describe("asyncHandler", () => {
  test("forwards a rejected promise to next()", async () => {
    const err = new Error("async boom");
    const next = jest.fn();
    await asyncHandler(async () => { throw err; })({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
