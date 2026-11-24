# Test Execution Report: Cycle 1

| Item | Value |
|---|---|
| Document ID | QA-EXEC-02 |
| Date | 2026-11-23 |
| Build | `main` @ `ba8a9ba` (no code changes, tested as-is) |
| Environment | QA-STLC-02 §4: local MongoDB 8.3 on `:27099`, Node v25.6.0, Chromium |
| API cases | Automated with `node qa/scripts/run-api-cases.mjs`. Full table in [`api-results.md`](api-results.md). |
| UI cases | Manual, in the Chromium browser pane. Screenshots in `qa/evidence/ui/`. |

## 1. Summary

| Suite | Planned | Executed | Pass | Fail | Pass rate |
|---|---|---|---|---|---|
| API (automated) | 45 | 45 | 42 | 3 | 93.3% |
| UI (manual) | 10 | 10 | 10 (1 with observation) | 0 | 100% |
| **Total** | **55** | **55** | **52** | **3** | **94.5%** |

The first cycle raised four defects (DEF-001 to DEF-004) and one observation (OBS-01). All of them are recorded in the [defect log](../10-defects/defect-log.md).

We then checked the exit criteria from section 9 of the test plan:

| Criterion | Status |
|---|---|
| 100% of High-priority cases executed | Met |
| No open High defect | Not met: DEF-001 (High) is still open |
| Coverage of at least 80% | Not measured yet (Phase 5) |
| CI green | Not set up yet (Phase 8) |

Because a High defect was still open, we could not close Cycle 1. The defects went into the normal fix, retest and regression loop. They were fixed test-first in Phase 5 and tracked through to closure in Phase 10.

## 2. What happened during the run

Our first automated run (`qa/evidence/api-run-2026-11-23T09-52-49-298Z.json`) looked bad at first sight: 32 cases passed and 13 failed. When we looked closer, 10 of the 13 failures came from a single cause. The scan validator uses `isURL()`, which requires a top-level domain, so it rejected our local test target `http://localhost:5070`. Every case that needed the ID of that first scan (history, notes and delete) then failed as well. We logged the root cause once, as DEF-004, switched the scan target to `http://127.0.0.1:5070` and updated the test case document. The lesson for us was that one root cause can produce many failures, so it pays to analyse a failed run before raising a pile of bug reports.

The second run (`qa/evidence/api-run-2026-11-23T09-53-14-102Z.json`) gave 42 passes and 3 failures, and all three were genuine defects.

All 10 UI cases passed, with two notes worth recording. In TC-UI-05 no scan was created, which is what the requirement asks for, but the expected warning message never appeared, because the button stays disabled while the ownership box is unticked. We logged this as OBS-01. In TC-UI-08 we replaced `window.confirm` with a stub (a simple test double) so we could drive the Cancel and OK paths separately. The real browser dialog was later handled by Selenium in Phase 7.

## 3. Failed cases

| Case | Expected | Actual | Defect |
|---|---|---|---|
| TC-REG-10 | Register `qa.tester.<ts>@gmail.com` → login with the same address → 200 | Register 201, but the address is **stored as `qatester<ts>@gmail.com`**. Login → **401 Invalid email or password**. | DEF-001 (High) |
| TC-API-05 | Malformed JSON → 400, no stack | **500**, `Unexpected end of JSON input`, **stack trace in the body** | DEF-002 (Medium) |
| TC-API-04 | Bad CORS origin → 4xx, no stack | **500** `Not allowed by CORS`, **stack trace in the body** | DEF-003 (Low) |

## 4. UI execution log

| ID | Result | Actual result (observed) | Evidence |
|---|---|---|---|
| TC-UI-01 | PASS | "Passwords do not match." shown. Network log had **no** `/api/auth` request. | `TC-UI-01-passwords-do-not-match.jpg` |
| TC-UI-02 | PASS | Redirected to `/dashboard`. Navbar shows "USER: QA UI USER". | `TC-UI-02-register-redirects-dashboard.jpg` |
| TC-UI-03 | PASS | "Invalid email or password" shown. Stayed on `/login`. | `TC-UI-03-invalid-email-or-password.jpg` |
| TC-UI-04 | PASS | `/history` while logged out → `/login` | `TC-UI-04-guard-redirects-to-login.jpg` |
| TC-UI-05 | PASS (OBS-01) | Button disabled. No `/api/scan` request. No explanatory message. | `TC-UI-05-scan-button-disabled-no-message.jpg` |
| TC-UI-06 | PASS | `/report/:id` shows grade **B, 82/100**, with 0 Critical, 1 High, 0 Medium, 1 Low. We checked the score by hand: 100 − 15 − 3 = 82, which falls in band B (75–89). | `TC-UI-06-report-grade-B-82.jpg` |
| TC-UI-07 | PASS | Note "Add Permissions-Policy header first" still present after a full reload | `TC-UI-07-note-persists-after-reload.jpg` |
| TC-UI-08 | PASS | Dialog text: "Delete the scan of http://127.0.0.1:5000/api/health? This cannot be undone." Cancel → row kept. OK → row removed and the empty state shown. | `TC-UI-08-history-empty-after-delete.jpg` |
| TC-UI-09 | PASS | After Logout, `/dashboard` → `/login`. `localStorage.token` = null and `user` = null. | (DOM check, recorded here) |
| TC-UI-10 | PASS | At 375 × 812: `scrollWidth` 375 = `innerWidth` 375, so no horizontal scroll | `TC-UI-10-mobile-375-login.jpg` |

## 5. Test metrics

| Metric | Value |
|---|---|
| Test execution rate | 55/55 = 100% |
| Pass rate | 52/55 = 94.5% |
| Defects found | 4 (1 High, 1 Medium, 2 Low) |
| Defect detection by technique | Spec-based negative tests: 3. Analysis of a cascade failure: 1. Exploratory UI observation: 1 (OBS). |
| Cases blocked | 0 (the run 1 cascade was resolved by changing test data, not by skipping cases) |
