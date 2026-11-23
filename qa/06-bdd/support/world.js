// The World is Cucumber's per-scenario context object: every step in one
// scenario sees the same `this`, and a fresh World is built for the next one.
require("./env");
const { fromServer } = require("./server");
const { setWorldConstructor, World } = fromServer("@cucumber/cucumber");
const request = fromServer("supertest");
const app = fromServer("./app");

let ipCounter = 0;

class ApiWorld extends World {
  constructor(options) {
    super(options);
    this.users = {}; // name -> { email, password, token, id }
    this.scans = {}; // label -> scan id
    this.response = null;
    // The app trusts one proxy hop, so X-Forwarded-For is the client IP the
    // rate limiters see. A new IP per scenario keeps scenarios independent.
    ipCounter += 1;
    this.clientIp = `198.51.100.${ipCounter % 250 + 1}`;
  }

  // Build a request with the scenario's client IP and (optionally) a user's token.
  call(method, url, asUser) {
    let req = request(app)[method](url).set("X-Forwarded-For", this.clientIp);
    if (asUser) req = req.set("Authorization", `Bearer ${this.users[asUser].token}`);
    return req;
  }

  async send(method, url, body, asUser) {
    let req = this.call(method, url, asUser);
    if (body !== undefined) req = req.send(body);
    this.response = await req;
    return this.response;
  }

  // Register through the real API (black-box: no direct DB writes).
  async createUser(name, email, password) {
    const res = await this.call("post", "/api/auth/register").send({ name, email, password });
    if (res.status !== 201) throw new Error(`could not create ${name}: ${res.status} ${res.body.message}`);
    this.users[name] = { email, password, token: res.body.token, id: res.body.user._id };
  }
}

setWorldConstructor(ApiWorld);
