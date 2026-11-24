# Phase 11: Static Analysis Metrics (SonarQube / SonarCloud)

| | |
|---|---|
| Code analysed | branch `qa/ec4206-testing` at `89787cd` (after Phase 10), the Express API (`server/`) and the React client (`client/src/`) |
| Tool | SonarQube Community Build 26.11 (local, Docker) + `sonar-scanner-cli`. SonarCloud is wired into CI (job `sonar`) and runs once the `SONAR_TOKEN` secret exists, see [sonarcloud-setup.md](sonarcloud-setup.md) |
| Rule set | **Sonar way extended** (252 JS/TS rules). The default *Sonar way core* (200 rules) was also run, for comparison |
| Coverage input | Jest `lcov.info` from Phase 5/8 (`qa/evidence/coverage/jest/`), paths rewritten by [fix-lcov-paths.js](fix-lcov-paths.js) |
| Config | [`sonar-project.properties`](../../sonar-project.properties) at the repo root |
| Re-run | `bash qa/11-metrics/run-sonar-local.sh` (or `run-sonar-local.ps1` on Windows) |
| Evidence | [`qa/evidence/sonar/`](../evidence/sonar/): JSON from the SonarQube Web API, scanner logs, screenshots |
| Date | 2026-11-23 |

---

## 1. Why static analysis, and what each metric means

Every earlier phase was **dynamic**: it ran the code. SonarQube is **static**: it reads the source without running it, and checks it against a rule set. It sees code that no test reaches, and it measures *internal* quality (ISO 25010 maintainability, test plan §5), which no functional test can see.

| Metric | Meaning | Sonar's rating scale |
|---|---|---|
| **Bug** | Code that is likely to behave wrongly (reliability) | A = 0 bugs, B = ≥1 Minor, C = ≥1 Major, D = ≥1 Critical, E = ≥1 Blocker |
| **Vulnerability** | Code an attacker could exploit (security) | Same A–E scale |
| **Security hotspot** | Security-sensitive code a human must review (not proven to be a flaw) | % reviewed |
| **Code smell** | Maintainability problem: hard to read, change or test | A–E from the **debt ratio** (A ≤ 5 %) |
| **Technical debt** | Estimated time to fix all code smells | minutes |
| **Coverage** | `(covered conditions + covered lines) / (conditions + lines to cover)`: Sonar combines line and branch coverage into one figure | % |
| **Duplication** | % of lines that are part of a block copied elsewhere (≥ 10 statements / 100 tokens for JS) | % |
| **Cyclomatic complexity** | McCabe V(G): independent paths, the minimum number of tests for basis-path coverage (Phase 4) | count |
| **Cognitive complexity** | How hard the code is for a *human* to follow. It adds +1 per break in linear flow and an extra +1 per level of nesting, and ignores shorthand such as `?.` | count; rule S3776 flags a function over 15 |

## 2. Results (main run: Sonar way extended)

Screenshot: [01-overview.png](../evidence/sonar/screenshots/01-overview.png). Raw data: [measures-project.json](../evidence/sonar/run2-sonar-way-extended/measures-project.json).

| Area | Result | Rating |
|---|---|---|
| Size | 3,122 lines of code (JS 3,102, CSS 20), 48 files, 162 functions, 4,295 physical lines, 16.5 % comments | |
| **Bugs** | **5** (all Major, one rule: S9383 "promise not awaited") | Reliability **C** |
| **Vulnerabilities** | **0** | Security **A** |
| **Security hotspots** | **0** | Hotspot review **A** |
| **Code smells** | **4** (2 Critical, 2 Major) | Maintainability **A** |
| Technical debt | 49 min, debt ratio 0.1 % | |
| **Coverage** (server) | **93.9 %**: line 96.1 % (634/660), branch 89.1 % (270/303) | |
| **Duplication** | **2.5 %**: 106 lines in 4 blocks | |
| **Cyclomatic complexity** | 425 total (server 263, client 162) | |
| **Cognitive complexity** | 263 total | |
| Quality gate (Sonar way) | **Passed** (see §6 for why this means little here) | |

The default *Sonar way core* profile gives the same bugs, vulnerabilities and coverage but only **1** code smell and 20 min of debt, because it does not contain the cognitive-complexity rule S3776 ([run1 evidence](../evidence/sonar/run1-sonar-way-core/)). **The rule set decides what "clean" means**, so a QA report must name it.

### 2.1 Every issue, triaged

Screenshot: [02-issues.png](../evidence/sonar/screenshots/02-issues.png). Raw: [issues.json](../evidence/sonar/run2-sonar-way-extended/issues.json).

| # | Rule | Type / severity | Where | Triage |
|---|---|---|---|---|
| 1 | S3776 cognitive complexity **28** (limit 15) | Smell, **Critical** | `server/controllers/scanController.js:53` `runScan` | **Valid. Deferred** as OBS-09. The same function Phase 4 flagged at V(G) = 31 (see §3) |
| 2 | S3776 cognitive complexity **16** (limit 15) | Smell, **Critical** | `server/utils/checks/sslCheck.js:75` `checkSsl` | Valid, borderline. Deferred (one point over) |
| 3 | S8786 regex with super-linear backtracking | Smell, Major | `server/models/user.js:21` email sanity regex | **Accepted, low risk.** `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` is polynomial, not exponential. The route's `isEmail()` (max 254 chars) runs first, so input is short and already valid. It replaced a far worse regex, see §4 |
| 4 | S6772 ambiguous spacing after `<span>` | Smell, Major | `client/src/pages/Dashboard.jsx:143` | Valid, cosmetic (JSX whitespace). Not worth a defect |
| 5–9 | S9383 promise must be awaited or have `.catch` | **Bug**, Major | `AuthContext.jsx:50`, `HistoryPage.jsx:32`, `HistoryPage.jsx:135`, `ReportPage.jsx:70`, `server/server.js:32` | **False positive in context.** Each call starts an `async` function whose whole body is in `try/catch` (`startServer` ends with `process.exit(1)`). None can reject. Kept on record: `void fetchHistory()` or `.catch()` would silence the rule and protect against a future edit that removes the `catch` |

**Result:** the 5 "bugs" behind the Reliability **C** rating are all false positives, so the real reliability rating is A. A static tool's ratings must be triaged before they are reported. Of the 9 issues, 4 are real (2 deferred, 2 accepted), and 5 are false positives. That is a **44 % precision** for this rule set on this code base.

### 2.2 Coverage per file (server)

Screenshot: [04-measures-coverage.png](../evidence/sonar/screenshots/04-measures-coverage.png). Raw: [measures-files.json](../evidence/sonar/run2-sonar-way-extended/measures-files.json).

| File | Sonar coverage | Line | Branch | Note |
|---|---|---|---|---|
| `models/user.js` | **66.7 %** | 71.4 % | 50 % | Lowest. Two backup paths never run: the `pre('save')` hook's own hashing (the controller always hashes first) and its early return for an unchanged password (no test updates a user). `matchPassword()` is never called (login uses `bcrypt.compare` directly). Dead or backup code, a candidate for removal |
| `middleware/rateLimiter.js` | 76.9 % | 81.8 % | 50 % | The two 429 handlers and the IP fallback of the scan limiter's key never run in Jest, because no Jest test exceeds a limit. The 429 path is tested at API level instead (BDD `login.feature`, Postman collection) |
| `utils/checks/libraryCheck.js` | 83.3 % | 86.8 % | 77.3 % | Version-parsing edge cases |
| `utils/ssrfGuard.js` | 86.2 % | 93.9 % | 76 % | IPv6 and DNS-failure branches |
| `utils/checks/fileExposureCheck.js` | 87.0 % | 96.9 % | **64.3 %** | Lowest branch coverage: soft-404 and content-type branches |
| `controllers/scanController.js` | 95.8 % | 98.5 % | 89.1 % | `runScan` (see §3) |
| 12 other files | 97–100 % | | | |

Jest's own report says 95.0 % statements / 89.1 % branches / 96.2 % lines. Sonar's **93.9 %** is lower because it **combines** lines and branches into one number: (634 + 270) / (660 + 303) = 904 / 963 = 93.9 %. Same data, different formula. Both are above the test plan's 80 % exit criterion (§9).

`client/` is excluded from coverage on purpose: it has no unit tests (it is tested end-to-end by the 11 Selenium tests, which produce no lcov). Including it would mix "not unit-tested by design" into the server figure. Config files (`jest.config.js`, `cucumber.js`), `server.js` and `scripts/` are excluded to match Jest's `collectCoverageFrom`.

### 2.3 Duplication

Screenshot: [05-measures-duplication.png](../evidence/sonar/screenshots/05-measures-duplication.png).

| Block | Lines | Triage |
|---|---|---|
| `fileExposureCheck.js` lines 15–78 ≈ 23–86 (inside the same file) | 64 | **False positive.** It is the `sensitivePaths` data table: many `{ path, severity, description, recommendation }` objects that share a shape. Data, not logic |
| `Login.jsx:15` ≈ `Register.jsx:18` | 17 + 17 | **Real.** The form state, `handleChange` and the start of `handleSubmit` are copy-pasted. A shared `useAuthForm()` hook would remove it |

2.5 % is far below Sonar's 3 % gate limit. The one real duplicate is small and in the client.

### 2.4 Complexity hotspots

Screenshot: [03-measures-complexity.png](../evidence/sonar/screenshots/03-measures-complexity.png). Per function, measured with the same ESLint `complexity` rule as Phase 4 (cyclomatic) and the SonarJS rule (cognitive):

| Function | V(G) | Cognitive | Risk band (V(G)) |
|---|---|---|---|
| **`runScan`** (scanController.js) | **32** | **28** | **High (21–50)** |
| `checkSsl` (sslCheck.js) | 17 | 16 | Moderate |
| `errorHandler` (errorHandler.js) | 16 | 12 | Moderate |
| `blockPrivateTargets` (scanValidators.js) | 9 | 9 | Low |
| `vulnerableLibraryCheck` / `checkSecurityHeaders` / `authMiddleware` | 8 | 11 / 8 / 8 | Low |
| every other server function | ≤ 7 | ≤ 6 | Low |

At file level Sonar reports `scanController.js` = 38 cyclomatic and `ReportPage.jsx` = 44 (the highest file). File totals add up every function in the file, so **compare functions with functions**. Sonar's and ESLint's counting rules also differ slightly (for example on `?.`), so only compare numbers from the same tool.

## 3. Comparison with Phase 4 (white-box)

To make the comparison fair, the Phase 4 commit (`09e19df`) was **re-analysed with the same tools and the same rule set** ([run0 evidence](../evidence/sonar/run0-phase4-baseline/)). Re-running ESLint on it reproduces Phase 4's V(G) = 31 for `runScan` exactly, so the two columns are measured the same way.

### 3.1 `runScan`

| Measure | Phase 4 (`09e19df`) | Phase 11 (`89787cd`) | Change |
|---|---|---|---|
| Cyclomatic V(G) (ESLint) | **31** | **32** | +1 |
| Cognitive complexity (Sonar) | 26 | 28 | +2 |
| Sonar issue | S3776 Critical | S3776 Critical | still open |
| Line coverage of its file | **23.9 %** (node:test, 57 tests) | **98.5 %** (Jest, 259 tests) | +74.6 pts |
| Branch coverage of its file | not measurable (most of the function never ran) | **89.1 %** | |

**Why complexity went up, not down.** Phase 4's top recommendation was to split `runScan` into `fetchTarget()`, `runChecks()` and `mapFetchError()`. That refactor was never done. Instead the DEF-009 SSRF fix (commit `5ef122c`) added one more branch to it: `if (isBlockedError(fetchError))`. The function grew because a security fix was put into the function that already did too much, which is how complexity builds up in practice.

**Why it still matters.** Testing made `runScan` **well covered** (23.9 % → 98.5 %), but not **simpler**. Complexity is a design property. Tests reduce the *risk* of complex code but don't reduce the complexity. V(G) = 32 still means 32 basis paths. Each new error code makes the `catch` chain longer, and the 6 near-identical `try/catch` blocks around the checks are still there. This is logged as **OBS-09** (deferred). The refactor would bring every piece under 10 and is safe now that the 259-test suite covers it.

### 3.2 Whole code base

| Metric (Sonar way extended) | Phase 4 | Phase 11 | Change and reason |
|---|---|---|---|
| Lines of code | 3,002 | 3,122 | +120: `ssrfGuard.js` (DEF-009), validation fixes |
| Files / functions | 44 / 153 | 48 / 162 | |
| **Vulnerabilities** | **1 Critical** (Security **E**) | **0** (Security **A**) | see §4 |
| Bugs | 5 | 5 | same 5 false positives (line moved in `server.js`) |
| Code smells | 3 | 4 | +S8786 on the new email regex |
| Technical debt | 27 min | 49 min | +18 min S8786, +2 min S3776 |
| Duplication | 2.6 % | 2.5 % | same 106 lines, more code around them |
| Cyclomatic (total) | 397 | 425 | +28, mostly the new `ssrfGuard.js` (23) |
| Cognitive (total) | 239 | 263 | +24 |
| Coverage | not available (no lcov in Phase 4) | 93.9 % | Phase 4's node:test run: 58 % of *loaded* files only |
| `errorHandler` V(G) | 11 | 16 | DEF-002/003 fixes added JSON-parse and CORS branches |
| `checkSsl` V(G) | 17 (missing from the Phase 4 table) | 17 | unchanged |

## 4. What static analysis would have caught earlier

On the Phase 4 code SonarQube reports a **Critical vulnerability**, S5852, at `server/models/user.js:18`:

```js
/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/   // Phase 4 email regex
```

`(\w+)*` is a **nested quantifier**. On an input such as `aaaa…a!` the regex engine tries an exponential number of ways to split the `a`s before failing (ReDoS, OWASP A05/A06). This is the **same regex** that caused **DEF-008** (valid emails with `+tags` or `.info` rejected), which was found in Phase 5 only as a side effect of fixing DEF-001. It was replaced by a simple sanity check, which removed the vulnerability *by accident*. That fix is what leaves the milder S8786 smell today.

**Lesson for the viva:** one static scan in Phase 2 would have pointed at this line on day one, for two reasons (ReDoS and an over-strict pattern). This is the strongest argument for running SonarCloud in CI from the start, which the new `sonar` job now does.

What static analysis did **not** find: none of the 10 Phase 2–9 defects other than DEF-008's regex. DEF-001 (email normalisation mismatch), DEF-009 (SSRF via redirects) and DEF-010 (missing client headers) are design and data-flow problems. A rule-based scan of single files does not see them. The Community Build also states that it does **not** run taint analysis for injection or SSRF ("Limited security analysis" banner in the overview screenshot). Static and dynamic testing find **different** defects, so we need both.

## 5. Defects and observations raised

| ID | Finding | Status |
|---|---|---|
| **OBS-09** | `runScan` cognitive complexity 28 / V(G) 32 (S3776 Critical); Phase 4 refactor recommendation not done; DEF-009 fix made it larger | **Deferred**: recommendation (split into `fetchTarget` / `runChecks` / `mapFetchError`). Logged in [defect-log.md](../10-defects/defect-log.md) |
| (triaged) | 5 × S9383 floating promise | Rejected: false positive in context (§2.1) |
| (triaged) | S8786 email regex, S6772 JSX spacing, S3776 `checkSsl` (16) | Accepted: low risk / cosmetic / borderline |

No new Critical or High defect was found, so the test plan's exit criterion "no open Critical or High defects" still holds. S3776 has *Critical* severity in Sonar's scale, but it is a maintainability rating, not a failure: the code behaves correctly.

## 6. Limits of these numbers

1. **Quality gate "Passed" is weak evidence.** The Sonar way gate checks only *new code* against a baseline. On a first analysis everything is "overall code", so the gate has almost nothing to judge. It becomes useful from the second SonarCloud run on, when each PR is gated.
2. **Ratings need triage.** Reliability **C** comes only from 5 false positives (§2.1).
3. **Profile choice changes the result.** The core profile hides the most important finding (S3776 on `runScan`).
4. **Coverage is reused, not re-measured.** The lcov file is the one produced by Phase 8/9 on Windows (259 Jest tests), and its `models/User.js` path needed its case fixed for a case-sensitive Linux scanner. Server code has not changed since (`git log` on `server/` ends at the same commit), so the figures are current. In CI the job uses the lcov the `unit-api` job has just produced.
5. **Local vs. SonarCloud.** The numbers in §2–§5 come from the local SonarQube Community Build 26.11. SonarCloud uses the same analyser (SonarJS). Its results are in §7: the same coverage, plus 3 taint-analysis findings on the original code, all triaged as not exploitable.

## 7. SonarCloud run (CI)

The `sonar` job in [`.github/workflows/qa.yml`](../../.github/workflows/qa.yml) runs after `unit-api`, downloads its fresh coverage, fixes the paths, and runs `SonarSource/sonarqube-scan-action`. Without the `SONAR_TOKEN` secret it prints a notice and skips the scan. Setup steps: [sonarcloud-setup.md](sonarcloud-setup.md). The repository owner added the secret on 2026-11-23, and the job has uploaded an analysis on every push since then.

| | |
|---|---|
| Dashboard | <https://sonarcloud.io/dashboard?id=danit-x_web-security-scanner&branch=qa%2Fec4206-testing> |
| Evidence | [`../evidence/sonar/sonarcloud/`](../evidence/sonar/sonarcloud/): public API JSON for both branches, no token |

### 7.1 First run: wrong scope (fixed)

The first CI scan (run 45204586083) analysed **20,771 lines**, not ~3,100, and reported coverage of only 47.7 %. The scanner log explains why:

> `WARN The following properties are configured but have no effect: sonar.sources, sonar.test.inclusions, sonar.tests.`

SonarCloud's new *analysis scope* scans the whole repository and ignores `sonar.sources`. It therefore analysed `qa/` (scripts and HTML evidence reports) and the workflow file, and raised 18 issues there. Examples include "use a full commit SHA" for actions, `npm ci` without `--ignore-scripts`, and `Math.random()` in test helpers. These are real CI-hardening points, but they are outside the application under test. **Fix** (commit `4381fbb`): the scope is now set by `sonar.exclusions` (everything except `server/` and `client/src/`). The next scan indexed 55 files, and all 18 out-of-scope issues closed.

**Lesson:** always read the scanner log. A green job can still be measuring the wrong thing.

### 7.2 Result on the QA branch (run 45205477540, commit `4381fbb`)

| Quality gate | Bugs | Vulnerabilities | Hotspots | Open issues | Coverage | Duplication |
|---|---|---|---|---|---|---|
| **Passed** | **0** (A) | **0** (A) | 0 | 1 (S8786, accepted in §2.1) | **93.9 %** (line 96.1, branch 89.1) | 2.4 % |

SonarCloud's coverage figure matches the local run exactly, because both read the same Jest lcov. SonarCloud classifies `qa/ec4206-testing` as a **short-lived branch** (`Branch name: qa/ec4206-testing, type: short`) and compares it with `main`. Its size and complexity measures (17 files, 1,484 lines) therefore cover only the files changed since `main`, which is why they are smaller than the local whole-project figures in §2. The default profile, `Sonar way core`, does not raise S3776 or S6772 (see §6 point 3 and [sonarcloud-setup.md](sonarcloud-setup.md)), so OBS-09 does not appear there.

### 7.3 `main` (original code) and taint analysis

When the repository was imported, SonarCloud's *Automatic Analysis* scanned `main`, the original code at `ba8a9ba`: **5 bugs, 4 vulnerabilities, Security rating E**. The 5 bugs are the S9383 false positives (§2.1). One vulnerability is the S5852 ReDoS in the old email regex, already found in §4 and removed by the DEF-008 fix.

The other **3 come from taint analysis**. SonarCloud follows user input across files to a dangerous call, which the local Community Build cannot do (§6). Triage:

| Rule | Where | Taint path | Triage |
|---|---|---|---|
| S5147 NoSQL injection, **Blocker** | `routes/scanRoutes.js:58` `ScanResult.find({ userId: req.userId })` | `authMiddleware.js:21` → `req.userId = decoded.id` → `find()` | **False positive.** The source is the `id` claim of a JWT that `jwt.verify()` has checked with the server's secret. A client cannot set it, for example to `{"$ne": null}`, without the secret, and a forged or altered token gets 401 (Jest `security/owasp.test.js`: "a token signed with a different secret is rejected"). The tool does not model signature verification as a sanitiser. Optional defence in depth: reject a non-string `decoded.id` in `authMiddleware` |
| S5145 log injection, Minor | `controllers/scanController.js:87` logs `req.userId` and the scan URL | same source, plus the request body | **Not exploitable.** `userId` comes from the signed token. The URL has passed `isURL()`, which rejects whitespace including CR/LF, so it cannot forge a new log line |
| S5145 log injection, Minor | `middleware/errorHandler.js:60` logs `req.originalUrl` | request line | **Not exploitable.** Node's HTTP parser rejects a raw CR/LF in the request line, and an encoded `%0A` is logged as text |

We checked all three against the current code, where the flagged lines are unchanged, and raised no new defect. Since PR #12 was merged, `main` is analysed in full on every push (run 45411465382, 24 November 2026). The quality gate passes and coverage is 93.9 %, but the ratings still count these triaged items: 5 bugs (the S9383 false positives) and 3 vulnerabilities (the taint findings above), which give Reliability C and Security E. Marking them in SonarCloud as *False positive* or *Safe*, with a link to this triage, would bring both ratings to A.
