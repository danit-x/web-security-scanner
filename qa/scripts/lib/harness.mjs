// qa/scripts/lib/harness.mjs
// Shared helpers for the QA runners: start/stop the real API on a local DB,
// a tiny HTTP client, a local fixture website to scan, and a result recorder.

import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, "../../..");
export const requireServer = createRequire(path.join(repo, "server/package.json"));
export const QA_SECRET = "qa-only-jwt-secret-not-for-production";
export const API_PORT = 5055;
export const FIXTURE_PORT = 5070;
export const DEAD_PORT = 5079;
export const BASE = `http://localhost:${API_PORT}/api`;
export const FIXTURE_URL = `http://127.0.0.1:${FIXTURE_PORT}/`; // localhost is rejected by isURL (DEF-004)
export const DEAD_URL = `http://127.0.0.1:${DEAD_PORT}/`;

export const loadJson = (rel) =>
  JSON.parse(fs.readFileSync(path.join(repo, rel), "utf8"));

// ---------- HTTP helper ----------
export async function req(method, p, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token !== undefined) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
    h["Content-Type"] = "application/json";
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + p, { method, headers: h, body: payload });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, body: parsed, headers: res.headers };
}
export const short = (r) => `${r.status} ${JSON.stringify(r.body).slice(0, 160)}`;

// ---------- fixture website (the only scan target) ----------
// Deliberately weak: no security headers, insecure cookie, old jQuery.
export function startFixture() {
  const server = http.createServer((rq, rs) => {
    if (rq.url === "/" || rq.url === "/index.html") {
      rs.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "session=abc123; Path=/" });
      rs.end(`<!doctype html><html><head><title>QA fixture</title>
<script src="/js/jquery-1.12.4.min.js"></script></head>
<body><h1>QA fixture site</h1></body></html>`);
    } else {
      rs.writeHead(404, { "Content-Type": "text/plain" });
      rs.end("not found");
    }
  });
  return new Promise((r) => server.listen(FIXTURE_PORT, () => r(server)));
}

// ---------- API lifecycle (fresh process = fresh rate limiters) ----------
export async function startApi(extraEnv = {}) {
  const child = spawn(process.execPath, [path.join(repo, "qa/scripts/start-test-api.js")], {
    env: { ...process.env, PORT: String(API_PORT), ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (child.exitCode !== null) throw new Error(`API exited early:\n${log}`);
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return { child, getLog: () => log };
    } catch {}
  }
  child.kill();
  throw new Error(`API did not become healthy:\n${log}`);
}
export const stopApi = (api) =>
  new Promise((r) => { api.child.once("exit", r); api.child.kill(); });

// Runs each [name, fn] group against its own fresh API process.
export async function runGroups(groups, { fixture = true } = {}) {
  const fx = fixture ? await startFixture() : null;
  let apiLog = "";
  try {
    for (const [name, fn] of groups) {
      console.log(`\n=== ${name} (fresh API on :${API_PORT}) ===`);
      const api = await startApi();
      try { await fn(); } finally {
        apiLog += `\n--- ${name} ---\n${api.getLog()}`;
        await stopApi(api);
      }
    }
  } finally {
    fx?.close();
  }
  return apiLog;
}

// ---------- result recorder ----------
export function createRecorder() {
  const results = [];
  const record = (id, title, pass, expected, actual, extra = {}) => {
    results.push({ id, title, status: pass ? "PASS" : "FAIL", expected, actual, ...extra });
    console.log(`${pass ? "PASS" : "FAIL"}  ${id}  ${title}${pass ? "" : `\n      expected: ${expected}\n      actual:   ${actual}`}`);
  };
  return { results, record };
}

export function writeEvidence(prefix, payload, serverLog) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evDir = path.join(repo, "qa/evidence");
  fs.mkdirSync(evDir, { recursive: true });
  const json = path.join(evDir, `${prefix}-${stamp}.json`);
  fs.writeFileSync(json, JSON.stringify({ runAt: new Date().toISOString(), node: process.version, ...payload }, null, 2));
  if (serverLog !== undefined) fs.writeFileSync(path.join(evDir, `${prefix}-${stamp}.server.log`), serverLog);
  return path.relative(repo, json).replace(/\\/g, "/");
}

export const mdCell = (v) => String(v).replace(/\|/g, "\\|").replace(/\n/g, " ");
