# Reflection: EC4206 QA Assignment (Option A)

| Item | Value |
|---|---|
| Document ID | QA-RF-12 |
| Companion | [test-summary-report.md](test-summary-report.md) (results and exit criteria) |
| Date | 2026-11-23 |

This document looks back at **how** we tested, not only at what we found. What did each technique teach us, what worked, what didn't, and what would we do differently next time?

## 1. Phase-by-phase: what each technique taught us

| Phase | What we did | Key lesson |
|---|---|---|
| 1 Test plan | IEEE 829 / 29119 plan, ISO 25010 map, risks, entry/exit criteria | Writing the **exit criteria first** gave every later phase a clear target. "Done" was a measurable condition, not a feeling. |
| 2 STLC | 55 test cases, first execution, 4 defects | The **first structured run found the most defects** (4 of 10). Scripted cases against a written spec beat the developers' ad-hoc tests, which found 0. |
| 3 Black-box | EP, BVA, decision tables: 123 cases | The **"wrong type" equivalence class** (a number where a string belongs) found DEF-005, a 500 error that no "normal" input could reach. Systematic design covers what intuition skips. |
| 4 White-box | CFG, V(G), basis paths, coverage | Only a path test could reach DEF-007 (an `nbf` token). Black-box testing cannot create that input. `runScan` had V(G) 31 at 23.9 % coverage, so complexity told us **where to look**. |
| 5 Unit + TDD | Jest, 259 tests, red → green → refactor for each defect | Writing the failing test first proved each bug existed and proved the fix. **Retesting after a fix found DEF-008**, a bug the DEF-001 fix exposed. Regression testing is not optional. |
| 6 BDD | 44 Cucumber scenarios, mutation-checked | Gherkin made requirements readable by non-developers. Killing 3/3 mutants showed the scenarios **detect faults**, which coverage alone cannot show. |
| 7 Postman + Selenium | 360 API assertions, 11 UI tests with Page Object Model | Automation found OBS-06: the form allowed 6-character passwords, but the API needed 8. **UI and API rules drift apart** unless both are tested. Explicit waits and POM kept the UI tests stable. |
| 8 CI | 7-job GitHub Actions pipeline, coverage gate | A deliberately broken branch (IDOR check removed) **went red**. That demo turned "tests exist" into "tests protect `main`". |
| 9 Performance + security | JMeter, npm audit, ZAP, scripted OWASP A01–A10 | Functional testing (phases 2–8) **could not see** the High SSRF bug (DEF-009). It took an attacker's mindset (redirects, DNS rebinding). Load testing showed the bottleneck is CPU (bcrypt password hashing), not the database. Reads stayed under 20 ms p95 while sign-ups queued. |
| 10 Defects | RCA (5 Whys, fishbone), lifecycle, DRE, density | Two root causes explain 80 % of the defects. Fixing **process** gaps (negative tests, type checks first) prevents the next defect, not just this one. |
| 11 Static analysis | SonarQube: 0 vulnerabilities, 93.9 % coverage | Tools need **triage**. The Reliability rating of C came from 5 false positives (44 % precision). We also learned that tests make code well covered, but not simpler (OBS-09). |

## 2. What worked well

1. **Risk-based priority.** We tested authentication, data isolation (IDOR), SSRF and scoring first and most deeply. Both High defects were in exactly those areas.
2. **One defect, one failing test.** Every one of the 10 fixes has a regression test that was red before the fix (`qa/evidence/tdd/`). Zero defects were reopened.
3. **Layered automation.** The same behaviour is checked at several levels (Jest → BDD → Postman → Selenium). When one level missed something, another caught it.
4. **Safety rules from day one.** Tests never touched the production Atlas database, and scans only targeted pages we own. Tokens were redacted from public evidence. This followed from risks R1 and R2 in the plan.
5. **Reproducibility.** Every suite runs with one command (see [../README.md](../README.md)) and runs again in CI on a clean Linux machine, so results don't depend on one laptop.
6. **Pull-request reviews within the group.** Phases 10 and 11 came in as PRs and were reviewed against the raw evidence (commit hashes, line counts, Sonar JSON) before merging. Review found two small inaccuracies, fixed in PR #13.

## 3. What did not go so well

| Problem | Impact | What we learned |
|---|---|---|
| The developers' tests found 0 of 10 defects | All defects came from QA. They should have been caught earlier and more cheaply | Developer tests covered only the happy path. Negative and wrong-type cases are essential |
| Rate limits broke test runs at first (429 instead of the expected result) | Wasted runs; some tests failed for the wrong reason | Understand the system's protections before automating. We fixed it with a per-client `X-Forwarded-For` |
| A dependency upgrade (`npm audit fix`) broke 70 Jest tests | Extra debugging to find the cause (mongodb 7.8 uses a dynamic `import()`, which Jest's VM does not allow) | Security updates need the full regression suite. CI caught it before `main` |
| The OWASP ZAP setup was fragile (working folder, environment variables, stale config) | Several false starts | Scripted, fresh-state tool runs (`run-zap.ps1`) are worth the setup time |
| Running a tool with a filter overwrote earlier evidence (Cucumber `--tags`, the black-box runner) | Evidence had to be restored from git | Keep evidence under version control and rerun the full suite before committing |
| The `runScan` refactor recommended in Phase 4 never happened | Complexity grew from 31 to 32 (OBS-09) | QA can recommend, but a recommendation needs an owner and a deadline, or it is forgotten |
| No soak test, cross-browser or accessibility testing | Residual risks (test summary report §7) | Plan time for non-functional tests earlier, not at the end |

## 4. What we would do differently

1. **Shift left.** Write the BDD scenarios and negative cases *with* the developers, before the code. Of the 10 defects, 4 were bad input that returned 500 instead of 4xx, and 4 were a rule enforced on one route but not another. A pre-agreed scenario such as "bad input returns 4xx" or "register, then log in with the same email" would have prevented them.
2. **CI in week one, not Phase 8.** Every earlier phase would then have had a regression net from the start.
3. **Security testing earlier and continuously.** The High SSRF bug was found in Phase 9. A threat model in Phase 1 would have pointed straight at it.
4. **Track production defects.** Our DRE of 100 % is only an upper bound, because no field data exists. Logging production bugs would make the metric real.
5. **Give every recommendation an owner.** OBS-07, OBS-08 and OBS-09 need a named person and a date, or they stay deferred.

## 5. Group work

- **Workflow:** phases 1–9 were done on the shared QA branch. Phases 10–11 were done by a second member on `qa/phase-N` branches, each merged by pull request after review. The rule "pull `qa/ec4206-testing` before you branch" kept the PRs conflict-free.
- **AI assistance:** we used Claude Code as a pair-programming assistant. It drafted tests and documents and ran the tools. Every result was checked against tool output (test runs, CI logs, raw JSON) before it was accepted. Commits made with its help say so (`Co-Authored-By`). The lesson is the same as for any tool: **verify, don't trust**. One review found a test count credited to the wrong defect and a line count that depended on an unstated rule.

## 6. Course topics and where they are demonstrated

| EC4206 topic | Where |
|---|---|
| Test plan, IEEE 829, ISO 25010, verification vs. validation | [01-test-plan](../01-test-plan/test-plan.md) |
| STLC, test environment, test cases | [02-stlc](../02-stlc/) |
| Equivalence partitioning, boundary value analysis, decision tables | [03-black-box](../03-black-box/) |
| Control-flow graph, cyclomatic complexity, statement/branch/path coverage | [04-white-box](../04-white-box/white-box-analysis.md) |
| Unit testing, TDD, mocking, coverage | [05-unit](../05-unit/tdd-log.md) |
| BDD, Gherkin, mutation testing | [06-bdd](../06-bdd/bdd-notes.md) |
| API testing, UI automation, Page Object Model | [07-postman-selenium](../07-postman-selenium/phase7-notes.md) |
| Continuous integration, quality gates | [08-ci](../08-ci/ci-notes.md), [.github/workflows/qa.yml](../../.github/workflows/qa.yml) |
| Performance testing (load, stress, spike), OWASP Top 10, SAST/DAST/SCA | [09-performance-security](../09-performance-security/phase9-notes.md) |
| Defect lifecycle, RCA, DRE, defect density | [10-defects](../10-defects/phase10-notes.md) |
| Static analysis, code metrics, technical debt | [11-metrics](../11-metrics/sonar-metrics.md) |
| Test summary, exit criteria, reflection | this folder |

## 7. Viva quick facts

- **10 defects** found (2 High, 4 Medium, 4 Low), **10 closed**, all test-first, **0 reopened**.
- **Automated checks on every push:** 57 node:test, 259 Jest (95.0 % statements), 44 BDD scenarios, 360 Postman assertions, 11 Selenium tests.
- **Biggest single finding:** DEF-009, SSRF through a redirect or DNS rebinding. It was found by security review and fixed with `server/utils/ssrfGuard.js`, which checks every DNS lookup at connect time.
- **Most surprising finding:** DEF-001. A Gmail address with dots could register but never log in, because `normalizeEmail` ran on one route and not the other.
- **Capacity:** every SLA held at 400 users. The ceiling is bcrypt, at about 32 logins/s per endpoint.
- **One-line lesson:** each new *kind* of testing found defects the previous kinds could not, so no single technique is enough.
