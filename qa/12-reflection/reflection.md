# Reflection: EC4206 QA Assignment (Option A)

| Item | Value |
|---|---|
| Document ID | QA-RF-12 |
| Companion | [test-summary-report.md](test-summary-report.md) (results and exit criteria) |
| Date | 2026-11-24 |

This document looks back at how we tested, not just at what we found: what each technique taught us, what worked, what did not, and what we would do differently next time.

## 1. What each phase taught us

| Phase | What we did | What we learned |
|---|---|---|
| 1 Test plan | IEEE 829 / 29119 test plan, ISO 25010 quality map, risks, entry and exit criteria | Writing the exit criteria first gave every later phase a clear target. "Done" became something we could measure rather than a feeling. |
| 2 STLC | 55 test cases, first execution, 4 defects | The first structured run found the most defects, 4 of the final 10. Scripted cases written against a specification did far better than the developers' own tests, which found none. |
| 3 Black-box | Equivalence partitioning, boundary values and decision tables, 123 cases | The "wrong type" class (sending a number where a string belongs) found DEF-005, a server crash that no ordinary input would reach. Systematic design covers the cases intuition skips. |
| 4 White-box | Control-flow graphs, cyclomatic complexity, basis paths, coverage | Only a path-based test could reach DEF-007, a token that is "not valid yet". `runScan` had a complexity of 31 but only 23.9 % coverage, so the complexity figure told us where to look. |
| 5 Unit tests and TDD | Jest, 259 tests, red-green-refactor for every defect | Writing the failing test first proved that each bug was real and that the fix worked. Retesting after one fix uncovered DEF-008, a bug that DEF-001's fix had exposed, which convinced us that regression testing is not optional. |
| 6 BDD | 44 Cucumber scenarios, checked with planted bugs | Gherkin made the requirements readable for non-developers. Catching all three planted bugs showed the scenarios really detect faults, which coverage figures alone cannot show. |
| 7 Postman and Selenium | 360 API assertions, 11 UI tests using the Page Object Model | Automating the UI found OBS-06: the form accepted 6-character passwords while the API required 8. UI and API rules drift apart unless both are tested. Explicit waits and page objects kept the UI tests stable. |
| 8 CI | A seven-job GitHub Actions pipeline with a coverage gate | A deliberately broken branch, with the IDOR check removed, turned the pipeline red. That moment changed "we have tests" into "our tests protect `main`". |
| 9 Performance and security | JMeter, npm audit, OWASP ZAP, scripted OWASP Top 10 tests | None of the functional testing in Phases 2 to 8 could see the High SSRF bug (DEF-009); it took an attacker's way of thinking about redirects and DNS rebinding. Load testing showed the bottleneck is CPU-bound password hashing, not the database: reads stayed under 20 ms while sign-ups queued. |
| 10 Defects | Root cause analysis (5 Whys, fishbone), lifecycle, DRE, defect density | Two root causes explain 80 % of the defects. Fixing the gaps in the process, such as missing negative tests and missing type checks, prevents the next defect and not just the current one. |
| 11 Static analysis | SonarQube locally and SonarCloud in CI | Tool output needs triage. The Reliability rating of C came entirely from false positives. We also saw that tests made `runScan` well covered but not any simpler (OBS-09). |

## 2. What worked well

Prioritising by risk paid off. We tested authentication, data isolation between users, SSRF and the scoring logic first and most thoroughly, and both High defects turned up in exactly those areas.

We kept to a strict rule of one defect, one failing test. Each of the 10 fixes has a regression test that failed before the fix was made (the runs are in `qa/evidence/tdd/`), and no defect was ever reopened.

Testing the same behaviour at several levels, from Jest through BDD and Postman to Selenium, meant that when one level missed something, another usually caught it.

We set safety rules on the first day and kept to them. No test ever touched the production Atlas database, every scan targeted pages we own, and login tokens were removed from the evidence before it went into the public repository. These rules came straight from risks R1 and R2 in the test plan.

Every suite can be run with a single command (see [../README.md](../README.md)) and runs again in CI on a clean Linux machine, so our results never depended on one person's laptop.

Finally, reviewing each other's pull requests worked well. Work arrived as pull requests and was checked against the raw evidence, such as commit hashes, line counts and SonarQube exports, before it was merged. One review caught a test count credited to the wrong defect and a line count that depended on an unstated rule, and both were fixed in a follow-up pull request.

## 3. What did not go so well

| Problem | Impact | What we learned |
|---|---|---|
| The developers' original tests found none of the 10 defects | Every defect had to be found by QA, later and at a higher cost | The original tests only covered the happy path. Negative and wrong-type cases are essential. |
| Rate limits broke our early test runs, returning 429 instead of the expected result | Wasted runs, and some tests failing for the wrong reason | Understand the system's protections before automating against it. We fixed it by sending a different `X-Forwarded-For` per test client. |
| A dependency upgrade (`npm audit fix`) broke 70 Jest tests | Time spent finding the cause: MongoDB driver 7.8 uses a dynamic `import()` that Jest does not allow | Security updates still need the full regression suite. CI caught the problem before it reached `main`. |
| Setting up OWASP ZAP was fragile (working folder, environment variables, stale settings) | Several false starts | A scripted run that starts from a clean state each time (`run-zap.ps1`) is worth the setup effort. |
| Running a tool on a subset of tests overwrote earlier evidence (Cucumber `--tags`, the black-box runner) | Evidence had to be restored from git | Keep evidence under version control, and rerun the full suite before committing. |
| The `runScan` refactor recommended in Phase 4 never happened | Complexity grew from 31 to 32 (OBS-09) | A recommendation needs an owner and a deadline, otherwise it is forgotten. |
| No soak, cross-browser or accessibility testing | These remain as residual risks (test summary report, section 7) | Plan the non-functional testing earlier instead of leaving it for the end. |

## 4. What we would do differently

We would shift testing left by writing the BDD scenarios and negative cases together with the developers, before the code exists. Of the 10 defects, 4 were bad input that crashed with a 500 instead of a clean 4xx error, and 4 were a rule enforced on one route but not on another. Agreed scenarios such as "bad input returns 4xx" or "register, then log in with the same email" would have prevented most of them.

We would set up CI in the first week rather than in Phase 8, so that every phase had a regression safety net from the start.

We would start security testing earlier and keep it going throughout. The High SSRF bug only appeared in Phase 9, and a simple threat model in Phase 1 would have pointed straight at it.

We would track defects found in production. Our DRE of 100 % is only an upper bound because we have no field data, and logging production bugs would make the figure meaningful.

And we would give every recommendation a named owner and a date. OBS-07, OBS-08 and OBS-09 will stay deferred until someone is responsible for them.

## 5. Group work

We divided the project by QA role, so that each of us owned a set of phases from start to finish and the others reviewed the work.

| Member | Role | What they did | Phases |
|---|---|---|---|
| Thanthrige D.P. (EG/2023/5916) | Test lead, automation engineer | Wrote the test plan and set the entry and exit criteria; built the Jest suite and fixed the defects test-first; set up the GitHub Actions pipeline; wrote the test summary report and this reflection; coordinated the work and reviewed the pull requests | 1, 5, 8, 12 |
| Wijerathna K.A.A.M. (EG/2023/5971) | Test designer | Defined the STLC and the test environment and wrote and ran the 55 test cases; designed the black-box tests with equivalence partitioning, boundary values and decision tables; did the white-box analysis of control flow, complexity and coverage | 2, 3, 4 |
| Rathnaweera R.P.B.P. (EG/2023/5828) | Automation, performance and security tester | Wrote the Cucumber BDD scenarios and the mutation check; built the Postman collections and the Selenium UI suite; ran the JMeter load tests and the OWASP security testing, including the DEF-009 SSRF finding | 6, 7, 9 |
| Jayasekara J.M.O.S. (EG/2023/5658) | Defect manager, quality metrics | Maintained the defect log; carried out the root cause analysis (5 Whys and fishbone), the defect lifecycle and the defect metrics; ran the SonarQube static analysis and set up the SonarCloud analysis | 10, 11 |

Each member worked on their own branch and opened a pull request into the shared QA branch. The rule "pull the latest QA branch before you start a new branch" kept the pull requests free of conflicts.

We also used Claude Code as a pair-programming assistant. It drafted tests and documents and ran the tools for us. We checked every result against the actual tool output, such as test runs, CI logs and raw JSON exports, before accepting it, and commits made with its help say so in a `Co-Authored-By` line. The lesson is the same as for any testing tool: verify, don't simply trust. Our own reviews caught exactly the kind of small mistakes this rule is meant to catch.

## 6. Course topics and where to find them

| EC4206 topic | Where |
|---|---|
| Test plan, IEEE 829, ISO 25010, verification vs. validation | [01-test-plan](../01-test-plan/test-plan.md) |
| STLC, test environment, test cases | [02-stlc](../02-stlc/) |
| Equivalence partitioning, boundary value analysis, decision tables | [03-black-box](../03-black-box/) |
| Control-flow graph, cyclomatic complexity, statement, branch and path coverage | [04-white-box](../04-white-box/white-box-analysis.md) |
| Unit testing, TDD, mocking, coverage | [05-unit](../05-unit/tdd-log.md) |
| BDD, Gherkin, mutation testing | [06-bdd](../06-bdd/bdd-notes.md) |
| API testing, UI automation, Page Object Model | [07-postman-selenium](../07-postman-selenium/phase7-notes.md) |
| Continuous integration, quality gates | [08-ci](../08-ci/ci-notes.md), [.github/workflows/qa.yml](../../.github/workflows/qa.yml) |
| Performance testing (load, stress, spike), OWASP Top 10, SAST, DAST and SCA | [09-performance-security](../09-performance-security/phase9-notes.md) |
| Defect lifecycle, RCA, DRE, defect density | [10-defects](../10-defects/phase10-notes.md) |
| Static analysis, code metrics, technical debt | [11-metrics](../11-metrics/sonar-metrics.md) |
| Test summary, exit criteria, reflection | this folder |

## 7. Key facts

We found 10 defects (2 High, 4 Medium and 4 Low) and closed all of them test-first, with none reopened. Every push now runs 57 node:test tests, 259 Jest tests (95.0 % statement coverage), 44 BDD scenarios, 360 Postman assertions and 11 Selenium tests.

The most serious finding was DEF-009, an SSRF hole through redirects and DNS rebinding. We found it through security review and fixed it with `server/utils/ssrfGuard.js`, which checks every address at the moment the connection is made. The most surprising finding was DEF-001: a Gmail user with dots in their address could register but never log in again, because the address was normalised on one route and not the other.

On performance, every target held at 400 users, and the ceiling is bcrypt at about 32 logins per second per endpoint.

If we had to sum up the project in one sentence, it would be that each new kind of testing found defects the previous kinds could not, so no single technique is enough.
