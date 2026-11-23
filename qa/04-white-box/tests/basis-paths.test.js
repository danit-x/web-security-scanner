// qa/04-white-box/tests/basis-paths.test.js
// White-box (basis path) tests. One test per independent path through each
// unit's control-flow graph; path ids match qa/04-white-box/white-box-analysis.md.
//
// Run with coverage (from the repo root):
//   node --test --experimental-test-coverage --test-coverage-include="server/**" \
//        --test-coverage-exclude="server/tests/**" server/tests/*.test.js qa/04-white-box/tests/*.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createRequire } = require("node:module");

const server = path.resolve(__dirname, "../../../server");
const requireServer = createRequire(path.join(server, "package.json"));
const jwt = requireServer("jsonwebtoken");
const dns = requireServer("dns");
const { validationResult } = requireServer("express-validator");

const { calculateScore, scoreToGrade } = require(path.join(server, "utils/scoring"));
const authMiddleware = require(path.join(server, "middleware/authMiddleware"));
const { scanValidationRules } = require(path.join(server, "validators/scanValidators"));

// ---------------------------------------------------------------------------
// calculateScore: V(G) = 5
// ---------------------------------------------------------------------------
test("CS-P1 findings is not an array -> early return 100", () => {
  assert.equal(calculateScore(null), 100);
});
test("CS-P2 empty array -> early return 100", () => {
  assert.equal(calculateScore([]), 100);
});
test("CS-P3 one known severity -> loop once, lookup hit", () => {
  assert.equal(calculateScore([{ severity: "HIGH" }]), 85);
});
test("CS-P4 unknown severity -> lookup miss, `|| 0` branch", () => {
  assert.equal(calculateScore([{ severity: "UNKNOWN" }]), 100);
});
test("CS-P5 loop iterates several times and the floor applies", () => {
  assert.equal(calculateScore(Array(5).fill({ severity: "CRITICAL" })), 0);
});

// ---------------------------------------------------------------------------
// scoreToGrade: V(G) = 3
// ---------------------------------------------------------------------------
test("SG-P1 condition true on the first threshold -> A", () => {
  assert.equal(scoreToGrade(95), "A");
});
test("SG-P2 condition false, loop continues, later true -> D", () => {
  assert.equal(scoreToGrade(50), "D");
});
test("SG-P3 loop exhausted -> fallback return (the 'unreachable' line 64)", () => {
  // NaN >= 0 is false, so no threshold matches and the fallback runs.
  assert.equal(scoreToGrade(NaN), "F");
});

// ---------------------------------------------------------------------------
// authMiddleware: V(G) = 8
// ---------------------------------------------------------------------------
const SECRET = "whitebox-secret";
const runAuth = (authorization) => {
  const req = { headers: { authorization } };
  const res = {
    statusCode: null, body: null,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
  let nextCalled = false;
  authMiddleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
};
const withSecret = (value, fn) => {
  const original = process.env.JWT_SECRET;
  if (value === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = value;
  try { return fn(); } finally {
    if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original;
  }
};

test("AM-P1 header missing -> 401 required", () => withSecret(SECRET, () => {
  const { res, nextCalled } = runAuth(undefined);
  assert.equal(nextCalled, false);
  assert.deepEqual([res.statusCode, res.body.message], [401, "Authorization token is required"]);
}));
test("AM-P2 header present but not 'Bearer ' (second operand of ||) -> 401", () => withSecret(SECRET, () => {
  const { res } = runAuth("Basic dXNlcjpwYXNz");
  assert.deepEqual([res.statusCode, res.body.message], [401, "Authorization token is required"]);
}));
test("AM-P3 'Bearer ' with empty token -> second guard (line 12) -> 401", () => withSecret(SECRET, () => {
  const { res } = runAuth("Bearer ");
  assert.deepEqual([res.statusCode, res.body.message], [401, "Authorization token is required"]);
}));
test("AM-P4 valid token -> next() and req.userId set", () => withSecret(SECRET, () => {
  const token = jwt.sign({ id: "u1" }, SECRET);
  const { req, nextCalled } = runAuth(`Bearer ${token}`);
  assert.equal(nextCalled, true);
  assert.equal(req.userId, "u1");
}));
test("AM-P5 JWT_SECRET missing -> thrown Error -> generic 500 branch", () => {
  const original = console.error;
  console.error = () => {}; // keep the expected log line out of the test output
  try {
    withSecret(undefined, () => {
      const { res } = runAuth("Bearer anything");
      assert.deepEqual([res.statusCode, res.body.message], [500, "Server error"]);
    });
  } finally { console.error = original; }
});
test("AM-P6 expired token -> TokenExpiredError branch -> 401 expired", () => withSecret(SECRET, () => {
  const token = jwt.sign({ id: "u1" }, SECRET, { expiresIn: -10 });
  const { res } = runAuth(`Bearer ${token}`);
  assert.deepEqual([res.statusCode, res.body.message], [401, "Authorization token has expired"]);
}));
test("AM-P7 bad signature -> JsonWebTokenError branch -> 401 invalid", () => withSecret(SECRET, () => {
  const token = jwt.sign({ id: "u1" }, "some-other-secret");
  const { res } = runAuth(`Bearer ${token}`);
  assert.deepEqual([res.statusCode, res.body.message], [401, "Invalid authorization token"]);
}));
test("AM-P8 token not active yet (nbf in the future) -> should be 401, not 500", () => {
  // jsonwebtoken throws NotBeforeError (name 'NotBeforeError'), which matches
  // neither named branch, so it falls through to the generic 500 path.
  const original = console.error;
  console.error = () => {};
  try {
    withSecret(SECRET, () => {
      const token = jwt.sign({ id: "u1" }, SECRET, { notBefore: "1h" });
      const { res } = runAuth(`Bearer ${token}`);
      assert.equal(res.statusCode, 401, `got ${res.statusCode} ${res.body?.message}`);
    });
  } finally { console.error = original; }
});

// ---------------------------------------------------------------------------
// blockPrivateTargets (SSRF guard, run through the real validator chain): V(G) = 9
// ---------------------------------------------------------------------------
const runRules = async (body) => {
  const req = { body };
  for (const rule of scanValidationRules) await rule.run(req);
  return validationResult(req).array().map((e) => e.msg);
};
const withEnv = async (nodeEnv, fn) => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try { return await fn(); } finally { process.env.NODE_ENV = original; }
};
const withLookup = async (impl, fn) => {
  const original = dns.promises.lookup;
  dns.promises.lookup = impl; // the validator calls dns.promises.lookup at run time
  try { return await fn(); } finally { dns.promises.lookup = original; }
};

test("BP-P1 development -> guard returns true immediately (even for 10.0.0.5)", async () => {
  const errors = await withEnv("development", () => runRules({ url: "http://10.0.0.5" }));
  assert.deepEqual(errors, []);
});
test("BP-P3 production, ftp scheme (passes isURL) -> protocol branch", async () => {
  const errors = await withEnv("production", () => runRules({ url: "ftp://example.com" }));
  assert.deepEqual(errors, ["Only http and https URLs are allowed"]);
});
test("BP-P4 production, blocked hostname 0.0.0.0 -> BLOCKED_HOSTNAMES branch", async () => {
  const errors = await withEnv("production", () => runRules({ url: "http://0.0.0.0" }));
  assert.deepEqual(errors, ["Scanning localhost or internal hostnames is not allowed"]);
});
test("BP-P4b 'localhost' now reaches the guard and is blocked by the hostname rule (was: rejected by isURL, OBS-05/DEF-004 fixed)", async () => {
  const errors = await withEnv("production", () => runRules({ url: "http://localhost:3000" }));
  assert.deepEqual(errors, ["Scanning localhost or internal hostnames is not allowed"]);
});
test("BP-P5 production, private literal IPv4 -> literal-IP branch", async () => {
  const errors = await withEnv("production", () => runRules({ url: "http://10.0.0.5" }));
  assert.deepEqual(errors, ["Scanning private or internal IP addresses is not allowed"]);
});
test("BP-P6 production, domain resolving to a private IP -> DNS branch, rethrown", async () => {
  const errors = await withEnv("production", () =>
    withLookup(async () => ({ address: "10.1.2.3" }), () => runRules({ url: "http://rebind.example.com" })));
  assert.deepEqual(errors, ["This domain resolves to a private or internal IP address"]);
});
test("BP-P7 production, domain resolving to a public IP -> allowed", async () => {
  const errors = await withEnv("production", () =>
    withLookup(async () => ({ address: "93.184.216.34" }), () => runRules({ url: "http://public.example.com" })));
  assert.deepEqual(errors, []);
});
test("BP-P8 production, DNS lookup fails -> 'Could not resolve'", async () => {
  const errors = await withEnv("production", () =>
    withLookup(async () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }); },
      () => runRules({ url: "http://nope.example.com" })));
  assert.deepEqual(errors, ["Could not resolve the provided domain"]);
});
test("BP-X1 IPv6 loopback literal is now caught by the literal-IP branch (OBS-05 fixed)", async () => {
  // Before the fix, new URL('http://[::1]/').hostname kept its brackets, so
  // /^::1$/ never matched and the URL was only rejected because DNS failed.
  const errors = await withEnv("production", () => runRules({ url: "http://[::1]/" }));
  assert.deepEqual(errors, ["Scanning private or internal IP addresses is not allowed"]);
});
