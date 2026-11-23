# STLC and Test Environment

| Item | Value |
|---|---|
| Document ID | QA-STLC-02 |
| Related | QA-TP-01 (test plan), `test-cases.md`, `execution-results.md` |

## 1. What the STLC is

The **Software Testing Life Cycle (STLC)** is the ordered set of testing activities. Each activity has **entry criteria** (what must be true before it starts), **activities**, **exit criteria** (what must be true to finish) and **deliverables**. The STLC runs alongside the SDLC: testing starts as soon as the requirements exist, not only after the code is written ("shift-left").

```
Requirement   Test        Test case     Environment    Test         Test cycle
analysis  ──► planning ──► development ─► setup ──────► execution ──► closure
   ▲                                                        │
   └──────────── defect found → fix → retest/regression ◄───┘
```

## 2. STLC applied to this project

| # | STLC phase | Entry criteria | Activities (what we did) | Exit criteria | Deliverable |
|---|---|---|---|---|---|
| 1 | **Requirement analysis** | Source code and README available | Read the routes, validators, models and UI pages to extract testable requirements (the code is the specification, since there is no separate SRS). Identified the high-risk areas: auth, IDOR, SSRF, scoring. | Requirement list F1–F11 agreed | Test plan §3 (requirements table) |
| 2 | **Test planning** | Requirements known | Defined scope, ISO 25010 mapping, strategy, tools, risks, entry and exit criteria | Plan reviewed | `qa/01-test-plan/test-plan.md` |
| 3 | **Test case development** | Plan approved | Wrote 55 test cases (API + UI, positive + negative). Prepared test data. Built a requirements traceability matrix (RTM). | Every High requirement has at least one test case | `test-cases.md`, `qa/test-data/` |
| 4 | **Environment setup** | Test cases ready | Local MongoDB, a QA launcher that forces the local DB and a test JWT secret, a fixture website to scan, and a smoke test on `/api/health` | Smoke test passes | §4 below, `qa/scripts/` |
| 5 | **Test execution** | Environment ready and smoke test passed | API cases run by `qa/scripts/run-api-cases.mjs` (repeatable). UI cases run manually in Chromium with screenshots. Defects logged. | All High cases executed | `execution-results.md`, `qa/evidence/` |
| 6 | **Test cycle closure** | Execution complete | Pass/fail metrics, defect summary, lessons learned, check against the exit criteria | Report accepted | `execution-results.md` §summary (and the P12 reflection) |

**Defect loop:** when a case fails, we log a defect (`qa/10-defects/`), find the root cause, fix it on the QA branch, re-run the failed case (**retest**), then re-run the whole suite (**regression**).

## 3. Test levels and types used in this STLC

| Level | Example in this project |
|---|---|
| Unit | `calculateScore()` with mixed severities |
| Integration | `POST /api/scan` goes through auth → rate limiter → validator → controller → MongoDB |
| System | A user registers, scans, views the report, adds a note and deletes it in the browser |
| Acceptance | Gherkin scenarios written in user language (P6) |

## 4. Test environment

### 4.1 Hardware / OS

| Item | Value |
|---|---|
| Machine | Developer laptop, Windows 11 Home Single Language (build 26300) |
| CI runner (P8) | GitHub-hosted `ubuntu-latest` |

### 4.2 Software

| Component | Version | Notes |
|---|---|---|
| Node.js | v25.6.0 | Runs both the API and the client |
| MongoDB Community Server | 8.3 | Local only, `127.0.0.1:27099`, data dir `qa/.data/db` (git-ignored) |
| Express | 5.2 | API |
| Mongoose | 9.7 | ODM |
| React / Vite | 19.2 / 8.1 | Client dev server on `:5173` |
| Browser | Chromium (Claude desktop built-in browser) | Manual UI execution, screenshots |
| Postman CLI | installed | P7 |

### 4.3 Configuration and isolation

| Setting | Dev value (from `server/.env`) | QA value | Why |
|---|---|---|---|
| `MONGO_URI` | MongoDB **Atlas** (deployed DB) | `mongodb://127.0.0.1:27099/websec_qa` | Never touch production data (risk R1) |
| `JWT_SECRET` | real secret | `qa-only-…` test secret | Lets us create expired or forged tokens for negative tests without knowing the real secret |
| `NODE_ENV` | development | development (production for the SSRF tests) | The SSRF guard only activates in production |
| `PORT` | 5000 | 5000 for manual UI runs, 5055 for the automated API run | The automated run starts a fresh server per group so the rate limiters reset |

`server/.env` is **not modified**. The launcher `qa/scripts/start-test-api.js` sets these variables *before* `dotenv` loads. `dotenv` never overrides variables that already exist. The launcher also refuses to start if `MONGO_URI` is not a local address.

### 4.4 Test data

| Data | Source |
|---|---|
| Users | Generated per run with a timestamp suffix (`qa.a.<ts>@example.com`), so runs never clash |
| Passwords | Synthetic test values defined in `qa/test-data/users.json` |
| Scan target | Local fixture site started by the runner (`http://localhost:5070`) with known weaknesses: no security headers, an insecure cookie, and an old jQuery version |
| Unreachable target | `http://localhost:5079` (nothing listening) |

### 4.5 How to reproduce the environment

```powershell
# 1. Start local MongoDB (or use the "qa-db" entry in .claude/launch.json)
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --port 27099 --bind_ip 127.0.0.1 --dbpath qa\.data\db

# 2. Automated API test cases (spins up its own API instances on :5055)
node qa/scripts/run-api-cases.mjs

# 3. Manual UI: API on :5000 against the local DB, plus the client
node qa/scripts/start-test-api.js
npm run dev --prefix client
```
