// Small helpers for API-level tests (supertest against the in-process app).
const request = require("supertest");
const app = require("@server/app");

let counter = 0;
const uniqueEmail = (tag = "jest") => `qa.${tag}.${Date.now()}.${++counter}@example.com`;
const PASSWORD = "Passw0rd1";

async function registerUser(overrides = {}) {
  const body = { name: "Jest User", email: uniqueEmail(), password: PASSWORD, ...overrides };
  const res = await request(app).post("/api/auth/register").send(body);
  return { res, token: res.body.token, user: res.body.user, body };
}

module.exports = { app, request, uniqueEmail, registerUser, PASSWORD };
