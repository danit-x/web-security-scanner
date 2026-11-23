# Phase 6: Behaviour-Driven Development (Cucumber)

**Tool:** Cucumber.js 12.9 (`@cucumber/cucumber`) with supertest, running the real Express app in-process (`server/app.js`).
**Environment:** local MongoDB `127.0.0.1:27099` only. The hooks refuse to start against any other host, and each run uses a throw-away database. The only scan target is the deliberately weak local fixture website from Phase 5.
**Result:** 4 features, **44 scenarios, 202 steps, 44 passed** (≈10 s). Report: [../evidence/bdd/cucumber-report.html](../evidence/bdd/cucumber-report.html).

```powershell
npm run test:bdd --prefix server                       # all scenarios
npm run test:bdd --prefix server -- --tags "@smoke"    # 4 smoke scenarios
npm run test:bdd --prefix server -- --tags "@security" # SSRF, IDOR, brute force, tokens
npm run test:bdd --prefix server -- --tags "@regression"
```

## 1. What BDD is

BDD extends TDD. The expected behaviour is written first, as examples in plain business language (Gherkin). Business, developers and testers (the "three amigos") agree on those examples, and Cucumber then runs them as automated acceptance tests.

| | TDD (Phase 5) | BDD (Phase 6) |
|---|---|---|
| Question answered | Is the code built right? | Are we building the right behaviour? |
| Written in | Code (Jest `test()`) | Gherkin: `Given` / `When` / `Then` |
| Audience | Developers | The whole team, including non-technical stakeholders |
| Level | Unit / API | Acceptance (user-visible behaviour) |
| By-product | Regression safety net | Living documentation that cannot go stale, because it is executed |

### Gherkin keywords used

| Keyword | Meaning | Example in this suite |
|---|---|---|
| `Feature` + user story | The capability and its business value ("As a… I want… So that…") | every `.feature` file |
| `Background` | Steps shared by every scenario in a file | login.feature registers Alice once per scenario |
| `Scenario` | One concrete example of behaviour | "Correct credentials give a working token" |
| `Given` | Precondition (state) | `Given a registered user "Alice" …` |
| `When` | The single action under test | `When I log in with email … and password …` |
| `Then` / `And` | Observable outcome | `Then the response status should be 200` |
| `Scenario Outline` + `Examples` | One scenario, many data rows (data-driven) | password EP/BVA rows, SSRF targets |
| Tags `@…` | Select or group scenarios | `@smoke`, `@security`, `@regression`, `@DEF-001`, `@production` |

### How Cucumber executes it

```
.feature (Gherkin)  --matches-->  step definition (JS)  --calls-->  real API (supertest)  -->  local MongoDB
     "When I log in with email {string} …"    When("I log in with email {string} …", fn)
```

- **Cucumber expressions** such as `{string}` and `{int}` extract the parameters. One regular expression drives the IDOR outline (`tries to (view|add a note|delete)`).
- The **World** (`support/world.js`) is a new object for each scenario, so steps in one scenario share state (`this.response`, `this.users`), and nothing leaks into the next scenario.
- **Hooks** (`support/hooks.js`):
  - `BeforeAll` connects to the DB and starts the fixture site.
  - `Before` empties every collection, so each scenario is independent.
  - `Before/After @production` switch the production-only SSRF guard on and off.
  - `After` attaches the last response to the report when a scenario fails.
- Each scenario gets its own client IP (`X-Forwarded-For`; the app trusts one proxy hop), so the per-IP rate limiters do not leak between scenarios.
- `strict: true` in `server/cucumber.js`: an undefined or pending step fails the run, so a typo in Gherkin cannot pass silently.

**Declarative vs. imperative steps.** The steps describe *what* the user does ("Alice adds the note … to alice-scan"), not *how* ("PATCH /api/history/:id with body …"). The HTTP details live in the step definitions, so a stakeholder can read the features. If an endpoint changes, only one step definition changes.

## 2. Files

| File | Contents |
|---|---|
| [features/registration.feature](features/registration.feature) | 6 scenarios / 11 examples: sign-up, hashing, duplicate, EP/BVA outline, DEF-005 regression |
| [features/login.feature](features/login.feature) | 7 scenarios / 8 examples: login, case-insensitivity, no user enumeration, DEF-001 + DEF-002 regressions, bad token, brute-force limit |
| [features/scan.feature](features/scan.feature) | 7 scenarios / 15 examples: graded report, each detected weakness, redirects, consent, invalid URLs, auth, SSRF in production |
| [features/scan-history.feature](features/scan-history.feature) | 6 scenarios / 10 examples: own history only, notes, note-length BVA, delete, IDOR outline, malformed ID |
| [steps/common.steps.js](steps/common.steps.js) | shared Given/Then: user setup, status, message, no stack trace |
| [steps/auth.steps.js](steps/auth.steps.js) | registration / login / token steps |
| [steps/scan.steps.js](steps/scan.steps.js) | scan and history steps |
| [support/](support/) | World, hooks, test env, package resolution from `server/` |
| [server/cucumber.js](../../server/cucumber.js) | runner config: paths, HTML + JSON report, strict mode |

## 3. Traceability (scenario → test case)

| Feature / scenario | Test cases (Phase 2) | Black-box / defect link |
|---|---|---|
| A new visitor registers successfully | TC-REG-01, TC-REG-11 | |
| The stored password is hashed | TC-REG-11 | ISO 25010 security / confidentiality |
| Email cannot be registered twice, in any case | TC-REG-02, TC-REG-09 | |
| Invalid registration details (outline, 6 rows) | TC-REG-03, TC-REG-05, TC-REG-06 | EP-PW, BVA-PW (7 chars), EP-EM |
| Shortest allowed password accepted | TC-REG-04 | BVA-PW (8 chars, on-boundary) |
| Password sent as a number | | **DEF-005** regression |
| Correct credentials give a working token | TC-LOG-01, TC-AUTH-01 | |
| Email not case-sensitive at login | TC-REG-09 | |
| Wrong credentials get the same error (outline, 2 rows) | TC-LOG-02, TC-LOG-03 | no user enumeration |
| Gmail user with dots and +tag can log back in | TC-REG-10 | **DEF-001**, **DEF-008** regression |
| Malformed JSON gets a clean 400 | TC-API-05 | **DEF-002** regression |
| Protected pages refuse an invalid token | TC-AUTH-03 | |
| Repeated failed logins are throttled | TC-LOG-05 | OWASP A07 (auth failures) |
| Scanning my own website gives a graded report | TC-SCAN-01 | |
| Scanner detects each weakness (outline, 4 rows) | TC-SCAN-01 | checks: headers, HTTPS, cookies, libraries |
| Redirects are followed | TC-SCAN-01 | |
| A scan needs the owner's permission | TC-SCAN-02 | |
| Invalid target addresses (outline, 2 rows) | TC-SCAN-03, TC-SCAN-05 | |
| Scanning requires being logged in | TC-SCAN-07 | |
| In production, internal targets are blocked (outline, 5 rows) | | OWASP A10 (SSRF), **OBS-05** regression (`[::1]`) |
| My history lists only my scans, newest first | TC-HIS-01 | |
| I can add a note to my scan | TC-NOTE-01 | |
| Note length limit (outline: 0 / 500 / 501) | TC-NOTE-02 | BVA on the 500-char limit |
| I can delete my scan and it is gone | TC-DEL-01 | |
| Another user's scan is invisible (outline: view / note / delete) | TC-HIS-03, TC-NOTE-04, TC-DEL-02 | OWASP A01 (IDOR) |
| A malformed scan ID is rejected | TC-HIS-04 | |

**Not covered here, deliberately:**
- UI cases (TC-UI-*) belong to Selenium in Phase 7.
- The scan rate limit (TC-SCAN-08), unreachable host (TC-SCAN-06) and expired token (TC-AUTH-04) are already automated in Jest (Phase 5).
- Load and abuse testing belongs to JMeter in Phase 9.

## 4. Do the scenarios actually catch bugs? (mutation check)

All 44 scenarios passed on the first run, because Phase 5 had already fixed the defects. A suite that has never failed proves nothing, so three realistic bugs were planted in the source one at a time, the suite was run, and the source was restored with `git checkout`:

| Mutant (bug planted) | File | Result | Scenario that caught it |
|---|---|---|---|
| M1: ownership check removed from `GET /history/:id` (IDOR) | routes/scanRoutes.js | **killed**: 1 failed / 43 passed | Another user's scan is invisible to me |
| M2: login limit raised from 5 to 50 | middleware/rateLimiter.js | **killed**: 1 failed / 43 passed | Repeated failed logins are throttled |
| M3: `169.254.x.x` (cloud metadata) removed from the SSRF blocklist | validators/scanValidators.js | **killed**: 1 failed / 43 passed | In production, internal targets are blocked |

Mutation score: **3/3 (100 %)**. Each mutant was caught by exactly the scenario written for that behaviour and by nothing else. That shows the scenarios are specific: a failure points straight at the broken behaviour.

## 5. Defects

No new defects were found. The regression scenarios tagged `@DEF-001`, `@DEF-002` and `@DEF-005`, plus the `[::1]` SSRF row (OBS-05), confirm that the Phase 5 fixes still hold at the acceptance level. Regression check: the Jest suite still passes 210/210 after this phase.

## 6. Evidence

- [../evidence/bdd/cucumber-report.html](../evidence/bdd/cucumber-report.html): interactive report (features, scenarios, step timings)
- [../evidence/bdd/cucumber-report.json](../evidence/bdd/cucumber-report.json): machine-readable results (for CI in Phase 8)
