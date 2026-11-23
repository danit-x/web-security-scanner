// Page Object Model: one class per page. Each holds that page's locators and
// the actions a user can take there, so tests read like user stories and a UI
// change means editing one class, not every test.
const { By, until } = require("selenium-webdriver");
const { CLIENT_URL, WAIT_MS } = require("../lib/config");

// The app has no data-testid attributes, so locators prefer, in order:
// element ids, then accessible text/roles, never brittle CSS class chains.
const byText = (tag, text) => By.xpath(`//${tag}[normalize-space(.)=${JSON.stringify(text)}]`);
const containsText = (text) => By.xpath(`//*[contains(normalize-space(.), ${JSON.stringify(text)}) and not(*[contains(normalize-space(.), ${JSON.stringify(text)})])]`);

class BasePage {
  constructor(driver) {
    this.driver = driver;
  }

  async open(path) {
    await this.driver.get(`${CLIENT_URL}${path}`);
    return this;
  }

  // Explicit waits: wait for a condition, never sleep for a fixed time.
  find(locator) {
    return this.driver.wait(until.elementLocated(locator), WAIT_MS);
  }

  async visible(locator) {
    const el = await this.find(locator);
    return this.driver.wait(until.elementIsVisible(el), WAIT_MS);
  }

  async type(locator, text) {
    const el = await this.visible(locator);
    await el.clear();
    await el.sendKeys(text);
  }

  async click(locator) {
    await (await this.visible(locator)).click();
  }

  async waitForPath(regex) {
    await this.driver.wait(async () => regex.test(new URL(await this.driver.getCurrentUrl()).pathname), WAIT_MS);
    return new URL(await this.driver.getCurrentUrl()).pathname;
  }

  async path() {
    return new URL(await this.driver.getCurrentUrl()).pathname;
  }

  async waitForText(text) {
    return (await this.visible(containsText(text))).getText();
  }

  // Log in without the UI: store the token exactly as AuthContext.login does.
  async loginWithToken(user) {
    await this.open("/login");
    await this.driver.executeScript(
      "localStorage.setItem('token', arguments[0]); localStorage.setItem('user', arguments[1]);",
      user.token,
      JSON.stringify(user.user),
    );
  }

  localStorageItem(key) {
    return this.driver.executeScript("return localStorage.getItem(arguments[0]);", key);
  }
}

module.exports = { BasePage, byText, containsText, By, until };
