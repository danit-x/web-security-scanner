# Unit Testing (Jest) and TDD Log

| Item | Value |
|---|---|
| Document ID | QA-UT-05 |
| Framework | **Jest 30.5.2** (the JavaScript equivalent of JUnit, NUnit or PyTest) + **supertest 7.3.2** for in-process HTTP tests |
| Run | `npm run test:unit --prefix server` · with coverage: `npm run test:coverage --prefix server` |
| Config | [`server/jest.config.js`](../../server/jest.config.js). Tests live in `qa/05-unit`, and `@server/...` maps to the app code. |
| Database | A throw-away database per test file on the **local** MongoDB (`helpers/db.js` refuses non-local URIs) |
| Evidence | `qa/evidence/tdd/` (RED/GREEN runs), `qa/evidence/coverage/jest-coverage.txt`, `qa/evidence/coverage/jest/lcov.info` (for SonarQube in Phase 11) |

## 1. Concepts

A unit test checks one unit of code, such as a function or a module, on its own. It should be fast and give the same result every time. To keep the unit isolated, we replaced its collaborators with test doubles:

| Double | Used here for |
|---|---|
| Stub (canned answer) | `dns.promises.lookup` returns a chosen IP (SSRF tests). `tls.connect` returns a fake socket (SSL certificate tests). |
| Mock (records calls) | `res.status` / `res.json` / `next` in middleware tests, checked with `toHaveBeenCalledWith` |
| Spy (wraps the real one) | `jest.spyOn(User, "findOne").mockRejectedValueOnce(...)` to simulate a database outage for one call |
| Fake | A local HTTP fixture site as the scan target. A local MongoDB in place of Atlas. |

Test-driven development (TDD) follows a short cycle known as red, green, refactor. First we write a test for the behaviour we want and watch it fail, making sure it fails for the right reason. Then we make the smallest code change that turns it green. Finally we tidy the code while the tests stay green, and run the whole suite again as a regression check.

For defects, this means reproducing the bug as a failing test before touching the code. That test then stays in the suite, so the same bug cannot quietly come back later.

Every test follows the Arrange, Act, Assert pattern: set up the data, call the unit, then check the result.

## 2. Testability refactor (before any fix)

Originally, `server.js` built the Express app, connected to MongoDB and started listening, all as a side effect of being loaded. That made it impossible for a test to load the app without starting a real server. We moved the app itself into `server/app.js`, which only builds and exports it, and left `server.js` to load the environment, connect and listen. This changed no behaviour: the Phase 2 and Phase 3 suites gave identical results before and after the move.

## 3. TDD log: defects fixed test-first

We wrote all the regression tests first, in [`regression/defects.test.js`](regression/defects.test.js), before changing any application code.

On the first (red) run, recorded in `01-red.txt`, 20 tests failed and 2 passed. The two passes were intentional guard tests ("the real frontend origin is still allowed" and "a public IPv6 address is still allowed"), there to make sure a fix would not end up blocking legitimate traffic.

| Step | Defect | RED: why it failed (actual) | Fix | GREEN evidence |
|---|---|---|---|---|
| 1 | DEF-001 | Stored as `firstlast@gmail.com` (dots **and** `+tag` removed). Login → 401. | `normalizeEmail()` replaced by `toLowerCase()` | `02-still-red-…` (still failing), then `04-green-DEF-001-008.txt` |
| 1a | **DEF-008** (new) | After step 1, register → **400**. Root cause: the model regex rejects `+` and long TLDs. | Model regex → sanity check | `03-red-DEF-008.txt` → `04-green-DEF-001-008.txt` |
| 2 | DEF-002 | 500, stack in body | `errorHandler` honours `err.status`. Malformed-JSON message. Stack only on 5xx. | `05-green-DEF-002-003.txt` |
| 3 | DEF-003 | 500 | CORS error carries `status 403` | `05-green-DEF-002-003.txt` |
| 4 | DEF-004 | `isURL` rejects `localhost` | `require_tld: false` | `06-green-DEF-004-OBS-05.txt` |
| 5 | OBS-05 | `[::1]`, `[::ffff:…]` etc. rejected by DNS failure, not by the IP rule | Strip brackets, add IPv6 rules | `06-green-DEF-004-OBS-05.txt` |
| 6 | DEF-005 | 500 (`bcrypt`: data must be a string) | `isString()` on password (register and login) | `07-green-DEF-005.txt` |
| 7 | DEF-006 | `TypeError: Cannot read properties of null` | `finding?.severity` | `07-green-DEF-006.txt` |
| 8 | DEF-007 | 500 (`NotBeforeError` unhandled) | `instanceof jwt.JsonWebTokenError` | `07-green-DEF-007.txt` |
| 9 | OBS-02 | Message "under 100 characters" | "100 characters or fewer" | `07-green-OBS-02.txt` |
| 10 | OBS-01 | (UI) button disabled, message unreachable | `disabled={isScanning}` | `qa/evidence/ui/TC-UI-05-retest-OBS-01-message-shown.jpg` |
| End | All | | | `08-green-all.txt`: 29/29 pass |

Three things stood out while working through this log.

First, a fix can uncover the next defect. Once we removed `normalizeEmail()` for DEF-001, registration started failing with a 400. The model's own email regex rejected `+` and longer domain endings, and the old normalisation had been hiding that. Because we re-ran the tests after every single fix rather than fixing everything and testing once at the end, the cause was obvious straight away. We logged it as DEF-008.

Second, guard tests matter whenever a rule is relaxed. Setting `require_tld: false` lets more hostnames through to the SSRF guard, so we added four tests proving that disguised forms of `127.0.0.1` (`2130706433`, `0x7f.0.0.1`, `127.1` and `0177.0.0.1`) are still blocked. The OBS-05 fix also needed a new rule for IPv4-mapped IPv6 addresses (`::ffff:`). Without it, stripping the brackets from IPv6 hosts would have opened a bypass that a DNS failure had, by accident, been keeping closed.

Third, when a test fails, the test itself may be the thing that is wrong. A test calling `checkCookies("string")` failed because it assumed a plain string would be accepted. The function's documented contract is an array of strings, which is exactly what axios always passes in, so we corrected the test and left the code alone.

## 4. Test suite inventory (210 tests, 9 suites)

| File | Level | Tests | Covers |
|---|---|---|---|
| `regression/defects.test.js` | Unit + API | 29 | One `describe` per DEF/OBS |
| `unit/scoring.test.js` | Unit | 35 | Phase 3 BVA/EP tables as `test.each` |
| `unit/authMiddleware.test.js` | Unit | 9 | All 8 basis paths (Phase 4) + malformed token |
| `unit/validators.test.js` | Unit | 45 | Register/login rules, `handleValidationErrors`, SSRF guard (stubbed DNS), note rules |
| `unit/errorHandler.test.js` | Unit | 16 | Every error-translation branch, stack policy, `notFound`, `asyncHandler` |
| `unit/checks.test.js` | Unit | 35 | All 6 check modules. File exposure against a local server, SSL via a stubbed `tls.connect`. |
| `integration/auth.api.test.js` | API | 12 | Register, me, login (incl. DB-failure 500s and the 5/6 login limit) |
| `integration/scan.api.test.js` | API | 21 | Scan → saved report, redirects, 404 pages, refused connections. History, notes and delete ownership rules. Hardening. |
| `integration/scan.faults.test.js` | API | 8 | Fault tolerance: every check throws, DB save fails, 6 fetch-error codes |

## 5. Coverage (Jest, all server files, including ones no test loads)

| Metric | Result | Test-plan target |
|---|---|---|
| Statements | **95.55%** (602/630) | ≥ 80% ✅ |
| Branches | **90.21%** (249/276) | |
| Functions | **94.36%** (67/71) | |
| Lines | **96.40%** (590/612) | ≥ 80% ✅ |

Per-file figures are in `qa/evidence/coverage/jest-coverage.txt`. In Phase 4, node:test only measured the files that a test happened to load (58%). This time we used `collectCoverageFrom` so that every server file counts, including files no test touches, which means nothing can hide from the figure.

The table below lists what is still not covered and why.

| Lines | Reason | Action |
|---|---|---|
| `scanController.js` 57, 82 | Controller re-validates the URL (`!url`, `new URL` catch) after the route validator already did. **Unreachable duplicate validation.** | Remove in Phase 11 refactor |
| `scanValidators.js` 50 | `new URL` catch after `isURL` + `bail`: the infeasible path P2 from Phase 4 | Remove in Phase 11 |
| `models/User.js` 37, 45–51 | `pre('save')` re-hash guard and `matchPassword()`. The controller hashes and compares with bcrypt directly, so this is **dead code**. | Phase 11 (code smell) |
| `rateLimiter.js` 22, 38 | 429 handlers for the scan and general limits: tested at API level by the Phase 3 runner (BVA-RL-06, BVA-RL-10), not in Jest | Accepted |
| `authController.js` 8, 50–53 | Missing `JWT_SECRET` and Mongoose `ValidationError` branches (the latter is pre-empted by the route validators) | Accepted |
| `fileExposureCheck.js`, `libraryCheck.js`, `mixedContentCheck.js` (a few branches) | Defensive `typeof` guards and rare HTML shapes | Accepted (low risk) |

## 6. Full regression after all fixes

| Suite | Before Phase 5 | After Phase 5 |
|---|---|---|
| Jest (new) | – | **210 / 210** |
| node:test: original 32 + 25 basis-path | 56 / 57 | **57 / 57**. BP-P4b and BP-X1 were updated: they asserted the old buggy SSRF behaviour on purpose. |
| Phase 2 API cases (`run-api-cases.mjs`) | 42 / 45 | **45 / 45** |
| Phase 3 black-box (`run-black-box.mjs`) | 120 / 123 | **123 / 123** |
| UI retest TC-UI-05 (OBS-01) | PASS with observation | **PASS**. The message shows. History count 0 confirms no scan was created. |
