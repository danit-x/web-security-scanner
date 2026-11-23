// Selenium UI tests: TC-UI-01..10 from qa/02-stlc/test-cases.md.
// Run (qa-db, qa-api, qa-client, qa-fixture must be running):
//   npm test --prefix qa/07-postman-selenium/selenium
//   $env:HEADED=1; npm test --prefix qa/07-postman-selenium/selenium   # watch it
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildDriver } = require("../lib/driver");
const api = require("../lib/api");
const { FIXTURE_URL, PASSWORD } = require("../lib/config");
const { RegisterPage, LoginPage, NavBar, DashboardPage, ReportPage, HistoryPage } = require("../pages/pages");

const SHOTS = path.resolve(__dirname, "../../../evidence/selenium");
fs.mkdirSync(SHOTS, { recursive: true });

describe("Website Security Scanner UI (Selenium WebDriver, Chrome)", function () {
  let driver;

  beforeEach(async function () {
    // TC-UI-10 needs a phone-sized window; everything else runs at desktop size.
    driver = await buildDriver({ mobile: /TC-UI-10/.test(this.currentTest.title) });
  });

  // Evidence: one screenshot per test, prefixed FAIL- when it failed.
  afterEach(async function () {
    if (!driver) return;
    const id = this.currentTest.title.split(":")[0].trim();
    const prefix = this.currentTest.state === "failed" ? "FAIL-" : "";
    try {
      fs.writeFileSync(path.join(SHOTS, `${prefix}${id}.png`), await driver.takeScreenshot(), "base64");
    } finally {
      await driver.quit();
      driver = null;
    }
  });

  it("TC-UI-01: register with mismatched passwords shows an error and sends nothing", async function () {
    const page = new RegisterPage(driver);
    await page.open();
    await page.register({ name: "Mismatch", email: api.uniqueEmail("mm"), password: PASSWORD, confirm: "Different1" });

    assert.match(await page.waitForText("Passwords do not match."), /Passwords do not match\./i);
    assert.equal(await page.path(), "/register");
    const calls = await driver.executeScript(
      "return performance.getEntriesByType('resource').filter(e => e.name.includes('/api/auth/register')).length;",
    );
    assert.equal(calls, 0, "no registration request should reach the API");
  });

  it("TC-UI-02: successful registration redirects to the dashboard and shows the user", async function () {
    const page = new RegisterPage(driver);
    await page.open();
    await page.register({ name: "Rita Register", email: api.uniqueEmail("reg"), password: PASSWORD });

    assert.equal(await page.waitForPath(/^\/dashboard$/), "/dashboard");
    assert.equal(await new NavBar(driver).userName(), "Rita Register");
    assert.ok(await page.localStorageItem("token"), "token stored after registration");
  });

  it("TC-UI-03: login with a wrong password shows the error and stays on /login", async function () {
    const user = await api.createUser("badpw");
    const page = new LoginPage(driver);
    await page.open();
    await page.login(user.email, "WrongPass1");

    assert.match(await page.waitForText("Invalid email or password"), /Invalid email or password/i);
    assert.equal(await page.path(), "/login");
    assert.equal(await page.localStorageItem("token"), null);
  });

  it("TC-UI-04: a logged-out visitor opening /history is sent to /login", async function () {
    const page = new HistoryPage(driver);
    await page.open();
    assert.equal(await page.waitForPath(/^\/login$/), "/login");
  });

  it("TC-UI-05: scanning without ticking the ownership box is refused and creates no scan", async function () {
    const user = await api.createUser("noown");
    const page = new DashboardPage(driver);
    await page.loginWithToken(user);
    await page.open();
    await page.scan(FIXTURE_URL, { confirmOwnership: false });

    await page.waitForText("Please confirm you own or have permission to scan this site.");
    assert.equal(await page.path(), "/dashboard");
    assert.equal((await api.history(user)).length, 0, "no scan should be saved");
  });

  it("TC-UI-06: scanning the fixture site shows the report with grade, score and severity pills", async function () {
    const user = await api.createUser("scan");
    const page = new DashboardPage(driver);
    await page.loginWithToken(user);
    await page.open();
    await page.scan(FIXTURE_URL, { confirmOwnership: true });

    await page.waitForPath(/^\/report\/[a-f0-9]{24}$/);
    const report = new ReportPage(driver);
    const { grade, score } = await report.grade();
    assert.match(grade, /^[A-F]$/);
    assert.ok(score >= 0 && score <= 100);
    assert.deepEqual(await report.summaryPills(), { Critical: true, High: true, Medium: true, Low: true });

    const [saved] = await api.history(user);
    assert.equal(await report.path(), `/report/${saved._id}`);
    assert.deepEqual({ grade, score }, { grade: saved.grade, score: saved.score }, "UI matches the stored scan");
  });

  it("TC-UI-07: a saved note is still there after reloading the page", async function () {
    const user = await api.createUser("note");
    const scan = await api.createScan(user);
    const report = new ReportPage(driver);
    await report.loginWithToken(user);
    await report.open(`/report/${scan._id}`);

    await report.saveNoteText("Fix the missing CSP header first");
    await driver.navigate().refresh();
    assert.equal(await report.noteValue(), "Fix the missing CSP header first");
  });

  it("TC-UI-08: delete asks for confirmation; Cancel keeps the row, OK removes it", async function () {
    const user = await api.createUser("del");
    await api.createScan(user);
    const page = new HistoryPage(driver);
    await page.loginWithToken(user);
    await page.open();
    await page.waitForRows(1);

    const prompt = await page.deleteFirst({ confirm: false });
    assert.match(prompt, /This cannot be undone/);
    assert.equal(await page.rowCount(), 1, "Cancel keeps the row");
    assert.equal((await api.history(user)).length, 1);

    await page.deleteFirst({ confirm: true });
    await page.waitForRows(0);
    assert.equal((await api.history(user)).length, 0, "OK deletes it on the server too");
  });

  it("TC-UI-09: logout clears the session and protects the dashboard again", async function () {
    const user = await api.createUser("logout");
    const nav = new NavBar(driver);
    await nav.loginWithToken(user);
    await nav.open("/dashboard");
    await nav.logout();

    assert.equal(await nav.waitForPath(/^\/login$/), "/login");
    assert.equal(await nav.localStorageItem("token"), null);
    assert.equal(await nav.localStorageItem("user"), null);
    await nav.open("/dashboard");
    assert.equal(await nav.waitForPath(/^\/login$/), "/login");
  });

  // OBS-06 (found in phase 7): the form allowed 6-char passwords while the API
  // requires 8, so the browser let through passwords the server always rejects.
  it("TC-UI-11: the register form enforces the same 8-character minimum as the API (OBS-06)", async function () {
    const page = new RegisterPage(driver);
    await page.open();
    for (const locator of [page.password, page.confirm]) {
      assert.equal(await (await page.visible(locator)).getAttribute("minLength"), "8");
    }
    await page.register({ name: "Shorty", email: api.uniqueEmail("short"), password: "Abcde12" }); // 7 chars
    const valid = await driver.executeScript("return document.getElementById('register-password').validity.valid;");
    assert.equal(valid, false, "browser validation blocks a 7-character password");
    assert.equal(await page.path(), "/register");
  });

  it("TC-UI-10: the login page fits a 375x812 phone screen and is usable", async function () {
    const page = new LoginPage(driver);
    await page.open();
    const { inner, scroll } = await driver.executeScript(
      "return { inner: window.innerWidth, scroll: document.documentElement.scrollWidth };",
    );
    assert.equal(inner, 375, "viewport is phone width");
    assert.ok(scroll <= inner, `no horizontal scroll (page is ${scroll}px wide)`);

    for (const locator of [page.email, page.password, page.submit]) {
      const rect = await (await page.visible(locator)).getRect();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= inner, "control fully on screen");
    }
    const user = await api.createUser("mobile");
    await page.login(user.email, user.password);
    assert.equal(await page.waitForPath(/^\/dashboard$/), "/dashboard");
  });
});
