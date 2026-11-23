// Page objects for the five pages under test.
const { BasePage, byText, containsText, By, until } = require("./BasePage");
const { WAIT_MS } = require("../lib/config");

class RegisterPage extends BasePage {
  name = By.id("register-name");
  email = By.id("register-email");
  password = By.id("register-password");
  confirm = By.id("register-confirm-password");
  submit = By.css("form button[type='submit']");

  open() {
    return super.open("/register");
  }

  async register({ name, email, password, confirm = password }) {
    await this.type(this.name, name);
    await this.type(this.email, email);
    await this.type(this.password, password);
    await this.type(this.confirm, confirm);
    await this.click(this.submit);
  }
}

class LoginPage extends BasePage {
  email = By.id("login-email");
  password = By.id("login-password");
  submit = By.css("form button[type='submit']");

  open() {
    return super.open("/login");
  }

  async login(email, password) {
    await this.type(this.email, email);
    await this.type(this.password, password);
    await this.click(this.submit);
  }
}

class NavBar extends BasePage {
  // Desktop navbar; the mobile menu has its own copy of these.
  userBadge = By.xpath("//nav//span[starts-with(normalize-space(.), 'User:')]");
  logoutButton = byText("button", "Logout");

  // textContent, not getText(): getText() returns the *rendered* text, and the
  // navbar's CSS `uppercase` would turn "Rita" into "RITA".
  async userName() {
    const raw = await (await this.visible(this.userBadge)).getAttribute("textContent");
    return raw.replace(/^User:\s*/, "").trim();
  }

  logout() {
    return this.click(this.logoutButton);
  }
}

class DashboardPage extends BasePage {
  url = By.id("scan-url");
  ownership = By.css("input[type='checkbox']");
  submit = By.css("form button[type='submit']");

  open() {
    return super.open("/dashboard");
  }

  async scan(url, { confirmOwnership }) {
    await this.type(this.url, url);
    const box = await this.visible(this.ownership);
    if ((await box.isSelected()) !== confirmOwnership) await box.click();
    await this.click(this.submit);
  }
}

class ReportPage extends BasePage {
  // GradeBadge renders "<grade>" and "<score>/100" in one block.
  gradeBadge = By.xpath("//span[contains(@class,'font-mono') and contains(., '/100')]/..");
  note = By.id("scan-note");
  saveNote = byText("button", "Save Note");

  async grade() {
    const text = await (await this.visible(this.gradeBadge)).getText();
    const [, grade, score] = text.match(/([A-F])\s*(\d+)\/100/) || [];
    return { grade, score: Number(score) };
  }

  async summaryPills() {
    const labels = ["Critical", "High", "Medium", "Low"];
    const out = {};
    for (const label of labels) out[label] = await (await this.visible(containsText(label))).isDisplayed();
    return out;
  }

  async saveNoteText(text) {
    await this.type(this.note, text);
    await this.click(this.saveNote);
    await this.waitForText("Note saved.");
  }

  async noteValue() {
    return (await this.visible(this.note)).getAttribute("value");
  }
}

class HistoryPage extends BasePage {
  rows = By.css("div[role='button']");
  deleteButtons = byText("button", "Delete");

  open() {
    return super.open("/history");
  }

  async rowCount() {
    return (await this.driver.findElements(this.rows)).length;
  }

  async waitForRows(count) {
    await this.driver.wait(async () => (await this.rowCount()) === count, WAIT_MS);
  }

  // Click Delete on the first row and answer the browser confirm() dialog.
  async deleteFirst({ confirm }) {
    await this.click(this.deleteButtons);
    const alert = await this.driver.wait(until.alertIsPresent(), WAIT_MS);
    const text = await alert.getText();
    if (confirm) await alert.accept();
    else await alert.dismiss();
    return text;
  }
}

module.exports = { RegisterPage, LoginPage, NavBar, DashboardPage, ReportPage, HistoryPage };
