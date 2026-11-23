// Steps for scan.feature and scan-history.feature.
const assert = require("node:assert/strict");
const { fromServer } = require("../support/server");
const { Given, When, Then } = fromServer("@cucumber/cucumber");
const ScanResult = fromServer("./models/ScanResults");

const scanBody = (url, ownershipConfirmed = true) => ({ url, ownershipConfirmed });

// Resolve a scan label from the scenario (e.g. "alice-scan") to its id.
// Unknown labels are passed through, so "not-an-id" tests a malformed id.
function scanId(world, label) {
  return world.scans[label] || label;
}

// ---------- Given ----------

Given("{string} has scanned the test website, saved as {string}", async function (user, label) {
  const res = await this.call("post", "/api/scan", user).send(scanBody(`${this.site.url}/`));
  assert.equal(res.status, 200, `setup scan failed: ${JSON.stringify(res.body)}`);
  this.scans[label] = res.body._id;
});

// ---------- When: scanning ----------

When("{string} scans the test website with ownership confirmed", async function (user) {
  await this.send("post", "/api/scan", scanBody(`${this.site.url}/`), user);
});

When("{string} scans the test website path {string} with ownership confirmed", async function (user, path) {
  await this.send("post", "/api/scan", scanBody(`${this.site.url}${path}`), user);
});

When("{string} scans the test website without confirming ownership", async function (user) {
  await this.send("post", "/api/scan", scanBody(`${this.site.url}/`, false), user);
});

When("{string} scans the address {string} with ownership confirmed", async function (user, url) {
  await this.send("post", "/api/scan", scanBody(url), user);
});

When("an anonymous visitor scans the test website", async function () {
  await this.send("post", "/api/scan", scanBody(`${this.site.url}/`));
});

// ---------- When: history ----------

When("{string} opens the scan history", async function (user) {
  await this.send("get", "/api/history", undefined, user);
});

When("{string} adds the note {string} to {string}", async function (user, note, label) {
  await this.send("patch", `/api/history/${scanId(this, label)}`, { note }, user);
});

When("{string} adds a note of {int} characters to {string}", async function (user, length, label) {
  await this.send("patch", `/api/history/${scanId(this, label)}`, { note: "n".repeat(length) }, user);
});

When("{string} deletes {string}", async function (user, label) {
  await this.send("delete", `/api/history/${scanId(this, label)}`, undefined, user);
});

// "tries to view / add a note / delete" drives the IDOR scenario outline.
When(/^"([^"]+)" tries to (view|add a note|delete) "([^"]+)"$/, async function (user, action, label) {
  const url = `/api/history/${scanId(this, label)}`;
  if (action === "view") await this.send("get", url, undefined, user);
  if (action === "add a note") await this.send("patch", url, { note: "hacked" }, user);
  if (action === "delete") await this.send("delete", url, undefined, user);
});

// ---------- Then: scan report ----------

Then("the report should have a grade from A to F and a score from 0 to 100", function () {
  const { grade, score } = this.response.body;
  assert.match(grade, /^[A-F]$/);
  assert.ok(Number.isInteger(score) && score >= 0 && score <= 100, `score was ${score}`);
});

Then("the report should be saved in the history of {string}", async function (user) {
  const saved = await ScanResult.findById(this.response.body._id).lean();
  assert.ok(saved, "scan should be stored");
  assert.equal(String(saved.userId), this.users[user].id);
});

Then("the report should include a {string} finding", function (category) {
  const categories = this.response.body.findings.map((f) => f.category);
  assert.ok(categories.includes(category), `found only: ${[...new Set(categories)].join(", ")}`);
});

Then("the report should say it was redirected to the test website home page", function () {
  assert.equal(this.response.body.redirected, true);
  assert.equal(this.response.body.finalUrl, `${this.site.url}/`);
});

// ---------- Then: history ----------

Then("the history should list exactly {string} in that order", function (labels) {
  const expected = labels.split(",").map((l) => this.scans[l.trim()]);
  assert.deepEqual(this.response.body.scans.map((s) => s._id), expected);
  assert.equal(this.response.body.count, expected.length);
});

Then("{string} should have the note {string}", async function (label, note) {
  assert.equal((await ScanResult.findById(scanId(this, label)).lean()).note, note);
});

Then("{string} should no longer exist", async function (label) {
  assert.equal(await ScanResult.exists({ _id: scanId(this, label) }), null);
});

Then("{string} should still exist without a note", async function (label) {
  const scan = await ScanResult.findById(scanId(this, label)).lean();
  assert.ok(scan, "scan should still exist");
  assert.ok(!scan.note, `note was changed to "${scan.note}"`);
});
