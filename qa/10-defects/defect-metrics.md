# Defect Metrics

| Item | Value |
|---|---|
| Document ID | QA-DM-10 |
| Data | 10 defects (DEF-001 to DEF-010) and 8 observations (OBS-01 to OBS-08) from [defect-log.md](defect-log.md) |
| Rule | Metrics count **defects only** unless a row says otherwise. Observations are design notes or recommendations, so mixing them in would inflate the numbers. |
| Code base measured | build `ba8a9ba` (the version handed to QA): 1,812 lines of server JavaScript and 3,085 lines in total with the React client (non-blank, non-comment lines, tests and data files excluded) |

## 1. Defects by severity and priority

| Severity | Priority | Count | % | Defects |
|---|---|---|---|---|
| **High** | P1 | 2 | 20% | DEF-001, DEF-009 |
| Medium | P2 | 4 | 40% | DEF-002, DEF-005, DEF-008, DEF-010 |
| Low | P3 | 4 | 40% | DEF-003, DEF-004, DEF-006, DEF-007 |
| **Total** | | **10** | 100% | |

Observations by priority: P2 ×1 (OBS-05), P3 ×2 (OBS-04, OBS-07), P4 ×5 (OBS-01, 02, 03, 06, 08).

Severity and priority matched for every defect in this project (High → P1, Medium → P2, Low → P3). That is normal for a small product with no release pressure; in a real release the two can differ (for example a Low-severity typo on the login page can still be P1).

## 2. Defects by phase found

| Phase | Technique | Defects | Count | Observations | Count |
|---|---|---|---|---|---|
| P2 STLC execution | Functional test cases (API) | DEF-001, 002, 003, 004 | **4** | OBS-01 | 1 |
| P3 Black-box | EP, BVA, decision tables | DEF-005, 006 | 2 | OBS-02, 03, 04 | 3 |
| P4 White-box | Basis paths, coverage | DEF-007 | 1 | OBS-05 | 1 |
| P5 Unit + TDD | Retest after each fix | DEF-008 | 1 | | 0 |
| P6 BDD | Cucumber scenarios | | 0 | | 0 |
| P7 Postman + Selenium | API + UI automation | | 0 | OBS-06 | 1 |
| P8 CI | Pipeline (runs existing tests) | | 0 | | 0 |
| P9 Performance + Security | SCA, ZAP DAST, scripted OWASP, JMeter | DEF-009, 010 | **2** | OBS-07, 08 | 2 |
| **Total** | | | **10** | | **8** |

Severity by phase:

| Phase | High | Medium | Low |
|---|---|---|---|
| P2 | 1 (DEF-001) | 1 | 2 |
| P3 | | 1 | 1 |
| P4 | | | 1 |
| P5 | | 1 | |
| P9 | 1 (DEF-009) | 1 | |

**Reading:** the first structured test run (P2) found the most defects, as expected. Phases 6 to 8 found **no new defects**. That does not mean they were useless: BDD, Postman, Selenium and CI turned the earlier findings into permanent regression checks and found one UI observation (OBS-06). But they reused the same functional view of the system, so they could not see the two security defects. Only a **different kind of testing** (Phase 9, adversarial) found DEF-009 and DEF-010, including the second High defect.

## 3. Defects by detection technique

| Technique | Defects | Count |
|---|---|---|
| Scripted functional test cases | DEF-001, 002, 003, 004 | 4 |
| Black-box design (EP wrong-type / invalid class) | DEF-005, 006 | 2 |
| White-box (basis path) | DEF-007 | 1 |
| Retest after a fix | DEF-008 | 1 |
| Security code review + scripted OWASP tests | DEF-009 | 1 |
| DAST (OWASP ZAP passive scan) | DEF-010 | 1 |
| Developers' original test suite (32 tests) | none | **0** |

The 32 tests that came with the code all passed while all 10 defects were present.

## 4. Defect Removal Efficiency (DRE)

### 4.1 Overall DRE

> **DRE = defects found before release ÷ (defects found before release + defects found after release) × 100%**

| Input | Value | Source |
|---|---|---|
| Found by QA (Phases 2–9) | 10 | defect log |
| Found after release (by users, in production) | 0 reported | no field defect reports exist for the live deployment |
| **DRE** | **10 ÷ (10 + 0) = 100%** | |

**This 100% is an upper bound, not proof of quality.** The app has few real users and no field-defect tracking, so "0 found after release" means *none reported yet*. DRE becomes meaningful once there is a defect intake for production; it should be recalculated then. DEF-001 also shows why: it was already present in the deployed build and would have been a field defect if any Gmail user with a dot had signed up.

### 4.2 DRE of the developers' own testing

| Input | Value |
|---|---|
| Defects caught by the original 32 tests before QA | 0 |
| Defects present and later found by QA | 10 |
| **Developer-test DRE** | **0 ÷ 10 = 0%** |

This is the strongest argument for an independent QA activity in this project.

### 4.3 Phase containment (stage DRE)

For each phase: **stage DRE = defects found in the phase ÷ defects present when the phase started** (present = found in that phase or any later phase).

| Phase | Present at start | Found | Stage DRE | Escaped to later phases |
|---|---|---|---|---|
| P2 STLC execution | 10 | 4 | **40%** | 6 |
| P3 Black-box | 6 | 2 | 33% | 4 |
| P4 White-box | 4 | 1 | 25% | 3 |
| P5 Unit + TDD | 3 | 1 | 33% | 2 |
| P6 BDD | 2 | 0 | 0% | 2 |
| P7 Postman + Selenium | 2 | 0 | 0% | 2 |
| P8 CI | 2 | 0 | 0% | 2 |
| P9 Performance + Security | 2 | 2 | **100%** | 0 |

Notes:

- These are upper bounds again: defects nobody has found yet are not in the "present" column.
- DEF-008 is counted as present from P2, but it was **masked** by DEF-001 and could not have been seen until DEF-001 was fixed. So P2–P4 could not realistically have caught it.
- DEF-009 needs the guard switched on (production mode), and DEF-010 needs the production client build with headers inspected. No functional phase ran in that configuration, which explains the 0% in P6–P8. See [rca.md](rca.md) §3.

**Defect leakage** from the first test cycle: 6 of 10 defects (60%) escaped Phase 2 and were found later. Each later technique found something the previous ones could not. That supports the test plan's choice of combining black-box, white-box, automation and security testing rather than relying on one.

## 5. Fix and retest metrics

| Metric | Value | Comment |
|---|---|---|
| Defects closed | **10 / 10 (100%)** | |
| High defects open at release of this QA cycle | **0** | Phase 2 exit criterion ("no open High defect") was not met in P2, and is met now |
| Fixed test-first (TDD RED → GREEN) | 10 / 10 | every defect has a regression test that failed before its fix |
| First-time retest pass rate | **9 / 10 (90%)** | DEF-001's first retest failed because the fix exposed DEF-008 |
| Fix-introduced defects (bad fixes) | 0 | DEF-008 was older code, unmasked, not caused by the fix |
| Reopened after closing | 0 | |
| Defects found and fixed in the same phase | 3 (DEF-008, DEF-009, DEF-010) | from Phase 5 onwards, fixes happened in the finding phase |
| Average defect age, in phases (found → closed) | **1.7 phases** | DEF-001/002/003/004: 3 · DEF-005/006: 2 · DEF-007: 1 · DEF-008/009/010: 0. Phases 2–4 were design-only by plan, so the age reflects the plan, not slow fixing. |
| Age of the two High defects | DEF-001: 3 phases · DEF-009: 0 | DEF-001 waited for the planned fix phase |

## 6. Defect density

| Scope | Defects | Size (KLOC) | Density |
|---|---|---|---|
| Server (API) | 9 (all except DEF-010) | 1.812 | **≈ 5.0 defects / KLOC** |
| Whole app (server + client) | 10 | 3.085 | **≈ 3.2 defects / KLOC** |

Lines are non-blank, non-comment lines of `.js`/`.jsx` at build `ba8a9ba`, excluding tests and data files. DEF-010 is counted in the client because it lives in the client's hosting config. For comparison, McConnell (*Code Complete*) quotes an industry average of roughly 1–25 defects/KLOC in delivered code, so the result is in a normal range for a student-built app before QA. With only 10 defects, density is a rough indicator, not a precise one.

## 7. Defects by root cause category

From [rca.md](rca.md) §5:

| Root cause category | Defects | Count | % | Includes High? |
|---|---|---|---|---|
| Rule duplicated or enforced in the wrong place | DEF-001, 008, 009, 010 | 4 | 40% | **Yes, both** |
| Error or input type not handled (500 instead of 4xx) | DEF-002, 003, 005, 007 | 4 | 40% | No |
| Library default or documented intent not verified | DEF-004, 006 | 2 | 20% | No |

Two categories explain 80% of the defects (a Pareto pattern), and the first one explains both High defects. Those two are where prevention effort pays most: one source of truth per rule, and a "bad input gives 4xx, never 500" check for every endpoint.

## 8. Summary

| Metric | Value |
|---|---|
| Total defects / observations | 10 / 8 |
| High / Medium / Low | 2 / 4 / 4 |
| Most productive phase | P2 (4 defects); most valuable: P9 (2 defects incl. 1 High that no other phase could find) |
| Overall DRE | 100% (upper bound: no field-defect data yet) |
| Developer-test DRE | 0% |
| Phase 2 leakage | 60% |
| Closed | 10 / 10, all test-first, 0 reopened |
| First-time retest pass rate | 90% |
| Defect density | ≈ 5.0 / KLOC server, ≈ 3.2 / KLOC whole app |
