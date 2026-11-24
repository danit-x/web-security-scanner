# Phase 6: Behaviour-Driven Development (Cucumber)

For this phase we used Cucumber.js 12.9 together with supertest, which runs the real Express app (`server/app.js`) inside the test process. Everything ran against the local MongoDB on `127.0.0.1:27099`; the hooks refuse to start against any other host, and every run gets its own throw-away database. The only website we scanned was the deliberately weak local fixture site from Phase 5.

The final suite has 4 features, 44 scenarios and 202 steps, and all 44 scenarios pass in about 10 seconds. The full report is in [../evidence/bdd/cucumber-report.html](../evidence/bdd/cucumber-report.html).

```powershell
npm run test:bdd --prefix server                       # all scenarios
npm run test:bdd --prefix server -- --tags "@smoke"    # 4 smoke scenarios
npm run test:bdd --prefix server -- --tags "@security" # SSRF, IDOR, brute force, tokens
npm run test:bdd --prefix server -- --tags "@regression"
```

## 1. What BDD is

BDD grows out of TDD. Instead of starting from code, the team first writes down the expected behaviour as concrete examples in plain language, using the Gherkin format. The business side, the developers and the testers (often called the "three amigos") agree on these examples, and Cucumber then runs them as automated acceptance tests.

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

Cucumber matches each Gherkin line to a step definition written in JavaScript. Placeholders such as `{string}` and `{int}` pull the values out of the sentence, and for the IDOR outline we used one regular expression (`tries to (view|add a note|delete)`) to cover all three actions.

Each scenario gets a fresh World object (`support/world.js`). Steps within a scenario share state through it, such as the last response and the users created, but nothing carries over into the next scenario. The hooks in `support/hooks.js` handle setup: `BeforeAll` connects to the database and starts the fixture site, `Before` empties every collection so each scenario starts clean, the `@production` hooks switch the production-only SSRF guard on and off, and `After` attaches the last response to the report whenever a scenario fails.

Two smaller details made the suite reliable. Every scenario sends its own client IP in `X-Forwarded-For` (the app trusts one proxy hop), so the per-IP rate limiters never carry over from one scenario to the next. We also set `strict: true` in `server/cucumber.js`, which makes any undefined or pending step fail the run, so a typo in a feature file cannot slip through as a silent pass.

We kept the steps declarative. They describe what the user does ("Alice adds the note … to alice-scan"), not how the request is made ("PATCH /api/history/:id with body …"). The HTTP details live in the step definitions, which keeps the feature files readable for non-developers and means that if an endpoint changes, only one step definition needs updating.

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

Some cases are deliberately left out of the BDD suite. The UI cases (TC-UI-*) are covered by Selenium in Phase 7. The scan rate limit (TC-SCAN-08), the unreachable host (TC-SCAN-06) and the expired token (TC-AUTH-04) were already automated in Jest in Phase 5. Load and abuse testing belongs to JMeter in Phase 9.

## 4. Do the scenarios actually catch bugs? (mutation check)

All 44 scenarios passed the first time we ran them, because Phase 5 had already fixed the defects. That sounds good, but a suite that has never failed does not prove much. To check that ours could actually catch problems, we planted three realistic bugs in the source code one at a time, ran the suite after each, and restored the code with `git checkout` afterwards:

| Mutant (bug planted) | File | Result | Scenario that caught it |
|---|---|---|---|
| M1: ownership check removed from `GET /history/:id` (IDOR) | routes/scanRoutes.js | **killed**: 1 failed / 43 passed | Another user's scan is invisible to me |
| M2: login limit raised from 5 to 50 | middleware/rateLimiter.js | **killed**: 1 failed / 43 passed | Repeated failed logins are throttled |
| M3: `169.254.x.x` (cloud metadata) removed from the SSRF blocklist | validators/scanValidators.js | **killed**: 1 failed / 43 passed | In production, internal targets are blocked |

All three mutants were killed, giving a mutation score of 3/3. Better still, each one was caught by exactly the scenario written for that behaviour and by nothing else, so when a scenario fails it points straight at what broke.

## 5. Defects

This phase found no new defects. The regression scenarios tagged `@DEF-001`, `@DEF-002` and `@DEF-005`, together with the `[::1]` SSRF row for OBS-05, confirmed that the Phase 5 fixes still hold at the acceptance level. The Jest suite also still passed 210/210 at the end of this phase.

## 6. Evidence

- [../evidence/bdd/cucumber-report.html](../evidence/bdd/cucumber-report.html): interactive report (features, scenarios, step timings)
- [../evidence/bdd/cucumber-report.json](../evidence/bdd/cucumber-report.json): machine-readable results (for CI in Phase 8)
