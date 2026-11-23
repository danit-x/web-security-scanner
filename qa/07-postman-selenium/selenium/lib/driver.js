// Builds the Chrome WebDriver session used by every test.
//   headless by default; set HEADED=1 to watch the browser.
// Selenium Manager (bundled with selenium-webdriver) finds or downloads a
// chromedriver that matches the installed Chrome, so no driver is committed.
const { Builder, Browser } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

// The API trusts one proxy hop and rate-limits per client IP. Every browser
// request comes from 127.0.0.1, so repeated runs would share one quota.
// A random X-Forwarded-For per session (added via the Chrome DevTools
// Protocol) gives each run its own "client".
const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 254) + 1).join(".")}`;

// mobile: true emulates a phone (viewport, pixel ratio, touch). A plain small
// window is not enough: headless Chrome will not go narrower than 500px.
async function buildDriver({ mobile = false } = {}) {
  const options = new chrome.Options().addArguments(
    "--window-size=1280,900",
    "--disable-search-engine-choice-screen",
    "--no-first-run",
  );
  if (mobile) options.setMobileEmulation({ deviceMetrics: { width: 375, height: 812, pixelRatio: 3, touch: true } });
  if (!process.env.HEADED) options.addArguments("--headless=new");

  const driver = await new Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
  await driver.sendDevToolsCommand("Network.enable", {});
  await driver.sendDevToolsCommand("Network.setExtraHTTPHeaders", {
    headers: { "X-Forwarded-For": randomIp() },
  });
  return driver;
}

module.exports = { buildDriver };
