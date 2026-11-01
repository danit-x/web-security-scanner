const test = require("node:test");
const assert = require("node:assert/strict");
const { validationResult } = require("express-validator");
const {
  scanValidationRules,
  noteValidationRules,
} = require("../validators/scanValidators");

const runRules = async (rules, body) => {
  const req = { body };
  for (const rule of rules) {
    await rule.run(req);
  }
  return validationResult(req);
};

// SSRF protection only runs in production, so these tests switch to it and
// restore the original value afterwards.
const inProduction = async (fn) => {
  const original = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await fn();
  } finally {
    process.env.NODE_ENV = original;
  }
};

const blockedTargets = [
  "http://localhost:3000",
  "http://127.0.0.1",
  "http://10.0.0.5",
  "http://172.16.0.1",
  "http://192.168.1.1",
  "http://169.254.169.254/latest/meta-data",
];

for (const url of blockedTargets) {
  test(`production blocks the internal target ${url}`, async () => {
    await inProduction(async () => {
      const result = await runRules(scanValidationRules, { url });
      assert.equal(result.isEmpty(), false);
    });
  });
}

test("a URL without http or https is rejected", async () => {
  const result = await runRules(scanValidationRules, { url: "example.com" });
  assert.equal(result.isEmpty(), false);
});

test("a missing URL is rejected", async () => {
  const result = await runRules(scanValidationRules, {});
  assert.equal(result.array()[0].msg, "A URL is required");
});

test("a note of up to 500 characters is accepted", async () => {
  const result = await runRules(noteValidationRules, {
    note: "a".repeat(500),
  });
  assert.equal(result.isEmpty(), true);
});

test("an empty note is accepted so a note can be cleared", async () => {
  const result = await runRules(noteValidationRules, { note: "" });
  assert.equal(result.isEmpty(), true);
});

test("a note over 500 characters is rejected", async () => {
  const result = await runRules(noteValidationRules, {
    note: "a".repeat(501),
  });
  assert.equal(result.isEmpty(), false);
});

test("a note that is not text is rejected", async () => {
  const result = await runRules(noteValidationRules, { note: { $set: "x" } });
  assert.equal(result.isEmpty(), false);
});
