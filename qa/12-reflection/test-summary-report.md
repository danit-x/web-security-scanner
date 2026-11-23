# Test Summary Report: Website Security Scanner (MERN)

| Item | Value |
|---|---|
| Document ID | QA-TSR-12 |
| Plan it closes | [QA-TP-01 test plan](../01-test-plan/test-plan.md) |
| Standard | IEEE 829 Test Summary Report / ISO/IEC/IEEE 29119-3 Test Completion Report (condensed) |
| Build tested | `main` @ `ba8a9ba` (as handed to QA); fixes on `qa/ec4206-testing` |
| Final build | `qa/ec4206-testing` @ `74f4931` (all phases 1–11 merged) |
| Final CI run | [45200237209](https://github.com/danit-x/web-security-scanner/actions/runs/45200237209): 7/7 jobs green |
| Date | 2026-11-23 |

## 1. Summary

The Website Security Scanner was tested across 11 phases, from the test plan through static analysis. The testing found **10 defects** (2 High, 4 Medium, 4 Low) and **9 observations**. **All 10 defects are fixed and closed.** Each fix was test-first: a failing test was written, the code was fixed, and the test was rerun. Six observations are closed. Three are deferred as documented recommendations (OBS-07, OBS-08, OBS-09), and none of them is a functional failure.

All four exit criteria of the test plan are met (§5). **Recommendation: the QA branch is fit to merge into `main`**, subject to the two conditions in §8.

## 2. What was tested (scope delivered)

All 11 features in the plan (F1–F11) were tested at the levels the plan set out. The figures are from the final build.

| Level / type | Technique | Tool | Final result | Evidence |
|---|---|---|---|---|
| System, functional | Scripted test cases (STLC) | Node runner + manual UI | 45/45 automated API cases pass; 10/10 manual UI cases pass | [02-stlc](../02-stlc/) |
| System, black-box | EP, BVA, decision tables | Node runner | **123/123** pass (120/123 before the fixes) | [03-black-box](../03-black-box/) |
| Unit, white-box | CFG, V(G), basis paths | node:test, V8 coverage, ESLint | 25 basis-path tests; 57 node:test total | [04-white-box](../04-white-box/) |
| Unit + integration | TDD, coverage | Jest + supertest | **259** pass; statements **95.0 %**, branches 89.1 % | [05-unit](../05-unit/tdd-log.md) |
| Acceptance | BDD (Given/When/Then) | Cucumber.js | **44** scenarios / 202 steps pass; mutation score 3/3 | [06-bdd](../06-bdd/bdd-notes.md) |
| API contract | Chained requests, schema checks, data-driven | Postman CLI | 43 requests, **288 + 72 = 360** assertions pass | [07-postman-selenium](../07-postman-selenium/phase7-notes.md) |
| System, UI end-to-end | Page Object Model, explicit waits | Selenium WebDriver + Mocha | **11/11** pass (desktop + mobile width) | [07-postman-selenium](../07-postman-selenium/phase7-notes.md) |
| Regression | Continuous integration | GitHub Actions | 7 jobs; Node 22 + 24; coverage gate 90/85/90/90 | [08-ci](../08-ci/ci-notes.md) |
| Performance | Load, stress, spike, breakpoint | JMeter 5.6.3 | 26,057 requests, **0 errors**, every SLA met up to 400 users | [09-performance-security](../09-performance-security/phase9-notes.md) |
| Security | SCA, DAST, scripted OWASP Top 10 | npm audit, OWASP ZAP 2.17, Jest | 0 production vulnerabilities; ZAP rescan 0 Medium/Low; A01–A10 tests pass | [09-performance-security](../09-performance-security/phase9-notes.md) |
| Static | Code quality metrics | SonarQube Community 26.11 | 0 vulnerabilities (A), 0 hotspots, 2.5 % duplication, 93.9 % coverage | [11-metrics](../11-metrics/sonar-metrics.md) |

## 3. Variances from the plan

| Plan said | What happened | Why |
|---|---|---|
| Scan targets on `localhost` (:5173 / :5000) | A local fixture site on `127.0.0.1:5070` | A fixture page gives known, repeatable findings. `localhost` was rejected by the URL validator at first (DEF-004), so the cases were written with `127.0.0.1` |
| R3: restart the API between suites to reset rate limits | Each virtual user sends a random `X-Forwarded-For` (the API trusts one proxy hop) | Restarting does not scale to JMeter or CI. A per-client IP is also more realistic |
| Security: manual OWASP checks for A01, A07 and A10 with curl/Postman | Expanded to SCA, a ZAP DAST scan, and scripted Jest tests for A01–A10 | The SSRF review (DEF-009) showed that manual spot checks were not enough |
| SonarQube Community (local) | Local SonarQube for the report. A SonarCloud CI job is ready but inactive until the repo owner adds `SONAR_TOKEN` | Creating the account and secret is the owner's decision |
| Node.js 25 locally | CI also runs Node 22 and 24 (LTS) | Portability (ISO 25010) |
| Not planned | A soak test (hours) was **not** run | Time. Recommended before a production release (§7) |
| Out of scope | Cross-browser matrix and WCAG audit not done | As planned (§3.2 of the plan) |

## 4. Comprehensiveness

- **Features:** 11/11 features covered. Every High-priority feature (F1–F7) is covered by at least three independent levels: API cases, BDD and Jest, plus Selenium for the UI flows.
- **ISO 25010:** all eight characteristics in the plan's §4 table were tested. Each has at least one phase with evidence. Usability was covered by the manual UI cases and Selenium only, with no user study.
- **Code:** Jest covers 95.0 % of server statements. `runScan`, the riskiest function (V(G) 32), went from 23.9 % to 98.5 % line coverage.
- **Mutation check:** 3/3 hand-made mutants were killed by the BDD suite, and CI went red when the IDOR check was removed (Phase 8 demo). This shows the tests detect faults rather than just running the code.

## 5. Exit criteria (test plan §9)

| # | Criterion | Result | Evidence | Status |
|---|---|---|---|---|
| 1 | 100 % of High-priority cases executed, ≥ 90 % of all cases | 55/55 Phase 2 cases executed (100 %). Final regression: 45/45 API, 123/123 black-box, 11/11 UI | [execution-results.md](../02-stlc/execution-results.md), `qa/evidence/api-run-*T11-09-31*.json`, `qa/evidence/black-box-*T13-15-34*.json` | ✅ Met |
| 2 | No open Critical/High defects; open Medium defects have a workaround or RCA | 10/10 defects closed (both Highs: DEF-001, DEF-009). No defect is open. The 3 deferred items are observations with recommendations | [defect-log.md](../10-defects/defect-log.md), [rca.md](../10-defects/rca.md) | ✅ Met |
| 3 | Statement coverage of `server/` business logic ≥ 80 % | **95.0 %** (Jest); 93.9 % (SonarQube's combined line + branch figure). CI enforces ≥ 90 % | `qa/evidence/coverage/jest/`, [sonar-metrics.md](../11-metrics/sonar-metrics.md) | ✅ Met |
| 4 | CI pipeline green on the QA branch | Run 45200237209 on `74f4931`: lint/build, unit-api on Node 22 and 24, BDD, Postman, Selenium and Sonar all pass | GitHub Actions | ✅ Met |

The suspension criteria were never triggered. The DB was always available, and no blocker defect stopped more than 30 % of the cases.

## 6. Defects and observations

| Severity | Found | Closed | Open |
|---|---|---|---|
| High | 2 (DEF-001 Gmail login lockout, DEF-009 SSRF via redirect / DNS rebinding) | 2 | 0 |
| Medium | 4 (DEF-002, 005, 008, 010) | 4 | 0 |
| Low | 4 (DEF-003, 004, 006, 007) | 4 | 0 |
| **Total** | **10** | **10** | **0** |

- **Where the defects were found:** Phase 2 found 4, black-box 2, white-box 1, retest after a fix 1, and security testing 2. The developers' original 32 tests found **0** of the 10. Their defect removal efficiency (DRE) was 0 %.
- **Defect density:** about 5.4 defects per 1,000 lines on the server and 3.5 for the whole app, within McConnell's 1–25 range.
- **Root causes:** 80 % fall into two categories, a Pareto pattern: an error type that was not handled, and a rule enforced in one place while the data is used in another. Details are in [defect-metrics.md](../10-defects/defect-metrics.md) and [rca.md](../10-defects/rca.md).
- **Deferred observations:**
  - **OBS-07:** no rate limit on sign-up.
  - **OBS-08:** bcrypt caps authentication at about 32 requests per second per endpoint.
  - **OBS-09:** `runScan` has cognitive complexity 28, and a refactor is recommended.

## 7. Residual risks (what testing did **not** prove)

| Risk | Why it remains | Suggested action |
|---|---|---|
| Accounts registered on the live system **before** the DEF-001 fix | QA never touches the Atlas database. Those Gmail users were stored without dots or `+tags`, so they may be unable to log in | The owner checks the live users once and migrates them or resets their passwords |
| Abuse of the sign-up endpoint (OBS-07) | It is the most CPU-expensive endpoint and has no dedicated limit | Re-enable `registerLimiter` |
| Peak authentication load (OBS-08) | Capacity was measured on one laptop, not on Render | Set `UV_THREADPOOL_SIZE`; repeat the load test on the hosting tier |
| Memory leaks over time | Soak test not run | Run a 2–4 hour JMeter soak before a public launch |
| Browser compatibility, accessibility | Out of scope | Run a cross-browser smoke test and an axe/Lighthouse audit |
| Maintainability of `runScan` (OBS-09) | It is high complexity, though well tested | Refactor using the 259 Jest tests and 44 BDD scenarios as a safety net |
| The test environment is not production | Production uses a different database, host and network | A post-deploy smoke test (health check, register, login, scan of an owned page) |

## 8. Recommendation and conditions

**Recommendation: release.** The QA branch (`qa/ec4206-testing`, PR #12) can be merged into `main`, on two conditions:

1. The Content-Security-Policy `connect-src` in `client/security-headers.json` allows `https://*.onrender.com`. This is right if, and only if, the production API is hosted on Render. The owner must confirm the real `VITE_API_URL` before merging. Otherwise the deployed client cannot reach the API.
2. Merging into `main` redeploys production (Render/Vercel), so a post-deploy smoke test must follow (§7, last row).

## 9. Approvals

| Role | Name | Decision | Date |
|---|---|---|---|
| Test lead | *(group member)* | | |
| Defect manager | *(group member)* | | |
| Product owner (repo owner) | *(group member)* | | |
