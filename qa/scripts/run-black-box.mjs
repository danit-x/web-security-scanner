// qa/scripts/run-black-box.mjs
// Phase 3: executes the black-box designs in qa/03-black-box/black-box-design.md
//   - Equivalence Partitioning (EP)
//   - Boundary Value Analysis (BVA)
//   - Decision Tables (DT)
// Scoring rules are exercised directly (pure functions); everything else goes
// through the real API on a local DB, one fresh server per group.
//
//   node qa/scripts/run-black-box.mjs
// Output: qa/03-black-box/black-box-results.md + qa/evidence/black-box-*.json

import fs from "node:fs";
import path from "node:path";
import {
  repo, requireServer, QA_SECRET, FIXTURE_URL, DEAD_URL,
  req, short, runGroups, createRecorder, writeEvidence, mdCell,
} from "./lib/harness.mjs";

const jwt = requireServer("jsonwebtoken");
const { calculateScore, scoreToGrade, calculateGrade } = requireServer("./utils/scoring.js");
const { results, record } = createRecorder();
const ts = Date.now();
let n = 0;
const uniqueEmail = (tag = "bb") => `qa.${tag}.${ts}.${++n}@example.com`;
const PWD = "Passw0rd1";

const register = (overrides = {}) =>
  req("POST", "/auth/register", {
    body: { name: "QA BB", email: uniqueEmail(), password: PWD, ...overrides },
  });
const newUser = async () => {
  const r = await register();
  return { token: r.body.token, id: r.body.user._id };
};
const scan = (token, url, ownershipConfirmed = true) =>
  req("POST", "/scan", { token, body: { url, ownershipConfirmed } });
const msg = (r) => (typeof r.body === "object" ? r.body.message : r.body);

// =====================================================================
// SCORING (pure functions): BVA on grade thresholds + score floor, EP on inputs
// =====================================================================
function scoring() {
  console.log("\n=== Scoring (direct, no server) ===");
  const g = (id, score, expected, note) => {
    const actual = scoreToGrade(score);
    record(id, `scoreToGrade(${score})`, actual === expected, expected, actual,
      { tech: "BVA", group: "Grade thresholds", input: String(score), note });
  };
  g("BVA-GR-01", 100, "A", "max");
  g("BVA-GR-02", 90, "A", "A on-boundary");
  g("BVA-GR-03", 89, "B", "A just-below");
  g("BVA-GR-04", 75, "B", "B on-boundary");
  g("BVA-GR-05", 74, "C", "B just-below");
  g("BVA-GR-06", 60, "C", "C on-boundary");
  g("BVA-GR-07", 59, "D", "C just-below");
  g("BVA-GR-08", 40, "D", "D on-boundary");
  g("BVA-GR-09", 39, "F", "D just-below");
  g("BVA-GR-10", 0, "F", "min");
  g("BVA-GR-11", -1, "F", "below valid range (robustness)");
  g("BVA-GR-12", 101, "A", "above valid range (robustness)");

  const F = (spec) => Object.entries(spec).flatMap(([sev, k]) => Array(k).fill({ severity: sev }));
  const s = (id, spec, expScore, expGrade, note) => {
    const r = calculateGrade(F(spec));
    const label = Object.entries(spec).map(([k, v]) => `${v}×${k}`).join(" + ");
    record(id, `findings ${label}`, r.score === expScore && r.grade === expGrade,
      `${expScore} / ${expGrade}`, `${r.score} / ${r.grade}`,
      { tech: "BVA", group: "Score via findings (end-to-end of scoring)", input: label, note });
  };
  // score floor at 0: just above, on, below
  s("BVA-SC-01", { CRITICAL: 3, LOW: 8 }, 1, "F", "floor +1 (100-99)");
  s("BVA-SC-02", { CRITICAL: 4 }, 0, "F", "floor on-boundary (100-100)");
  s("BVA-SC-03", { CRITICAL: 3, HIGH: 1, LOW: 4 }, 0, "F", "raw -2 must clamp to 0");
  // grade boundaries reached through real deductions
  s("BVA-SC-04", { LOW: 3 }, 91, "A", "closest reachable A above 90");
  s("BVA-SC-05", { MEDIUM: 1, LOW: 1 }, 89, "B", "A just-below");
  s("BVA-SC-06", { MEDIUM: 3 }, 76, "B", "B +1");
  s("BVA-SC-07", { CRITICAL: 1 }, 75, "B", "B on-boundary");
  s("BVA-SC-08", { HIGH: 1, MEDIUM: 1, LOW: 1 }, 74, "C", "B just-below");
  s("BVA-SC-09", { HIGH: 1, MEDIUM: 3 }, 61, "C", "C +1");
  s("BVA-SC-10", { CRITICAL: 1, HIGH: 1 }, 60, "C", "C on-boundary");
  s("BVA-SC-11", { CRITICAL: 1, MEDIUM: 2 }, 59, "D", "C just-below");
  s("BVA-SC-12", { CRITICAL: 2, LOW: 3 }, 41, "D", "D +1");
  s("BVA-SC-13", { HIGH: 4 }, 40, "D", "D on-boundary");
  s("BVA-SC-14", { CRITICAL: 2, MEDIUM: 1, LOW: 1 }, 39, "F", "D just-below");

  // Is score 90 reachable at all? (exhaustive search over deduction combos)
  const reachable = new Set();
  for (let c = 0; c <= 4; c++) for (let h = 0; h <= 7; h++) for (let m = 0; m <= 13; m++) for (let l = 0; l <= 34; l++)
    reachable.add(Math.max(0, 100 - 25 * c - 15 * h - 8 * m - 3 * l));
  const unreachable = [...Array(101).keys()].filter((x) => !reachable.has(x));
  record("BVA-SC-15", "Which scores can never occur?", true, "(informational)",
    `unreachable: ${unreachable.join(", ")}`, { tech: "BVA", group: "Score via findings (end-to-end of scoring)", input: "all combinations", note: "90 is unreachable, so an exact A-boundary scan can never happen; 91 is the lowest real A" });

  // EP on calculateScore input
  const e = (id, title, input, fn, expected) => {
    let actual;
    try { actual = String(fn()); } catch (err) { actual = `THROWS ${err.constructor.name}: ${err.message}`; }
    record(id, title, actual === expected, expected, actual, { tech: "EP", group: "calculateScore input classes", input });
  };
  e("EP-SC-01", "Valid class: known severities", "[{HIGH}]", () => calculateScore([{ severity: "HIGH" }]), "85");
  e("EP-SC-02", "Empty array", "[]", () => calculateScore([]), "100");
  e("EP-SC-03", "Not an array", "null", () => calculateScore(null), "100");
  e("EP-SC-04", "Unknown severity", "[{UNKNOWN}]", () => calculateScore([{ severity: "UNKNOWN" }]), "100");
  e("EP-SC-05", "Wrong-case severity", "[{high}]", () => calculateScore([{ severity: "high" }]), "100");
  e("EP-SC-06", "Null element in array", "[null]", () => calculateScore([null]), "100");
  e("EP-SC-07", "scoreToGrade with NaN", "NaN", () => scoreToGrade(NaN), "F");
}

// =====================================================================
// GROUP 1: EP + BVA on input fields (register, scan URL, note, scan id)
// =====================================================================
async function inputs() {
  const rec = (id, group, tech, input, ok, expected, r) =>
    record(id, `${group}: ${input}`, ok, expected, short(r), { tech, group, input });

  // ---- EP: password ----
  let r;
  const pw = async (id, input, value, expStatus, expected, omit = false) => {
    const body = { name: "QA BB", email: uniqueEmail() };
    if (!omit) body.password = value;
    r = await req("POST", "/auth/register", { body });
    rec(id, "Password", "EP", input, r.status === expStatus, expected, r);
  };
  await pw("EP-PW-01", "valid: 9 chars + digit", "Passw0rd1", 201, "201");
  await pw("EP-PW-02", "invalid: too short", "Pass1", 400, "400 min length");
  await pw("EP-PW-03", "invalid: no digit", "Password", 400, "400 needs a number");
  await pw("EP-PW-04", "invalid: empty string", "", 400, "400 required");
  await pw("EP-PW-05", "invalid: field missing", undefined, 400, "400 required", true);
  await pw("EP-PW-06", "invalid type: number 12345678", 12345678, 400, "400 (type rejected, not a crash)");
  await pw("EP-PW-07", "valid (weak): digits only '12345678'", "12345678", 201, "201 (meets the stated rule)");

  // ---- EP: email (register) ----
  const em = async (id, input, value, expStatus, expected) => {
    r = await req("POST", "/auth/register", { body: { name: "QA BB", email: value, password: PWD } });
    rec(id, "Email", "EP", input, r.status === expStatus, expected, r);
    return r;
  };
  await em("EP-EM-01", "valid", uniqueEmail(), 201, "201");
  await em("EP-EM-02", "invalid: no @", `qa${ts}example.com`, 400, "400");
  await em("EP-EM-03", "invalid: no domain", "user@", 400, "400");
  await em("EP-EM-04", "invalid: no local part", "@example.com", 400, "400");
  await em("EP-EM-05", "invalid: empty", "", 400, "400");
  const mixed = `  QA.Case.${ts}@EXAMPLE.com `;
  r = await em("EP-EM-06", "valid: mixed case + padding", mixed, 201, "201, stored lower-case");
  results.at(-1).actual += ` stored=${r.body.user?.email}`;
  await em("EP-EM-07", "invalid type: object {$gt:''}", { $gt: "" }, 400, "400");

  // ---- EP: NoSQL-injection class on login ----
  r = await req("POST", "/auth/login", { body: { email: { $ne: null }, password: { $ne: null } } });
  rec("EP-LG-01", "Login", "EP", "invalid type: {$ne:null} in email+password", r.status === 400, "400 (never 200)", r);

  // ---- BVA: password length (min 8) ----
  const pl = async (id, len, expStatus) => {
    const value = "a".repeat(len - 1) + "1";
    r = await req("POST", "/auth/register", { body: { name: "QA BB", email: uniqueEmail(), password: value } });
    rec(id, "Password length", "BVA", `${len} chars`, r.status === expStatus, String(expStatus), r);
  };
  await pl("BVA-PW-01", 7, 400);
  await pl("BVA-PW-02", 8, 201);
  await pl("BVA-PW-03", 9, 201);

  // ---- BVA: name length (1..100) ----
  const nl = async (id, len, expStatus) => {
    r = await register({ name: "n".repeat(len) });
    rec(id, "Name length", "BVA", `${len} chars`, r.status === expStatus, String(expStatus), r);
  };
  await nl("BVA-NM-01", 0, 400);
  await nl("BVA-NM-02", 1, 201);
  await nl("BVA-NM-03", 99, 201);
  await nl("BVA-NM-04", 100, 201);
  await nl("BVA-NM-05", 101, 400);
  results.at(-1).actual += ` | message="${msg(r)}"`;

  // ---- EP: scan URL (one user, exactly 10 requests = the limit) ----
  const U = await newUser();
  const url = async (id, input, value, expStatus, expected) => {
    r = await req("POST", "/scan", { token: U.token, body: { url: value, ownershipConfirmed: true } });
    rec(id, "Scan URL", "EP", input, r.status === expStatus, expected, r);
  };
  await url("EP-URL-01", "valid: http + IP, reachable", FIXTURE_URL, 200, "200 report");
  await url("EP-URL-02", "valid: https, unreachable", DEAD_URL.replace("http:", "https:"), 502, "502 not reachable");
  await url("EP-URL-03", "valid: padded with spaces", `   ${FIXTURE_URL}   `, 200, "200 (trimmed)");
  await url("EP-URL-04", "valid (dev): localhost hostname", "http://localhost:5070/", 200, "200 in dev (documented bypass)");
  await url("EP-URL-05", "invalid: no scheme", "example.com", 400, "400");
  await url("EP-URL-06", "invalid: ftp scheme", "ftp://127.0.0.1/file", 400, "400");
  await url("EP-URL-07", "invalid: javascript: scheme", "javascript:alert(1)", 400, "400");
  await url("EP-URL-08", "invalid: file scheme", "file:///etc/passwd", 400, "400");
  await url("EP-URL-09", "invalid: empty", "", 400, "400 A URL is required");
  await url("EP-URL-10", "invalid type: number", 12345, 400, "400");

  // ---- EP + BVA: note ----
  const N = await newUser();
  const noteScan = (await scan(N.token, FIXTURE_URL)).body._id;
  const note = async (id, tech, group, input, body, expStatus, expected, checkStored) => {
    r = await req("PATCH", `/history/${noteScan}`, { token: N.token, body });
    let ok = r.status === expStatus;
    let extra = "";
    if (checkStored !== undefined && r.status === 200) {
      ok = ok && r.body.scan?.note === checkStored;
      extra = ` stored(len)=${r.body.scan?.note?.length}`;
    }
    record(id, `${group}: ${input}`, ok, expected, short(r) + extra, { tech, group, input });
  };
  await note("EP-NT-01", "EP", "Note", "valid: text", { note: "Fix CSP" }, 200, "200");
  await note("EP-NT-02", "EP", "Note", "valid: empty string (clears note)", { note: "" }, 200, "200, note cleared", "");
  await note("EP-NT-03", "EP", "Note", "valid: whitespace only", { note: "   " }, 200, "200, stored as ''", "");
  await note("EP-NT-04", "EP", "Note", "valid: HTML/script text", { note: "<script>alert(1)</script>" }, 200, "200, stored as plain text", "<script>alert(1)</script>");
  await note("EP-NT-05", "EP", "Note", "invalid: missing field", {}, 400, "400 A note is required");
  await note("EP-NT-06", "EP", "Note", "invalid type: number", { note: 42 }, 400, "400 A note must be text");
  await note("EP-NT-07", "EP", "Note", "invalid type: null", { note: null }, 400, "400");
  await note("EP-NT-08", "EP", "Note", "invalid type: object", { note: { a: 1 } }, 400, "400");
  await note("BVA-NT-01", "BVA", "Note length", "499 chars", { note: "n".repeat(499) }, 200, "200", "n".repeat(499));
  await note("BVA-NT-02", "BVA", "Note length", "500 chars", { note: "n".repeat(500) }, 200, "200", "n".repeat(500));
  await note("BVA-NT-03", "BVA", "Note length", "501 chars", { note: "n".repeat(501) }, 400, "400 max 500");
  await note("BVA-NT-04", "BVA", "Note length", "500 chars + 1 trailing space (501 raw)", { note: "n".repeat(500) + " " }, 200, "200, trimmed to 500", "n".repeat(500));

  // ---- BVA: scan id length (ObjectId = 24 hex) ----
  const id = async (tid, input, value, check, expected) => {
    r = await req("GET", `/history/${value}`, { token: N.token });
    rec(tid, "Scan id", "BVA", input, check(r.status), expected, r);
  };
  await id("BVA-ID-01", "23 hex chars", "0123456789abcdef0123456", (s) => s === 400, "400 Invalid scan ID");
  await id("BVA-ID-02", "24 hex chars (valid format, not found)", "0123456789abcdef01234567", (s) => s === 404, "404");
  await id("BVA-ID-03", "25 hex chars", "0123456789abcdef012345678", (s) => s === 400, "400 Invalid scan ID");
  await id("BVA-ID-04", "12 non-hex chars 'aaaaaaaaaaaa'", "aaaaaaaaaaaa", (s) => s === 400 || s === 404, "400 or 404, never 500");
}

// =====================================================================
// GROUP 2: Decision tables
// =====================================================================
async function decisionTables() {
  const A = await newUser();
  const B = await newUser();
  const sA = [], sB = (await scan(B.token, FIXTURE_URL)).body._id;
  for (let i = 0; i < 3; i++) sA.push((await scan(A.token, FIXTURE_URL)).body._id);

  const badSig = jwt.sign({ id: A.id }, "not-the-server-secret");
  const expired = jwt.sign({ id: A.id, exp: Math.floor(Date.now() / 1000) - 60 }, QA_SECRET);
  const missing = "0123456789abcdef01234567";

  // DT-1: access a scan by id. Conditions C1..C5 -> action.
  const rules = [
    // id, C1 header, C2 token, C3 id format, C4 exists, C5 owner, token, id, expected status, expected message
    ["R1", "N", "-", "-", "-", "-", undefined, () => sA[0], 401, "Authorization token is required"],
    ["R2", "N", "-", "N", "-", "-", undefined, () => "abc", 401, "Authorization token is required"],
    ["R3", "Y", "Invalid", "-", "-", "-", badSig, () => sA[0], 401, "Invalid authorization token"],
    ["R4", "Y", "Expired", "-", "-", "-", expired, () => sA[0], 401, "Authorization token has expired"],
    ["R5", "Y", "Valid", "N", "-", "-", A.token, () => "abc", 400, "Invalid scan ID"],
    ["R6", "Y", "Valid", "Y", "N", "-", A.token, () => missing, 404, "Scan result not found"],
    ["R7", "Y", "Valid", "Y", "Y", "N", A.token, () => sB, 404, "Scan result not found"],
    ["R8", "Y", "Valid", "Y", "Y", "Y", A.token, null, 200, null],
  ];
  const methods = [
    ["GET", sA[0], undefined],
    ["PATCH", sA[1], { note: "dt" }],
    ["DELETE", sA[2], undefined],
  ];
  for (const [method, ownId, body] of methods) {
    for (const [rid, c1, c2, c3, c4, c5, token, idFn, expStatus, expMsg] of rules) {
      const target = idFn ? idFn() : ownId;
      const headers = c1 === "N" ? {} : undefined;
      const r = await req(method, `/history/${target}`, { token: c1 === "N" ? undefined : token, body, headers });
      let ok = r.status === expStatus && (expMsg === null || msg(r) === expMsg);
      let actual = short(r);
      if (rid === "R7") {
        const still = await req("GET", `/history/${sB}`, { token: B.token });
        ok = ok && still.status === 200 && (method !== "PATCH" || still.body.scan?.note !== "dt");
        actual += ` | B's scan afterwards: ${still.status}, note="${still.body.scan?.note}"`;
      }
      if (rid === "R8" && method === "DELETE") {
        const gone = await req("GET", `/history/${ownId}`, { token: A.token });
        ok = ok && gone.status === 404;
        actual += ` | GET afterwards: ${gone.status}`;
      }
      record(`DT1-${method}-${rid}`, `${method} /history/:id ${rid}`, ok,
        `${expStatus}${expMsg ? ` ${expMsg}` : ""}`, actual,
        { tech: "DT", group: "DT-1 Scan access", input: `C1=${c1} C2=${c2} C3=${c3} C4=${c4} C5=${c5}`, method, rule: rid });
    }
  }

  // DT-2: POST /scan. Conditions: auth, URL valid, ownership, reachable.
  const D = await newUser();
  const scanRules = [
    ["R1", "N", "-", "-", "-", undefined, FIXTURE_URL, true, 401, null],
    ["R2", "Y", "N", "N", "-", D.token, "not-a-url", false, 400, "Please provide a valid URL including http:// or https://"],
    ["R3", "Y", "N", "Y", "-", D.token, "not-a-url", true, 400, "Please provide a valid URL including http:// or https://"],
    ["R4", "Y", "Y", "N", "-", D.token, FIXTURE_URL, false, 400, "You must confirm you own this website or have permission to scan it."],
    ["R5", "Y", "Y", "Y", "N", D.token, DEAD_URL, true, 502, "Site could not be reached."],
    ["R6", "Y", "Y", "Y", "Y", D.token, FIXTURE_URL, true, 200, null],
  ];
  for (const [rid, c1, c2, c3, c4, token, url, own, expStatus, expMsg] of scanRules) {
    const r = await req("POST", "/scan", { token, body: { url, ownershipConfirmed: own } });
    const ok = r.status === expStatus && (expMsg === null || msg(r) === expMsg) && (rid !== "R6" || !!r.body._id);
    record(`DT2-${rid}`, `POST /scan ${rid}`, ok, `${expStatus}${expMsg ? ` ${expMsg}` : ""}`, short(r),
      { tech: "DT", group: "DT-2 Run scan", input: `Auth=${c1} URLvalid=${c2} Owner=${c3} Reachable=${c4}`, rule: rid });
  }
}

// =====================================================================
// GROUPS 3-5: rate-limit boundaries (each needs a fresh server)
// =====================================================================
async function loginLimit() {
  const email = uniqueEmail("lim");
  await req("POST", "/auth/register", { body: { name: "QA", email, password: PWD } });
  const codes = [];
  for (let i = 1; i <= 6; i++) codes.push((await req("POST", "/auth/login", { body: { email, password: "Wrong0ne" } })).status);
  const t = (id, k, ok, exp) => record(id, `Login attempt #${k}`, ok, exp, `#${k}=${codes[k - 1]} (all: ${codes.join(",")})`,
    { tech: "BVA", group: "Login rate limit (5 / 15 min / IP)", input: `attempt ${k}` });
  t("BVA-RL-01", 4, codes[3] === 401, "401 (allowed)");
  t("BVA-RL-02", 5, codes[4] === 401, "401 (allowed, on boundary)");
  t("BVA-RL-03", 6, codes[5] === 429, "429 (blocked)");
}

async function scanLimit() {
  const U = await newUser();
  const codes = [];
  for (let i = 1; i <= 11; i++) codes.push((await scan(U.token, "not-a-url")).status);
  const V = await newUser();
  const other = (await scan(V.token, "not-a-url")).status;
  const t = (id, k, ok, exp) => record(id, `Scan request #${k}`, ok, exp, `#${k}=${codes[k - 1]} (all: ${codes.join(",")})`,
    { tech: "BVA", group: "Scan rate limit (10 / 15 min / user)", input: `request ${k}` });
  t("BVA-RL-04", 9, codes[8] === 400, "400 (allowed, validation error)");
  t("BVA-RL-05", 10, codes[9] === 400, "400 (allowed, on boundary)");
  t("BVA-RL-06", 11, codes[10] === 429, "429 (blocked, limit checked before validation)");
  record("BVA-RL-07", "Different user, same IP, request #1", other === 400, "400 (limit is per user, not per IP)", `${other}`,
    { tech: "BVA", group: "Scan rate limit (10 / 15 min / user)", input: "user 2, request 1" });
}

async function generalLimit() {
  // The harness already sent 1 successful GET /api/health while waiting for
  // start-up, so request k of this loop is overall request k + 1.
  const codes = [null];
  for (let i = 2; i <= 101; i++) codes.push((await req("GET", "/health")).status);
  const t = (id, k, exp, ok) => record(id, `GET /api/health overall #${k}`, ok, exp, `#${k}=${codes[k - 1]}`,
    { tech: "BVA", group: "General API limit (100 / 15 min / IP)", input: `request ${k}` });
  t("BVA-RL-08", 99, "200", codes[98] === 200);
  t("BVA-RL-09", 100, "200 (on boundary)", codes[99] === 200);
  t("BVA-RL-10", 101, "429", codes[100] === 429);
}

// ---------- main ----------
scoring();
const apiLog = await runGroups([
  ["EP + BVA inputs", inputs],
  ["Decision tables", decisionTables],
  ["Login limit", loginLimit],
  ["Scan limit", scanLimit],
  ["General limit", generalLimit],
]);

const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.length - pass;
console.log(`\nTotal ${results.length}  PASS ${pass}  FAIL ${fail}`);
const evidence = writeEvidence("black-box", { pass, fail, results }, apiLog);

// ---------- results document ----------
const byGroup = new Map();
for (const r of results) {
  const key = `${r.tech}|${r.group}`;
  if (!byGroup.has(key)) byGroup.set(key, []);
  byGroup.get(key).push(r);
}
const techName = { EP: "Equivalence partitioning", BVA: "Boundary value analysis", DT: "Decision tables" };
let md = `# Black-Box Execution Results (Phase 3)

Run: ${new Date().toISOString()} · Node ${process.version} · local MongoDB · runner \`qa/scripts/run-black-box.mjs\`
Raw evidence: \`${evidence}\` and the matching \`.server.log\`. Test design: [black-box-design.md](black-box-design.md)

**Total ${results.length} · PASS ${pass} · FAIL ${fail}**

| Technique | Cases | Pass | Fail |
|---|---|---|---|
${["EP", "BVA", "DT"].map((t) => {
  const rs = results.filter((r) => r.tech === t);
  const p = rs.filter((r) => r.status === "PASS").length;
  return `| ${techName[t]} | ${rs.length} | ${p} | ${rs.length - p} |`;
}).join("\n")}
`;
for (const t of ["EP", "BVA", "DT"]) {
  md += `\n## ${techName[t]}\n`;
  for (const [key, rows] of byGroup) {
    if (!key.startsWith(`${t}|`)) continue;
    md += `\n### ${key.split("|")[1]}\n\n| ID | Input / condition | Expected | Actual | Result |\n|---|---|---|---|---|\n`;
    md += rows.map((r) => `| ${r.id} | ${mdCell(r.input)}${r.note ? ` <br>*${mdCell(r.note)}*` : ""} | ${mdCell(r.expected)} | ${mdCell(r.actual)} | **${r.status}** |`).join("\n") + "\n";
  }
}
fs.mkdirSync(path.join(repo, "qa/03-black-box"), { recursive: true });
fs.writeFileSync(path.join(repo, "qa/03-black-box/black-box-results.md"), md);
process.exit(fail ? 1 : 0);
