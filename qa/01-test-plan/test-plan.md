# Test Plan: Website Security Scanner (MERN)

| Item | Value |
|---|---|
| Document ID | QA-TP-01 |
| Course | EC4206 Software Testing & Quality Assurance, Option A |
| System under test (SUT) | Website Security Scanner, `danit-x/web-security-scanner` |
| Version tested | `main` @ `ba8a9ba` ("prepare app for Render and Vercel deployment") |
| QA branch | `qa/ec4206-testing` |
| Standard followed | IEEE 829 / ISO/IEC/IEEE 29119-3 test plan structure (condensed) |
| Date | 2026-11-23 |

---

## 1. Introduction

The Website Security Scanner is a MERN web app. A registered user enters the URL of a site they own, confirms they have permission to scan it, and receives a graded security report (A–F, score 0–100). The server builds the report by fetching the page and running six passive checks:

1. Security headers
2. SSL/TLS
3. Exposed sensitive files
4. Cookie flags
5. Mixed content
6. Outdated JavaScript libraries

Reports are stored in MongoDB. The user can view their history, open a report, add a note, and delete a scan.

This plan defines what will be tested, how, by whom, with which tools, and when testing counts as finished.

## 2. Test items (what is under test)

| ID | Item | Location |
|---|---|---|
| TI-1 | REST API (Express 5) | `server/server.js`, `routes/`, `controllers/` |
| TI-2 | Input validation and SSRF guard | `server/validators/` |
| TI-3 | Authentication (JWT, bcrypt) | `controllers/authController.js`, `middleware/authMiddleware.js` |
| TI-4 | Rate limiting | `middleware/rateLimiter.js` |
| TI-5 | Scoring and grading logic | `utils/scoring.js` |
| TI-6 | Security check modules | `utils/checks/*.js` |
| TI-7 | Persistence (Mongoose models) | `models/user.js`, `models/ScanResults.js` |
| TI-8 | React client (React 19, Vite, React Router 7) | `client/src/` |

## 3. Scope

### 3.1 In scope

| Feature | Requirement summary | Priority |
|---|---|---|
| F1 Register | Name (required, max 100 characters), valid email, password of at least 8 characters with at least one digit, unique email | High |
| F2 Login / logout | Valid credentials return a 7-day JWT. Invalid credentials return a generic 401. 5 login attempts per 15 minutes per IP. | High |
| F3 Session / route guard | `/dashboard`, `/history` and `/report/:id` need a token. A 401 response clears the token and redirects to `/login`. | High |
| F4 Run scan | URL must be http(s), ownership must be confirmed, 10 scans per 15 minutes per user. Produces a report with grade, score and findings. | High |
| F5 Scoring | Deductions: CRITICAL 25, HIGH 15, MEDIUM 8, LOW 3. Score floor is 0. Grade bands: A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, otherwise F. | High |
| F6 History | Lists only the logged-in user's scans, newest first | High |
| F7 Report view | Owner only. Another user's scan returns 404, not 403. | High |
| F8 Note | Add or edit a note (string, max 500 characters), owner only | Medium |
| F9 Delete scan | Owner only, confirmation dialog in the UI | Medium |
| F10 API hardening | Helmet headers, CORS allow-list, general limit of 100 requests per 15 minutes, JSON error format, 404 for unknown routes | Medium |
| F11 About page | Static, public | Low |

### 3.2 Out of scope (and why)

| Excluded | Reason |
|---|---|
| Accuracy of findings against real third-party websites | Scanning sites we don't own is unethical and outside the app's own rules. Scans only target local test pages we control. |
| Production deployment (Render, Vercel, Atlas) | Tests must never change production data. Everything runs against a local MongoDB. |
| Cross-browser and mobile-device matrix | Chrome (Chromium) only, given time limits. Responsive layout is checked at one mobile width. |
| Accessibility (WCAG) audit | Not required by the brief. Noted as a future improvement. |
| Third-party libraries' own correctness (Express, Mongoose) | Assumed to be tested upstream. |

## 4. Quality characteristics: ISO/IEC 25010

ISO/IEC 25010 defines the product quality model. The table maps each characteristic we test to the features, techniques and phases that cover it.

| ISO 25010 characteristic | Sub-characteristic | What it means for this app | How we test it (phase) |
|---|---|---|---|
| **Functional suitability** | Completeness, correctness | Register, login, scan, history, note and delete all behave as specified. Scores and grades are calculated correctly. | Test cases (P2), EP/BVA/decision table (P3), unit tests (P5), BDD (P6) |
| **Security** | Confidentiality, integrity, authenticity, accountability | Users only see their own scans (no IDOR). Passwords are hashed. JWTs are verified. SSRF is blocked. Brute force is rate-limited. | OWASP checks A01 and A10 (P9), decision table (P3), API tests (P7) |
| **Performance efficiency** | Time behaviour, capacity | API response time stays acceptable under concurrent users | JMeter load test (P9) |
| **Reliability** | Fault tolerance, availability | Unreachable target, timeout or invalid ID produce a clean JSON error, not a crash | Negative test cases (P2), API tests (P7) |
| **Usability** | Learnability, user-error protection | Clear validation messages, delete confirmation, required ownership checkbox | Manual UI test cases (P2), Selenium (P7) |
| **Maintainability** | Testability, modularity, analysability | Code smells, duplication, complexity, coverage | White-box analysis (P4), SonarQube (P11) |
| **Compatibility** | Interoperability | React client and REST API agree on the JSON contract | Postman contract checks (P7) |
| Portability | Installability, adaptability | Runs on a clean Linux CI runner | GitHub Actions (P8) |

## 5. Verification vs. validation

| | Verification: "Are we building the product **right**?" | Validation: "Are we building the **right** product?" |
|---|---|---|
| Question | Does the code conform to its specification and design? | Does the product meet the user's real need? |
| Type | Mostly **static** (no execution) plus spec-based checks | **Dynamic**: run the software the way a user would |
| Activities in this project | Code review of validators and controllers, white-box analysis (control-flow graph, cyclomatic complexity), SonarQube static analysis, unit tests against the spec | Manual UI test cases on the running app, BDD acceptance scenarios written in user language, Selenium end-to-end flows, load testing |
| Example | Reading `authValidators.js` and `authController.js` side by side to check that the email rules used at registration match those used at login | A user registers with `first.last@gmail.com` and then tries to log in with the same address |
| Performed by | QA team (reviewer), tools | QA team acting as end users |

Both are needed. Verification catches defects early and cheaply. Validation catches cases where the code matches the spec but the spec is wrong for the user.

## 6. Test approach / strategy

| Level | Type | Technique | Tool | Phase |
|---|---|---|---|---|
| Unit | White-box + black-box | Statement and branch coverage, EP, BVA, TDD | Jest (+ existing `node:test`) | P4, P5 |
| Integration (API) | Black-box | EP, BVA, decision table, contract checks | supertest, Postman + Postman CLI | P5, P7 |
| System (UI end-to-end) | Black-box | Use-case and scenario testing | Manual (Chromium), Selenium WebDriver | P2, P7 |
| Acceptance | Black-box | BDD, Given/When/Then | Cucumber (Gherkin) | P6 |
| Non-functional | Performance | Load and stress | Apache JMeter | P9 |
| Non-functional | Security | OWASP Top 10 manual checks (A01, A07, A10) | curl / Postman | P9 |
| Static | Verification | Review, metrics | SonarQube Community | P4, P11 |
| Regression | Automated suite on every push | | GitHub Actions | P8 |

We prioritised by risk. Authentication, authorisation (keeping each user's data separate), SSRF and the correctness of the scoring got the most attention, because a defect in any of them means either a security breach or a wrong security grade for the user. Cosmetic UI issues had the lowest priority.

## 7. Risks and mitigations

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Tests write to the production Atlas DB | Medium | High | MONGO_URI is overridden by a QA launcher to point at a local `mongod` on port 27099. `server/.env` is never edited. |
| R2 | Scanning real third-party sites (legal or ethical issue) | Medium | High | Scans only target local pages (`localhost`). Load tests never call `/api/scan` against external hosts. |
| R3 | Rate limiters (5 logins, 10 scans, 100 API calls per 15 min) block test runs | High | Medium | Restart the API between suites (the memory store resets). Design BVA tests around the limits on purpose. |
| R4 | The scan depends on network and remote TLS, so results are not deterministic | Medium | Medium | Use local fixture pages. Isolate the check modules with unit tests. |
| R5 | The SSRF guard only runs when `NODE_ENV=production` | High | High | Test the SSRF path in production mode explicitly (P9). Log a defect if it can be bypassed. |
| R6 | Limited time (group assignment) | Medium | Medium | Prioritise by risk (section 6) |

## 8. Test environment (summary; detailed in QA-STLC-02 §4)

| Component | Version / setting |
|---|---|
| OS | Windows 11 Home (local). Ubuntu (GitHub Actions runner) for CI. |
| Node.js | v25.6.0 locally |
| Database | MongoDB 8.3 Community, local, `127.0.0.1:27099`, database `websec_qa` |
| API | `http://localhost:5000`, `NODE_ENV=development` (production mode for the SSRF tests) |
| Client | Vite dev server, `http://localhost:5173` |
| Browser | Chromium (built-in browser pane) |
| Scan targets | Local pages only (the client on :5173 and the API on :5000) |

## 9. Entry and exit criteria

Testing could start once three conditions were met: the code builds and the existing unit suite passes (our baseline was 32 of 32 tests passing on 23 November 2026), the local MongoDB is running and `/api/health` reports `ok`, and the test cases have been reviewed.

We agreed four exit criteria in advance:
- 100% of High-priority test cases, and at least 90% of all test cases, have been executed.
- No Critical or High defect is still open, and any open Medium defect has a documented workaround or root cause analysis.
- Statement coverage of the `server/` business logic (validators, middleware, utilities and controllers) is at least 80%.
- The CI pipeline is green on the QA branch.

We would suspend testing if the environment became unavailable (for example, the database going down) or if a blocking defect stopped more than 30% of the cases, and resume once the fix had been verified.

## 10. Deliverables

| Deliverable | Path |
|---|---|
| Test plan (this document) | `qa/01-test-plan/test-plan.md` |
| STLC + environment | `qa/02-stlc/stlc-and-environment.md` |
| Test cases + execution log | `qa/02-stlc/test-cases.md`, `qa/02-stlc/execution-results.md` |
| Black-box design (EP, BVA, decision table) | `qa/03-black-box/` |
| White-box analysis | `qa/04-white-box/` |
| Unit and BDD tests | `qa/05-unit/`, `qa/06-bdd/` |
| Postman, Selenium, CI | `qa/07-postman-selenium/`, `qa/08-ci/`, `.github/workflows/` |
| JMeter and OWASP | `qa/09-performance-security/` |
| Defect reports + RCA | `qa/10-defects/` |
| SonarQube metrics | `qa/11-metrics/` |
| Reflection | `qa/12-reflection/` |
| Evidence (screenshots, logs) | `qa/evidence/` |

## 11. Roles (group)

We split the work by QA role, so that each member owned a set of phases from start to finish, and we reviewed each other's work through pull requests.

| Member | Registration No. | Role | Responsibilities | Phases |
|---|---|---|---|---|
| Thanthrige D.P. | EG/2023/5916 | Test lead, automation engineer | Test plan, schedule and exit decision; Jest unit tests and TDD fixes; the CI pipeline; test summary report and reflection | 1, 5, 8, 12 |
| Wijerathna K.A.A.M. | EG/2023/5971 | Test designer | STLC, test environment and test cases; black-box design (EP, BVA, decision tables); white-box analysis (control flow, cyclomatic complexity, coverage) | 2, 3, 4 |
| Rathnaweera R.P.B.P. | EG/2023/5828 | Automation, performance and security tester | Cucumber BDD scenarios; Postman API and Selenium UI automation; JMeter load testing and OWASP security testing | 6, 7, 9 |
| Jayasekara J.M.O.S. | EG/2023/5658 | Defect manager, quality metrics | Defect tracking, root cause analysis and lifecycle; defect metrics; SonarQube static analysis | 10, 11 |

## 12. Schedule

| Phase | Activity |
|---|---|
| P1–P2 | Plan, STLC, test case design and first execution |
| P3–P4 | Black-box and white-box design |
| P5–P6 | Unit (TDD) and BDD |
| P7–P8 | Automation and CI |
| P9 | Performance and security |
| P10–P11 | Defects, RCA, SonarQube |
| P12 | Reflection and final report |
