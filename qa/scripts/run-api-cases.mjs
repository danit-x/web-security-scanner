// qa/scripts/run-api-cases.mjs
// Executes the API test cases from qa/02-stlc/test-cases.md against the REAL
// server code (started via start-test-api.js -> local MongoDB only) and
// records expected vs actual for every case.
//
//   node qa/scripts/run-api-cases.mjs
//
// Each group runs on a freshly started API so the in-memory rate limiters
// (5 logins / 10 scans / 100 requests per 15 min) start from zero.
// Output: qa/evidence/api-run-<timestamp>.json and qa/02-stlc/api-results.md

import fs from "node:fs";
import path from "node:path";
import {
  repo, requireServer, QA_SECRET, API_PORT, FIXTURE_URL, DEAD_URL,
  req, short, runGroups, createRecorder, writeEvidence, mdCell, loadJson,
} from "./lib/harness.mjs";

const jwt = requireServer("jsonwebtoken");
const ts = Date.now();
const data = loadJson("qa/test-data/users.json");
const email = (u) => `${u.emailPrefix}.${ts}@${u.domain}`;
const { results, record } = createRecorder();

const register = (u, overrides = {}) =>
  req("POST", "/auth/register", {
    body: { name: u.name, email: email(u), password: u.password, ...overrides },
  });
const scan = (token, url, ownershipConfirmed = true) =>
  req("POST", "/scan", { token, body: { url, ownershipConfirmed } });

// =====================================================================
// GROUP 1: register, session, scan, history, note, delete, hardening
// =====================================================================
async function group1() {
  const A = data.userA, B = data.userB, G = data.gmailUser;

  // ---- API hardening (health first = smoke test) ----
  let r = await req("GET", "/health");
  record("TC-API-01", "Health check", r.status === 200 && r.body.status === "ok", "200 {status:ok}", short(r));

  r = await req("GET", "/does-not-exist");
  record("TC-API-02", "Unknown route", r.status === 404 && r.body.success === false, "404 JSON success:false", short(r));

  r = await req("GET", "/health");
  const xcto = r.headers.get("x-content-type-options");
  const xfo = r.headers.get("x-frame-options");
  const xpb = r.headers.get("x-powered-by");
  record("TC-API-03", "Security headers present", xcto === "nosniff" && !!xfo && !xpb,
    "nosniff, X-Frame-Options set, no X-Powered-By",
    `X-Content-Type-Options=${xcto}, X-Frame-Options=${xfo}, X-Powered-By=${xpb}`);

  r = await req("GET", "/health", { headers: { Origin: "http://evil.example" } });
  const acao = r.headers.get("access-control-allow-origin");
  const hasStack = typeof r.body === "object" && "stack" in r.body;
  record("TC-API-04", "Disallowed CORS origin refused cleanly",
    !acao && r.status >= 400 && r.status < 500 && !hasStack,
    "4xx, no ACAO header, no stack trace",
    `${r.status}, ACAO=${acao}, stackInBody=${hasStack}, message=${r.body.message}`);

  r = await req("POST", "/auth/login", { raw: '{"email":' });
  const stack5 = typeof r.body === "object" && "stack" in r.body;
  record("TC-API-05", "Malformed JSON body", r.status === 400 && !stack5,
    "400 JSON, no stack trace", `${r.status}, stackInBody=${stack5}, message=${r.body.message}`);

  // ---- Registration ----
  const regA = await register(A);
  const okA = regA.status === 201 && regA.body.success && regA.body.token &&
    regA.body.user?._id && regA.body.user.email === email(A);
  record("TC-REG-01", "Register with valid data", !!okA, "201 + token + user", short(regA));
  const tokenA = regA.body.token, idA = regA.body.user?._id;

  r = await register(A);
  record("TC-REG-02", "Duplicate email rejected", r.status === 400 && r.body.message === "User already exists", "400 User already exists", short(r));

  r = await register({ ...A, emailPrefix: "qa.p7" }, { password: data.boundaries.password7 });
  record("TC-REG-03", "Password 7 chars rejected", r.status === 400 && /at least 8/.test(r.body.message), "400 at least 8 characters", short(r));

  r = await register({ ...A, emailPrefix: "qa.p8" }, { password: data.boundaries.password8 });
  record("TC-REG-04", "Password exactly 8 chars accepted", r.status === 201, "201", short(r));

  r = await register({ ...A, emailPrefix: "qa.nodigit" }, { password: data.boundaries.passwordNoDigit });
  record("TC-REG-05", "Password without digit rejected", r.status === 400 && /one number/.test(r.body.message), "400 one number", short(r));

  r = await req("POST", "/auth/register", { body: { name: "X", email: "user@", password: A.password } });
  record("TC-REG-06", "Invalid email rejected", r.status === 400 && /valid email/.test(r.body.message), "400 valid email", short(r));

  r = await register({ ...A, emailPrefix: "qa.blank" }, { name: "   " });
  record("TC-REG-07", "Whitespace-only name rejected", r.status === 400 && r.body.message === "Name is required", "400 Name is required", short(r));

  r = await register({ ...A, emailPrefix: "qa.n101" }, { name: "a".repeat(data.boundaries.name101) });
  record("TC-REG-08", "Name 101 chars rejected", r.status === 400 && /100/.test(r.body.message), "400 name length", short(r));

  const mixed = `  QA.Mixed.${ts}@Example.COM `;
  const r9a = await req("POST", "/auth/register", { body: { name: "Mixed", email: mixed, password: A.password } });
  const r9b = await req("POST", "/auth/login", { body: { email: `qa.mixed.${ts}@example.com`, password: A.password } });
  record("TC-REG-09", "Email case/space insensitive", r9a.status === 201 && r9b.status === 200,
    "register 201, login 200", `register ${r9a.status} (stored ${r9a.body.user?.email}), login ${short(r9b)}`);

  const gEmail = email(G);
  const r10a = await req("POST", "/auth/register", { body: { name: G.name, email: gEmail, password: G.password } });
  const r10b = await req("POST", "/auth/login", { body: { email: gEmail, password: G.password } });
  record("TC-REG-10", "Gmail address can log in after register", r10a.status === 201 && r10b.status === 200,
    `register 201, login 200 with ${gEmail}`,
    `register ${r10a.status} (stored as ${r10a.body.user?.email}), login ${short(r10b)}`);

  // ---- Session ----
  r = await req("GET", "/auth/me", { token: tokenA });
  record("TC-AUTH-01", "Valid token accepted", r.status === 200 && r.body.user?._id === idA, "200 own profile", short(r));
  const noPwd = !("password" in (regA.body.user || {})) && !("password" in (r.body.user || {}));
  record("TC-REG-11", "Password hash never returned", noPwd, "no password field", `register.user keys=${Object.keys(regA.body.user || {})}; me.user keys=${Object.keys(r.body.user || {})}`);

  r = await req("GET", "/auth/me");
  record("TC-AUTH-02", "No token", r.status === 401 && r.body.message === "Authorization token is required", "401 token required", short(r));

  const tampered = tokenA.slice(0, -1) + (tokenA.endsWith("A") ? "B" : "A");
  r = await req("GET", "/auth/me", { token: tampered });
  record("TC-AUTH-03", "Tampered token", r.status === 401 && r.body.message === "Invalid authorization token", "401 Invalid authorization token", short(r));

  const expired = jwt.sign({ id: idA, exp: Math.floor(Date.now() / 1000) - 60 }, QA_SECRET);
  r = await req("GET", "/auth/me", { token: expired });
  record("TC-AUTH-04", "Expired token", r.status === 401 && /expired/.test(r.body.message), "401 token has expired", short(r));

  r = await req("GET", "/auth/me", { headers: { Authorization: "Bearer " } });
  record("TC-AUTH-05", "Empty bearer value", r.status === 401, "401", short(r));

  // ---- Scan ----
  const target = FIXTURE_URL;
  const s1 = await scan(tokenA, target);
  const f = s1.body.findings || [];
  const sum = { critical: 0, high: 0, medium: 0, low: 0 };
  f.forEach((x) => { const k = x.severity?.toLowerCase(); if (k in sum) sum[k]++; });
  const summaryOk = JSON.stringify(sum) === JSON.stringify({
    critical: s1.body.summary?.critical, high: s1.body.summary?.high,
    medium: s1.body.summary?.medium, low: s1.body.summary?.low });
  const headerFinding = f.some((x) => /header/i.test(x.category + x.description));
  const ok1 = s1.status === 200 && s1.body._id && /^[A-F]$/.test(s1.body.grade) &&
    s1.body.score >= 0 && s1.body.score <= 100 && summaryOk && headerFinding;
  record("TC-SCAN-01", "Scan a reachable site", !!ok1,
    "200, saved _id, grade A-F, score 0-100, summary matches, header findings",
    `${s1.status} grade=${s1.body.grade} score=${s1.body.score} findings=${f.length} summary=${JSON.stringify(s1.body.summary)} summaryMatches=${summaryOk}`);
  const scanA1 = s1.body._id;

  r = await req("POST", "/scan", { token: tokenA, body: { url: target } });
  record("TC-SCAN-02", "Ownership not confirmed", r.status === 400 && /confirm you own/.test(r.body.message), "400 confirm ownership", short(r));

  r = await scan(tokenA, "example.com");
  record("TC-SCAN-03", "URL without protocol", r.status === 400, "400", short(r));

  r = await scan(tokenA, "");
  record("TC-SCAN-04", "Empty URL", r.status === 400 && r.body.message === "A URL is required", "400 A URL is required", short(r));

  r = await scan(tokenA, "ftp://localhost/file");
  record("TC-SCAN-05", "Non-HTTP scheme", r.status === 400, "400", short(r));

  r = await scan(tokenA, DEAD_URL);
  const alive = (await req("GET", "/health")).status === 200;
  record("TC-SCAN-06", "Unreachable host handled", r.status === 502 && r.body.message === "Site could not be reached." && alive,
    "502 Site could not be reached, server still up", `${short(r)}; serverAlive=${alive}`);

  r = await req("POST", "/scan", { body: { url: target, ownershipConfirmed: true } });
  record("TC-SCAN-07", "Scan without auth", r.status === 401, "401", short(r));

  // ---- second scan for A, one scan for B ----
  await new Promise((r) => setTimeout(r, 1100));
  const s2 = await scan(tokenA, target);
  const scanA2 = s2.body._id;
  const regB = await register(B);
  const tokenB = regB.body.token;
  const sB = await scan(tokenB, target);
  const scanB = sB.body._id;

  // ---- History ----
  r = await req("GET", "/history", { token: tokenA });
  const scans = r.body.scans || [];
  const allMine = scans.every((s) => s.userId === idA);
  const sorted = scans.every((s, i) => i === 0 || new Date(scans[i - 1].createdAt) >= new Date(s.createdAt));
  record("TC-HIS-01", "History only mine, newest first",
    r.status === 200 && r.body.count === 2 && allMine && sorted && scans[0]?._id === scanA2,
    "200 count=2 all userId=A newest first",
    `${r.status} count=${r.body.count} allMine=${allMine} sorted=${sorted}`);

  r = await req("GET", `/history/${scanA1}`, { token: tokenA });
  record("TC-HIS-02", "Open own scan", r.status === 200 && r.body.scan?._id === scanA1, "200 scan", `${r.status} id=${r.body.scan?._id}`);

  r = await req("GET", `/history/${scanB}`, { token: tokenA });
  record("TC-HIS-03", "Other user's scan hidden (IDOR)", r.status === 404 && r.body.message === "Scan result not found", "404 Scan result not found", short(r));

  r = await req("GET", "/history/abc", { token: tokenA });
  record("TC-HIS-04", "Malformed id", r.status === 400 && r.body.message === "Invalid scan ID", "400 Invalid scan ID", short(r));

  r = await req("GET", "/history/0123456789abcdef01234567", { token: tokenA });
  record("TC-HIS-05", "Non-existent id", r.status === 404, "404", short(r));

  // ---- Notes ----
  r = await req("PATCH", `/history/${scanA1}`, { token: tokenA, body: { note: "Fix CSP first" } });
  const reread = await req("GET", `/history/${scanA1}`, { token: tokenA });
  record("TC-NOTE-01", "Add note to own scan", r.status === 200 && reread.body.scan?.note === "Fix CSP first",
    "200 and note persisted", `${r.status}, persisted note="${reread.body.scan?.note}"`);

  r = await req("PATCH", `/history/${scanA1}`, { token: tokenA, body: { note: "n".repeat(data.boundaries.note501) } });
  record("TC-NOTE-02", "Note 501 chars rejected", r.status === 400 && /500 characters/.test(r.body.message), "400 max 500", short(r));

  r = await req("PATCH", `/history/${scanA1}`, { token: tokenA, body: { note: 123 } });
  record("TC-NOTE-03", "Non-string note rejected", r.status === 400 && r.body.message === "A note must be text", "400 A note must be text", short(r));

  r = await req("PATCH", `/history/${scanB}`, { token: tokenA, body: { note: "hacked" } });
  const bNote = (await req("GET", `/history/${scanB}`, { token: tokenB })).body.scan?.note;
  record("TC-NOTE-04", "Cannot edit other user's note", r.status === 404 && bNote !== "hacked", "404, B note unchanged", `${r.status}, B note="${bNote}"`);

  // ---- Delete ----
  r = await req("DELETE", `/history/${scanA2}`, { token: tokenA });
  const gone = await req("GET", `/history/${scanA2}`, { token: tokenA });
  record("TC-DEL-01", "Delete own scan", r.status === 200 && gone.status === 404, "200 then GET 404", `${r.status} ${r.body.message}; GET after=${gone.status}`);

  r = await req("DELETE", `/history/${scanB}`, { token: tokenA });
  const still = await req("GET", `/history/${scanB}`, { token: tokenB });
  record("TC-DEL-02", "Cannot delete other user's scan", r.status === 404 && still.status === 200, "404; B still 200", `${r.status}; B GET=${still.status}`);
}

// =====================================================================
// GROUP 2: login + brute-force limit (fresh server)
// =====================================================================
async function group2() {
  const U = { ...data.userA, emailPrefix: "qa.login" };
  await register(U); // register is not login-limited
  const login = (body) => req("POST", "/auth/login", { body });

  let r = await login({ email: email(U), password: U.password }); // #1
  record("TC-LOG-01", "Valid login", r.status === 200 && !!r.body.token, "200 + token", short(r));

  const wrong = await login({ email: email(U), password: "WrongPass9" }); // #2
  record("TC-LOG-02", "Wrong password", wrong.status === 401 && wrong.body.message === "Invalid email or password", "401 Invalid email or password", short(wrong));

  const unknown = await login({ email: `nobody.${ts}@example.com`, password: "WrongPass9" }); // #3
  record("TC-LOG-03", "Unknown email same message", unknown.status === 401 && unknown.body.message === wrong.body.message,
    "401 identical message to LOG-02", short(unknown));

  r = await login({ email: email(U) }); // #4
  record("TC-LOG-04", "Missing password", r.status === 400 && r.body.message === "Password is required", "400 Password is required", short(r));

  const fifth = await login({ email: email(U), password: "WrongPass9" }); // #5
  const sixth = await login({ email: email(U), password: U.password }); // #6
  record("TC-LOG-05", "5 attempts allowed, 6th blocked",
    fifth.status !== 429 && sixth.status === 429 && /Too many login/.test(sixth.body.message),
    "#5 not 429, #6 429", `#5=${fifth.status}, #6=${short(sixth)}`);
}

// =====================================================================
// GROUP 3: scan rate limit (fresh server)
// =====================================================================
async function group3() {
  const U = { ...data.userA, emailPrefix: "qa.limit" };
  const token = (await register(U)).body.token;
  const codes = [];
  for (let i = 1; i <= 11; i++) codes.push((await scan(token, "not-a-url")).status);
  record("TC-SCAN-08", "10 scans allowed, 11th blocked",
    codes[9] === 400 && codes[10] === 429,
    "#10=400, #11=429", `statuses=${codes.join(",")}`);
}

// ---------- main ----------
const apiLog = await runGroups([["Group 1", group1], ["Group 2", group2], ["Group 3", group3]]);

const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.length - pass;
console.log(`\nTotal ${results.length}  PASS ${pass}  FAIL ${fail}`);
const evidence = writeEvidence("api-run", { pass, fail, results }, apiLog);

const order = (id) => ["API", "REG", "LOG", "AUTH", "SCAN", "HIS", "NOTE", "DEL"].indexOf(id.split("-")[1]) * 100 + Number(id.split("-")[2]);
const rows = [...results].sort((a, b) => order(a.id) - order(b.id))
  .map((r) => `| ${r.id} | ${r.title} | ${r.expected} | ${mdCell(r.actual)} | **${r.status}** |`);
fs.writeFileSync(path.join(repo, "qa/02-stlc/api-results.md"),
`# API Test Execution Results (automated)

Run: ${new Date().toISOString()} · Node ${process.version} · local MongoDB · runner \`qa/scripts/run-api-cases.mjs\`
Raw evidence: \`${evidence}\` and the matching \`.server.log\`

**Total ${results.length} · PASS ${pass} · FAIL ${fail}**

| ID | Title | Expected | Actual | Result |
|---|---|---|---|---|
${rows.join("\n")}
`);
process.exit(fail ? 1 : 0);
