const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-only-secret";

const authMiddleware = require("../middleware/authMiddleware");

const run = (authorization) => {
  const req = { headers: { authorization } };
  const res = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let nextCalled = false;
  authMiddleware(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
};

test("a valid token passes and sets req.userId", () => {
  const token = jwt.sign({ id: "user-1" }, process.env.JWT_SECRET);
  const { req, nextCalled } = run(`Bearer ${token}`);
  assert.equal(nextCalled, true);
  assert.equal(req.userId, "user-1");
});

test("a missing token returns 401", () => {
  const { res, nextCalled } = run(undefined);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("a token signed with another secret returns 401", () => {
  const token = jwt.sign({ id: "user-1" }, "another-secret");
  const { res, nextCalled } = run(`Bearer ${token}`);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("an expired token returns 401", () => {
  const token = jwt.sign({ id: "user-1" }, process.env.JWT_SECRET, {
    expiresIn: -10,
  });
  const { res, nextCalled } = run(`Bearer ${token}`);
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});
