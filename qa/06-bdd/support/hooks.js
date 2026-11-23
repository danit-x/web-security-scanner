// Hooks: one throw-away database on the LOCAL MongoDB for the whole run,
// emptied before every scenario, plus a deliberately weak local website as
// the only scan target.
const { fromServer } = require("./server");
const { BeforeAll, AfterAll, Before, After, setDefaultTimeout } = fromServer("@cucumber/cucumber");
const mongoose = fromServer("mongoose");
const { startFixtureSite } = require("../../05-unit/helpers/fixtureSite");

setDefaultTimeout(30 * 1000);

const LOCAL = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;
const site = { url: null, close: null };

BeforeAll(async function () {
  const base = process.env.TEST_MONGO_URI;
  if (!LOCAL.test(base)) throw new Error(`Refusing to run BDD tests against a non-local MongoDB: ${base}`);
  await mongoose.connect(`${base.replace(/\/$/, "")}/websec_bdd_${Date.now()}`);
  Object.assign(site, await startFixtureSite());
});

AfterAll(async function () {
  if (site.close) await site.close();
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

Before(async function () {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
  this.site = site;
});

// @production scenarios run with the production-only SSRF guard switched on.
// The guard reads NODE_ENV on every request, so flipping it here is enough.
Before({ tags: "@production" }, function () {
  process.env.NODE_ENV = "production";
});
After({ tags: "@production" }, function () {
  process.env.NODE_ENV = "test";
});

// Attach the last response to the report when a scenario fails.
After(function ({ result }) {
  if (result.status === "FAILED" && this.response) {
    this.attach(
      JSON.stringify({ status: this.response.status, body: this.response.body }, null, 2),
      "application/json",
    );
  }
});
