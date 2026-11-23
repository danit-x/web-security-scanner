// Test-data setup through the API (not the UI). Arranging state via the API is
// faster and more reliable; the UI is then used only for the behaviour under test.
const { API_URL, FIXTURE_URL, PASSWORD } = require("./config");

const ip = `10.250.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
let n = 0;
const uniqueEmail = (tag) => `ui.${tag}.${Date.now().toString(36)}.${++n}@example.com`;

async function call(method, path, body, token) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

// Returns { name, email, password, token, user } for a brand-new account.
async function createUser(tag = "user", name = "UI Tester") {
  const email = uniqueEmail(tag);
  const res = await call("POST", "/auth/register", { name, email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`createUser failed: ${res.status} ${res.body.message}`);
  return { name, email, password: PASSWORD, token: res.body.token, user: res.body.user };
}

async function createScan(user) {
  const res = await call("POST", "/scan", { url: FIXTURE_URL, ownershipConfirmed: true }, user.token);
  if (res.status !== 200) throw new Error(`createScan failed: ${res.status} ${res.body.message}`);
  return res.body;
}

async function history(user) {
  return (await call("GET", "/history", undefined, user.token)).body.scans;
}

module.exports = { createUser, createScan, history, uniqueEmail };
