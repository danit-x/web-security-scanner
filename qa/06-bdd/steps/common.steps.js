// Steps shared by every feature: response status and error message checks.
const assert = require("node:assert/strict");
const { fromServer } = require("../support/server");
const { Given, Then } = fromServer("@cucumber/cucumber");

Given(
  "a registered user {string} with email {string} and password {string}",
  async function (name, email, password) {
    await this.createUser(name, email, password);
  },
);

Then("the response status should be {int}", function (status) {
  assert.equal(this.response.status, status, `body: ${JSON.stringify(this.response.body)}`);
});

Then("the error message should be {string}", function (message) {
  assert.equal(this.response.body.message, message);
});

Then("the response should not reveal a stack trace", function () {
  const text = JSON.stringify(this.response.body);
  assert.doesNotMatch(text, /\bat .+\.js:\d+/, "response contains a stack trace");
  assert.equal(this.response.body.stack, undefined);
});
