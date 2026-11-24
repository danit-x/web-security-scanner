# Test Summary Report: Website Security Scanner (MERN)

| Item | Value |
|---|---|
| Document ID | QA-TSR-12 |
| Plan it closes | [QA-TP-01 test plan](../01-test-plan/test-plan.md) |
| Standard | IEEE 829 Test Summary Report / ISO/IEC/IEEE 29119-3 Test Completion Report (condensed) |
| Build tested | `main` @ `ba8a9ba` (as handed to QA), with the fixes made on `qa/ec4206-testing` |
| Final build | `main` @ `7b03a3f` (all phases merged and deployed) |
| Final CI run | [45411465382](https://github.com/danit-x/web-security-scanner/actions/runs/45411465382): all 7 jobs passed (screenshots in `qa/evidence/ci/`) |
| Date | 2026-11-24 |

## 1. Summary

We tested the Website Security Scanner over eleven phases, from the test plan through to static analysis. Along the way we found 10 defects (2 High, 4 Medium and 4 Low) and 9 observations. All 10 defects have been fixed and closed, and every fix was made test-first: we wrote a failing test, fixed the code, and ran the test again. Six of the observations are closed. The other three (OBS-07, OBS-08 and OBS-09) are deferred as documented recommendations, and none of them is a functional failure.

All four exit criteria in the test plan are met (section 5). We recommended releasing, and the QA branch has since been merged into `main` and deployed. A smoke test on the live site passed (section 8).

## 2. What was tested

All 11 features in the plan (F1 to F11) were tested at the levels the plan set out. The figures below are from the final build.

| Level / type | Technique | Tool | Final result | Evidence |
|---|---|---|---|---|
| System, functional | Scripted test cases (STLC) | Node runner and manual UI | 45/45 automated API cases and 10/10 manual UI cases pass | [02-stlc](../02-stlc/) |
| System, black-box | EP, BVA, decision tables | Node runner | 123/123 pass (120/123 before the fixes) | [03-black-box](../03-black-box/) |
| Unit, white-box | Control-flow graphs, cyclomatic complexity, basis paths | node:test, V8 coverage, ESLint | 25 basis-path tests; 57 node:test tests in total | [04-white-box](../04-white-box/) |
| Unit and integration | TDD, coverage | Jest and supertest | 259 pass; 95.0 % statement and 89.1 % branch coverage | [05-unit](../05-unit/tdd-log.md) |
| Acceptance | BDD (Given/When/Then) | Cucumber.js | 44 scenarios and 202 steps pass; 3/3 planted bugs caught | [06-bdd](../06-bdd/bdd-notes.md) |
| API contract | Chained requests, schema checks, data-driven runs | Postman CLI | 43 requests, 288 + 72 = 360 assertions pass | [07-postman-selenium](../07-postman-selenium/phase7-notes.md) |
| System, UI end-to-end | Page Object Model, explicit waits | Selenium WebDriver and Mocha | 11/11 pass, at desktop and mobile width | [07-postman-selenium](../07-postman-selenium/phase7-notes.md) |
| Regression | Continuous integration | GitHub Actions | 7 jobs on every push; Node 22 and 24; coverage gate of 90/85/90/90 | [08-ci](../08-ci/ci-notes.md) |
| Performance | Load, stress, spike, breakpoint | JMeter 5.6.3 | 26,057 requests with 0 errors; every target met up to 400 users | [09-performance-security](../09-performance-security/phase9-notes.md) |
| Security | SCA, DAST, scripted OWASP Top 10 | npm audit, OWASP ZAP 2.17, Jest | 0 vulnerabilities in production dependencies; ZAP rescan with 0 Medium or Low alerts; A01 to A10 tests pass | [09-performance-security](../09-performance-security/phase9-notes.md) |
| Static | Code quality metrics, taint analysis | SonarQube Community 26.11 and SonarCloud (CI) | Quality gate passed; 93.9 % coverage; 2.5 % duplication; 0 hotspots. The bugs and vulnerabilities SonarCloud reports were all triaged as false positives or not exploitable | [11-metrics](../11-metrics/sonar-metrics.md) |

## 3. Variances from the plan

| The plan said | What actually happened | Why |
|---|---|---|
| Scan targets on `localhost` (:5173 / :5000) | We used a local fixture site on `127.0.0.1:5070` | A fixture page gives known, repeatable findings. The URL validator rejected `localhost` at first (DEF-004), so the cases were written with `127.0.0.1`. |
| R3: restart the API between suites to reset the rate limits | Each test client sends its own random `X-Forwarded-For` (the API trusts one proxy hop) | Restarting does not scale to JMeter or CI, and a separate IP per client is more realistic anyway. |
| Manual OWASP checks for A01, A07 and A10 with curl and Postman | Expanded to SCA, a ZAP DAST scan and scripted Jest tests for A01 to A10 | The SSRF review (DEF-009) showed that a few manual spot checks were not enough. |
| SonarQube Community, run locally | Local SonarQube for the detailed report, plus SonarCloud in CI on every push | SonarCloud adds a check on every pull request and taint analysis. Its three taint findings were triaged as not exploitable. |
| Node.js 25 locally | CI also runs on Node 22 and 24 (the LTS versions) | Portability (ISO 25010). |
| Not planned | No soak test (a run lasting several hours) | Time. We recommend one before a public launch (section 7). |
| Out of scope | No cross-browser matrix or WCAG audit | As planned (section 3.2 of the plan). |

## 4. How complete the testing was

All 11 features were covered, and every High-priority feature (F1 to F7) is tested at three or more independent levels: the API cases, BDD and Jest, plus Selenium for the UI flows. All eight ISO 25010 characteristics in the plan were tested, each with at least one phase of evidence. Usability, however, was only covered by the manual UI cases and Selenium; we did no user study.

Jest covers 95.0 % of the server's statements. `runScan`, the riskiest function with a complexity of 32, went from 23.9 % to 98.5 % line coverage.

We also checked that the tests detect faults rather than simply running the code. The BDD suite caught all three bugs we planted on purpose, and the CI pipeline turned red when we removed the IDOR check in the Phase 8 demonstration.

## 5. Exit criteria (test plan, section 9)

| # | Criterion | Result | Evidence | Status |
|---|---|---|---|---|
| 1 | 100 % of High-priority cases and at least 90 % of all cases executed | All 55 Phase 2 cases were executed (100 %). Final regression: 45/45 API, 123/123 black-box, 11/11 UI | [execution-results.md](../02-stlc/execution-results.md), `qa/evidence/api-run-*T11-09-31*.json`, `qa/evidence/black-box-*T13-15-34*.json` | Met |
| 2 | No open Critical or High defects; any open Medium defect has a workaround or RCA | All 10 defects are closed, including both High defects (DEF-001 and DEF-009). The three deferred items are observations with recommendations | [defect-log.md](../10-defects/defect-log.md), [rca.md](../10-defects/rca.md) | Met |
| 3 | Statement coverage of the `server/` business logic of at least 80 % | 95.0 % in Jest; 93.9 % by SonarQube's combined line and branch measure. CI enforces at least 90 % | `qa/evidence/coverage/jest/`, [sonar-metrics.md](../11-metrics/sonar-metrics.md) | Met |
| 4 | CI pipeline green | Run 45411465382 on `main` (`7b03a3f`): lint and build, unit and API tests on Node 22 and 24, BDD, Postman, Selenium and SonarCloud all passed | `qa/evidence/ci/` | Met |

The suspension criteria were never triggered: the database was always available, and no blocking defect stopped more than 30 % of the cases.

## 6. Defects and observations

| Severity | Found | Closed | Open |
|---|---|---|---|
| High | 2 (DEF-001 Gmail login lockout, DEF-009 SSRF through redirects or DNS rebinding) | 2 | 0 |
| Medium | 4 (DEF-002, 005, 008, 010) | 4 | 0 |
| Low | 4 (DEF-003, 004, 006, 007) | 4 | 0 |
| Total | 10 | 10 | 0 |

Phase 2 found 4 of the defects, black-box testing 2, white-box testing 1, a retest after a fix 1, and security testing 2. The developers' original 32 tests found none of them, so their defect removal efficiency was 0 %. Defect density works out at about 5.4 defects per 1,000 lines of server code and 3.5 for the whole app, which is within McConnell's typical range of 1 to 25.

Eighty per cent of the defects fall into two root-cause categories: an error type that was not handled, and a rule enforced in one place while the same data is used in another. The details are in [defect-metrics.md](../10-defects/defect-metrics.md) and [rca.md](../10-defects/rca.md).

Three observations remain deferred. OBS-07: sign-up has no dedicated rate limit. OBS-08: bcrypt caps authentication at about 32 requests per second per endpoint. OBS-09: `runScan` has a cognitive complexity of 28, and we recommend refactoring it.

## 7. Residual risks (what testing did not prove)

| Risk | Why it remains | Suggested action |
|---|---|---|
| Accounts registered on the live system before the DEF-001 fix | QA never touches the Atlas database. Those Gmail users were stored without dots or `+tags`, so they may be unable to log in. | The owner checks the live users once and migrates them or resets their passwords. |
| Abuse of the sign-up endpoint (OBS-07) | It is the most CPU-expensive endpoint and has no dedicated limit. | Re-enable `registerLimiter`. |
| Peak authentication load (OBS-08) | Capacity was measured on one laptop, not on Render. | Set `UV_THREADPOOL_SIZE` and repeat the load test on the hosting tier. |
| Memory leaks over time | No soak test was run. | Run a 2 to 4 hour JMeter soak test before a public launch. |
| Browser compatibility and accessibility | Out of scope. | Run a cross-browser smoke test and an axe or Lighthouse audit. |
| Maintainability of `runScan` (OBS-09) | High complexity, although well tested. | Refactor it, using the 259 Jest tests and 44 BDD scenarios as a safety net. |

## 8. Recommendation and release

We recommended releasing, on two conditions: that the Content-Security-Policy in `client/security-headers.json` allows the real production API address (`https://*.onrender.com`), and that a smoke test follows the deployment. Both conditions have been met.

The owner confirmed that the API is hosted on Render (`https://web-security-scanner-iir0.onrender.com`) and that the client is on Vercel (`https://web-security-scanner.vercel.app`). After the merge into `main` on 23 November 2026, we checked the live deployment. The API health check returned `ok`. CORS accepted requests from the Vercel site and rejected a foreign origin with a 403. The new password rule and the clean 400 response for malformed JSON were both active, which confirmed that production was running the fixed code. The pages loaded in Chrome without any security-policy errors. Finally, a real user logged in on the live site and scanned the site itself, which received a grade of A.

## 9. Approvals

| Role | Name | Registration No. | Decision | Date |
|---|---|---|---|---|
| Test lead | Thanthrige D.P. | EG/2023/5916 | | |
| Test designer | Wijerathna K.A.A.M. | EG/2023/5971 | | |
| Automation, performance and security tester | Rathnaweera R.P.B.P. | EG/2023/5828 | | |
| Defect manager | Jayasekara J.M.O.S. | EG/2023/5658 | | |
