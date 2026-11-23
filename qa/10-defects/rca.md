# Root Cause Analysis (RCA)

| Item | Value |
|---|---|
| Document ID | QA-RCA-10 |
| Scope | All 10 defects (DEF-001 to DEF-010) and the 8 observations in [defect-log.md](defect-log.md) |
| Deep RCA (5 Whys + fishbone) | **DEF-001** (High, functional) and **DEF-009** (High, security) |
| Short RCA | DEF-002 to DEF-008, DEF-010, and the observations |
| Evidence used | the defect log, the TDD log ([05-unit/tdd-log.md](../05-unit/tdd-log.md)), Phase 9 notes, and the **git history of the original code** (commit hashes below), so each cause points at the change that introduced it |

## 1. Method

**Root cause** = the earliest cause that, if removed, would have prevented the defect *and* similar ones. A root cause is about the process or design, not a single line of code. The line of code is the *defect*; the reason the line was written that way and not caught is the *root cause*.

Two techniques are used together:

- **5 Whys** (Toyota): ask "why?" until the answer is a process or design gap rather than a symptom. Each answer has to be backed by evidence (code, commit, test result), not opinion.
- **Fishbone (Ishikawa)**: list contributing causes in categories, so causes that are not on the single 5 Whys chain are not lost. The categories are the usual "6M" adapted to software: **Method/Process, People, Design/Code, Tools/Libraries, Testing, Environment/Data**.

Every RCA ends with **correction** (what fixed this defect), **containment** (anything already affected) and **prevention** (what stops the whole class from coming back).

---

## 2. DEF-001: Gmail users with dots or `+tags` cannot log in after registering

**Problem statement:** a user who registers as `qa.tester@gmail.com` gets `201 Created`, but logging in with the same address returns `401 Invalid email or password`. The account is unusable once the first 7-day token expires. Found in Phase 2 (TC-REG-10), severity High, P1.

### 2.1 5 Whys

| # | Why? | Answer | Evidence |
|---|---|---|---|
| 1 | Why does login return 401? | `login()` looks up `qa.tester@gmail.com`, but the stored address is `qatester@gmail.com`, so `User.findOne` returns `null`. | TC-REG-10 response: `user.email` = `qatester<ts>@gmail.com`; `authController.login` uses `email.toLowerCase().trim()` |
| 2 | Why is the stored address different from what the user typed? | The register route runs `registerValidationRules`, which ends with `.normalizeEmail()`. That **rewrites** `req.body.email` before the controller saves it. The login rules have no `normalizeEmail()`, so login compares a differently transformed key. | `validators/authValidators.js` at `ba8a9ba` |
| 3 | Why does `normalizeEmail()` remove the dots? | Its defaults in validator.js are `gmail_remove_dots: true` and `gmail_remove_subaddress: true`. The developer expected it only to lowercase: the code comment says *"lowercases + strips dots in gmail etc. — keeps lookups consistent"*. The intent (consistent lookups) was right, but it was applied to **one side only**. | comment in commit `dd95cb5` (2026-07-17) |
| 4 | Why was the same rule not applied on both sides? | There is **no single place** that defines the canonical form of an email. It is decided separately by the register validator, the login validator, the controller (`toLowerCase().trim()`) and the Mongoose model (its own regex, see DEF-008). The register rules were wired in two days later by commit `b98b027` *"fix: correct"* (2026-07-19), which uncommented them in `authRoutes.js`. That silently switched `normalizeEmail()` on, with no test and no review. | `git show b98b027 -- server/routes/authRoutes.js` |
| 5 | Why did no test catch it before QA? | The 32 original tests covered middleware, validators, scoring and ownership, but **none registered a user and then logged in** (no round-trip test), and none used an address with a dot or `+`. Manual checks used simple addresses. | `server/tests/` at `ba8a9ba`: no auth route test |

**Root cause:** email canonicalisation had **no single source of truth**. It was a side effect of a validation chain on one route, so the write path (register) and the read path (login) used different keys. A **missing register→login round-trip test** let it through.

### 2.2 Fishbone

```
 METHOD / PROCESS              PEOPLE                        DESIGN / CODE
 ─────────────────             ──────                        ─────────────
 direct commit "fix: correct"  normalizeEmail() assumed      email rule defined in 4 places
   with no review ──────┐        to only lowercase ────┐       (2 validators, controller,  ┐
 no definition of done   │      comment states the      │       model regex)                │
   requiring tests ──────┤        wrong behaviour ──────┤      validator mutates req.body  ─┤
                         │                              │        as a side effect           │
                         ▼                              ▼                                   ▼
 ════════════════════════════════════════════════════════════════════════════════════════════▶  DEF-001
                         ▲                              ▲                                   ▲     Gmail users with
                         │                              │                                   │     dots/+tags can't
 no register→login ──────┤      validator.js defaults ──┤      dev data used simple ────────┤     log in (401)
   round-trip test       │        strip dots & +tags    │        addresses (no dots)        │
 no test data with ──────┘        (not obvious from ────┘      live Atlas DB may already ───┘
   dots / +tags / caps            the method name)               hold stripped addresses
 ─────────────────             ─────────────────             ─────────────────
 TESTING                       TOOLS / LIBRARIES             ENVIRONMENT / DATA
```

| Category | Contributing cause |
|---|---|
| Method/Process | The change that activated the bug was a direct commit titled *"fix: correct"*, with no review and no test. |
| People | The library function's behaviour was assumed from its name. The code comment records the wrong assumption. |
| Design/Code | The same rule lives in four places, and validation has a hidden side effect (it changes the data). |
| Tools/Libraries | `normalizeEmail()` defaults are aggressive and provider-specific (Gmail only), so it only shows with certain addresses. |
| Testing | No round-trip (write then read) test; test data had no realistic edge cases such as dots, `+tags` or upper case. |
| Environment/Data | Dev data used simple addresses. The live database may already hold stripped addresses (see containment). |

### 2.3 Correction, containment and prevention

- **Correction (done, Phase 5, test-first):** `normalizeEmail()` replaced by `toLowerCase()`, so emails are stored as typed (lower case). Regression: `regression/defects.test.js › DEF-001` (3 tests), TC-REG-10, and BDD scenario `@DEF-001` *"A Gmail user with dots and a +tag can log back in"* in [login.feature](../06-bdd/features/login.feature).
- **The fix exposed DEF-008:** with the normaliser gone, the model regex rejected `+`. The two defects share one root cause (duplicated email rules).
- **Containment (recommendation, not done):** any account created on the **live** deployment before the fix is stored in the stripped form, and after the fix its owner can no longer log in with the address they typed. QA must not touch the Atlas database (project rule), so this is a recommendation for the owner: a one-off check for Gmail accounts, or a login fallback that also tries the old normalised form for `@gmail.com` addresses.
- **Prevention:**
  1. One `canonicalEmail()` helper, used by register, login and any lookup.
  2. A round-trip rule for every write/read pair: *anything you can save, you can find again with the same input.*
  3. Realistic edge-case test data (dots, `+tags`, mixed case, long TLDs).
  4. No direct commits without a test; the Phase 8 CI pipeline now runs the tests on every `qa/` branch.

---

## 3. DEF-009: SSRF guard bypassed by redirects and DNS rebinding (OWASP A10)

**Problem statement:** in production, the scanner could be steered to internal addresses such as the cloud metadata service `169.254.169.254`, loopback or private LAN hosts. Two routes: (a) a public page that answers `302 Location: http://169.254.169.254/...`, and (b) a hostname that resolves to a public IP when checked and to `127.0.0.1` when connected (DNS rebinding). After a redirect, the file-exposure probes (`/.env`, `/.git/config`) and the TLS check also ran against the internal origin. Found in Phase 9, severity High, P1.

### 3.1 5 Whys

| # | Why? | Answer | Evidence |
|---|---|---|---|
| 1 | Why can the scanner reach `169.254.169.254`? | `scanController` calls `axios.get(url, { maxRedirects: 5 })`. axios follows each redirect and does its **own DNS lookup** when it connects. Neither the redirect target nor the connect-time address is checked. | `scanController.js` line 92–100 at `ba8a9ba`; `def-009-ssrf.test.js` (5 tests red before the fix) |
| 2 | Why are those not checked? | The only SSRF control, `blockPrivateTargets`, is an **express-validator rule on the input URL**. It runs once, before the controller, and checks the address the name resolves to *at that moment*. Everything after the validator is trusted. | `validators/scanValidators.js` (added in `dd95cb5`) |
| 3 | Why was the control put at the input? | SSRF was treated as an **input-validation** problem ("is this URL allowed?") rather than an **outbound-connection** problem ("may this socket connect to this IP?"). The validation layer was the hook already available. The check-then-use gap (time-of-check vs time-of-use) was not considered. | design of `blockPrivateTargets`; no threat model in the repo |
| 4 | Why didn't anyone revisit the fetch code when the guard was added? | The fetch code came **first**: redirect following was added on 2026-07-14 (`ba40eed`, `2928831`) and the guard three days later (`dd95cb5`, 2026-07-17), as a bolt-on. The scanner also makes outbound requests from **three different places** (main fetch, `fileExposureCheck` with its own `axios.get`, `sslCheck` with `tls.connect`), so there was no single egress point to protect. | `git log -- server/controllers/scanController.js server/validators/scanValidators.js` |
| 5 | Why did eight phases of testing not catch it? | The guard is **switched off outside production** (`NODE_ENV !== "production"`, the documented dev bypass), and every functional test (Phases 2–8) ran in dev/test mode against the local fixture. The guard's unit tests only used **literal** internal URLs, never a redirect or a name that changes its answer. Finding SSRF needs adversarial test design, which started in Phase 9. | `server/tests/scanValidators.test.js` at `ba8a9ba`; stage containment in [defect-metrics.md](defect-metrics.md) §5 |

**Root cause:** the security control was placed at the **input boundary** instead of at the **point where the connection is made**, and outbound requests had **no single guarded egress path**. Testing contributed: the control was disabled in every environment the functional tests ran in.

### 3.2 Fishbone

```
 METHOD / PROCESS              PEOPLE                        DESIGN / CODE
 ─────────────────             ──────                        ─────────────
 no threat model of the  ┐     SSRF seen as input     ┐      check at input only,       ┐
   scan flow             │       validation           │        trust after it           │
 guard bolted on 3 days ─┤     TOCTOU / DNS rebinding ┤      3 outbound clients, no ────┤
   after redirects added │       not known to dev     │        central egress point     │
                         │                            │      maxRedirects: 5, no hook ──┤
                         ▼                            ▼                                 ▼
 ═══════════════════════════════════════════════════════════════════════════════════════════▶  DEF-009
                         ▲                            ▲                                 ▲     scanner can be
                         │                            │                                 │     steered to
 guard OFF in dev/test ──┤     axios follows ─────────┤      app runs on cloud hosts ───┤     169.254.169.254 /
   so functional tests   │       redirects by default │        that expose a metadata   │     internal hosts
   never exercise it     │     OS resolver re-looks ──┤        service on 169.254.x     │
 only literal-IP unit ───┘       up the name on       │      user fully controls the ───┘
   tests, no redirect /          connect              │        target URL (by design)
   rebinding cases                                    │
 ─────────────────             ─────────────────             ─────────────────
 TESTING                       TOOLS / LIBRARIES             ENVIRONMENT / DATA
```

| Category | Contributing cause |
|---|---|
| Method/Process | No threat model for "the server fetches a URL the user chose". The guard was added after the fetch code, without revisiting it. |
| People | The time-of-check vs time-of-use gap and DNS rebinding are specialist knowledge, not part of normal functional thinking. |
| Design/Code | Trust after validation. Three separate outbound clients. Redirect following with no per-hop check. |
| Tools/Libraries | axios follows redirects by default; the OS resolver is called again at connect time. |
| Testing | The guard is off in dev/test, so 44 BDD scenarios, 360 Postman checks and 11 Selenium tests could not see it. Unit tests used literal IPs only. |
| Environment/Data | Render and similar hosts expose a metadata service, which makes an internal request valuable to an attacker. Users choose the target URL by design. |

### 3.3 Correction, containment and prevention

- **Correction (done, Phase 9, test-first):** new `server/utils/ssrfGuard.js`. `guardedLookup` re-checks **every resolved address at connect time** in the HTTP/HTTPS agents (all redirect hops and file probes) and in the TLS check. `beforeRedirect` blocks literal-IP redirects. Keep-alive is off so no socket is reused without a new check. Regression: `security/def-009-ssrf.test.js` with mocked DNS (no real host contacted), 35/35 security tests, full Jest 259/259.
- **Containment:** a scan only returns a report to the user who started it, so exposure required an attacker to run scans themselves. There are no server-side security logs to check for past abuse (OWASP A09 gap noted in Phase 9). Recommendation for the owner: review the host's outbound logs if available and rotate any credentials reachable through the metadata service.
- **Prevention:**
  1. Put network controls **where the connection is made** (one guarded agent for all outbound traffic), not only at the input.
  2. Test security controls with them **switched on**: the DEF-009 tests run the guard in production mode with mocked DNS.
  3. Add abuse cases (redirects, rebinding, encodings) to the test design from Phase 3 onwards, not only in a late security phase.
  4. Log blocked SSRF attempts as security events (A09).

### 3.4 What DEF-001 and DEF-009 have in common

Both have the same shape: **a rule enforced in one place, while the data is used in another.** DEF-001 normalised the email on write but not on read. DEF-009 checked the address at input but not at connect. DEF-008, DEF-010 and OBS-06 have the same shape too (see §4). The general lesson: *enforce a rule at the point where it matters, and in one place only.*

---

## 4. Short RCA: remaining defects

| ID | Sev. | Root cause (why it happened) | Category | Why it escaped earlier testing | Fix (Phase) | Prevention |
|---|---|---|---|---|---|---|
| DEF-002 | Medium | `errorHandler` trusted `res.statusCode` (still 200) and ignored `err.status`, which body-parser sets to 400. Every client error raised by middleware became a 500. The stack was shown whenever `NODE_ENV` was not `production`. | Unhandled error type | Original tests never sent malformed input to the API; no negative API tests | Honour `err.status`; stack only on 5xx (P5) | Negative-input cases per endpoint; one error contract (status + `{success,message}`) tested centrally |
| DEF-003 | Low | The CORS callback signals refusal by passing a plain `Error`, which the global handler maps to 500. Rejection was coded as a crash. | Unhandled error type | No test with a foreign `Origin` header | Error carries `status = 403` (P5) | Every deliberate refusal gets an explicit 4xx status |
| DEF-004 | Low | `isURL()` default `require_tld: true` runs **before** the dev bypass, so the documented intent ("allow localhost in dev") was never reachable. Library default not checked against the requirement. | Library default / verification | The developer scanned `127.0.0.1`, which passes. Comment and code were never compared. | `require_tld: false` (P5); regression `› DEF-004` (2 tests) and EP-URL-04. Relaxing the rule is covered by OBS-05's 4 disguised-loopback guard tests | Verify documented intent with a test ("dev allows `localhost`") |
| DEF-005 | Medium | express-validator checks a **string copy** of the value but passes the original number on to `bcrypt.hash()`, which only accepts strings. Type was never asserted (`isString()` missing). | Unhandled input type | No wrong-type inputs in tests; EP "wrong-type" class first used in Phase 3 | `isString()` on password (P5) | Type assertion first in every validator chain; EP wrong-type class for every field |
| DEF-006 | Low | Comment promised "defensive against malformed findings", but the code dereferenced `finding.severity` without a null check. Documentation and code disagreed. | Missing defensive code | Original scoring tests used only well-formed findings | `finding?.severity` (P5) | A test for every documented guarantee |
| DEF-007 | Low | The JWT catch block compared `error.name` against two names out of three subclasses; `NotBeforeError` fell through to 500. Matching on names instead of the base class. | Unhandled error type | Black-box tests cannot create an `nbf` token; only white-box basis-path analysis (AM-P8) reached that node | `instanceof jwt.JsonWebTokenError` (P5) | Catch by base class; basis-path coverage on auth code |
| DEF-008 | Medium | The Mongoose model had its own strict email regex (no `+`, TLD of 2–3 letters), duplicating and disagreeing with `isEmail()`. **Same root cause as DEF-001** (email rule in several places). It was masked for Gmail by `normalizeEmail()` stripping `+tags`. | Duplicated rule | Masked by DEF-001; `.info`-style addresses never used in tests | Model keeps only a sanity check (P5) | One validator per field; retest after each single fix (which is how it was found) |
| DEF-010 | Medium | The API was hardened (helmet) but the static frontend gets its headers from the **host config** (`vercel.json`), which had none. Security headers were seen as a server concern, so the second "server" was missed. | Control in the wrong place / config gap | Functional UI tests do not check headers; only a DAST scan (ZAP) looks at them | `security-headers.json` as single source, served by Vercel and `vite preview`; drift test (P9) | Security checklist per deployable unit; DAST in the pipeline |

### Observations (short)

| ID | Cause | Outcome |
|---|---|---|
| OBS-01 | UI disabled the button *and* kept a message for the disabled case, so the message was dead code. Two mechanisms for one rule. | Fixed (P5) |
| OBS-02 | Message written from memory ("under 100") instead of from the rule (`max: 100`). Off-by-one in wording. | Fixed (P5) |
| OBS-03 | Schema enum (`E`) designed separately from the scorer; score gaps follow from the deduction weights. | `E` removed; gaps accepted by design (P9) |
| OBS-04 | Password policy was length + digit only; no letter or breached-password check. | Letter now required (P9); breached-password check is a product decision |
| OBS-05 | IPv6 regexes tested `hostname` with brackets; `localhost` entry unreachable after `isURL`. Guard worked by accident. | Fixed (P5) |
| OBS-06 | Password minimum duplicated in client (6) and server (8); only the server was updated. **Duplicated rule**, like DEF-001/008. | Fixed (P7) |
| OBS-07 | `registerLimiter` left commented out since `22fa493`. | Deferred (product decision) |
| OBS-08 | bcrypt cost on a 4-thread libuv pool caps auth throughput. Capacity, not a defect. | Deferred (capacity note) |

---

## 5. Root cause categories across all defects

| Root cause category | Defects | Count (DEF) | Observations |
|---|---|---|---|
| **Rule duplicated or enforced in the wrong place** | DEF-001, DEF-008, DEF-009, DEF-010 | 4 | OBS-01, OBS-05, OBS-06 |
| **Error or input type not handled** (crash → 500 instead of 4xx) | DEF-002, DEF-003, DEF-005, DEF-007 | 4 | |
| **Library default or documented intent not verified** | DEF-004, DEF-006 | 2 | OBS-02, OBS-03 |
| Policy / capacity (not code defects) | | 0 | OBS-04, OBS-07, OBS-08 |

Both High defects are in the first category. The second category (4 defects) all share one symptom, a **500 where a 4xx was correct**. A simple rule would have caught all four: *bad input must give a 4xx, never a 500*, checked for every endpoint.

## 6. Process improvements (for the team and the owner)

1. **Single source of truth** for each validation rule (email form, password policy, security headers), shared by client, server and model where possible.
2. **Round-trip tests** for every write/read pair (register → login, save → fetch).
3. **Security controls tested switched on.** Any control with an environment bypass needs a test that runs it in production mode.
4. **Abuse cases in test design from the start** (redirects, encodings, wrong types), not only in a late security phase.
5. **No untested direct commits.** The CI pipeline from Phase 8 now runs every suite and the coverage gate on each `qa/` branch, and the team rule is that CI must be green before a merge.
6. **Retest after each single fix**, not after a batch: this is how DEF-008 was found and kept separate from DEF-001.
