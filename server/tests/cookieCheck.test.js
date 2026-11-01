const test = require("node:test");
const assert = require("node:assert/strict");
const checkCookies = require("../utils/checks/cookieCheck");

const categories = (findings) => findings.map((finding) => finding.category);

test("no cookies produces no findings", () => {
  assert.deepEqual(checkCookies(undefined, true), []);
});

test("a fully protected cookie produces no findings", () => {
  const cookie = "sid=abc; Path=/; Secure; HttpOnly; SameSite=Strict";
  assert.deepEqual(checkCookies([cookie], true), []);
});

test("an unprotected cookie on HTTPS is missing all three protections", () => {
  assert.deepEqual(categories(checkCookies(["sid=abc; Path=/"], true)), [
    "Cookie Missing Secure Flag",
    "Cookie Missing HttpOnly Flag",
    "Cookie Missing SameSite Attribute",
  ]);
});

test("the Secure flag is not required on a plain HTTP site", () => {
  const cookie = "sid=abc; HttpOnly; SameSite=Lax";
  assert.deepEqual(checkCookies([cookie], false), []);
});

test("SameSite=None is reported as low severity", () => {
  const cookie = "sid=abc; Secure; HttpOnly; SameSite=None";
  const findings = checkCookies([cookie], true);
  assert.deepEqual(categories(findings), ["Cookie Uses SameSite=None"]);
  assert.equal(findings[0].severity, "LOW");
});
