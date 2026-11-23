// Steps for registration.feature and login.feature.
const assert = require("node:assert/strict");
const { fromServer } = require("../support/server");
const { When, Then } = fromServer("@cucumber/cucumber");
const User = fromServer("./models/user");

// ---------- When ----------

When(
  "I register as {string} with email {string} and password {string}",
  async function (name, email, password) {
    await this.send("post", "/api/auth/register", { name, email, password });
  },
);

When(
  "I register with a JSON body where the password is the number {int}",
  async function (password) {
    await this.send("post", "/api/auth/register", { name: "Num", email: "num@example.com", password });
  },
);

When("I log in with email {string} and password {string}", async function (email, password) {
  await this.send("post", "/api/auth/login", { email, password });
});

When("I send a truncated JSON body to the login endpoint", async function () {
  this.response = await this.call("post", "/api/auth/login")
    .set("Content-Type", "application/json")
    .send('{"email": "alice@example.com", ');
});

When("I request my profile with the token {string}", async function (token) {
  this.response = await this.call("get", "/api/auth/me").set("Authorization", `Bearer ${token}`);
});

When("I fail to log in {int} times in a row", async function (times) {
  for (let i = 0; i < times; i += 1) {
    const res = await this.send("post", "/api/auth/login", { email: "alice@example.com", password: `Wrong${i}pass` });
    assert.equal(res.status, 401, `attempt ${i + 1} should fail normally`);
  }
});

// ---------- Then ----------

Then("I should receive an authentication token", function () {
  const { token } = this.response.body;
  assert.match(token, /^[\w-]+\.[\w-]+\.[\w-]+$/, "token should be a JWT");
  this.lastToken = token;
});

Then("I should not receive an authentication token", function () {
  assert.equal(this.response.body.token, undefined);
});

Then("the returned user should have the name {string} and email {string}", function (name, email) {
  assert.equal(this.response.body.user.name, name);
  assert.equal(this.response.body.user.email, email);
});

Then("the response should not contain a password", function () {
  assert.doesNotMatch(JSON.stringify(this.response.body), /password/i);
});

Then(
  "the account for {string} should store a bcrypt hash instead of {string}",
  async function (email, plain) {
    const user = await User.findOne({ email }).lean();
    assert.ok(user, "account should exist");
    assert.notEqual(user.password, plain);
    assert.match(user.password, /^\$2[aby]\$10\$.{53}$/, "bcrypt hash, cost 10");
  },
);

Then("no account should exist for {string}", async function (email) {
  assert.equal(await User.countDocuments({ email: email.toLowerCase() }), 0);
});

Then("that token should let me view my profile as {string}", async function (name) {
  const res = await this.call("get", "/api/auth/me").set("Authorization", `Bearer ${this.lastToken}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.name, name);
});
