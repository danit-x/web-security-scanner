# Defect Log

Phase 10 analysis: [root cause analysis](rca.md) · [lifecycle and each defect's path](defect-lifecycle.md) · [metrics](defect-metrics.md)

Lifecycle used: **New → Open (triaged) → In progress → Fixed → Retest → Verified → Closed**. A defect can also be Reopened, Rejected or Deferred.

Severity is the impact on the system. Priority is how urgently it must be fixed.

| ID | Title | Found by | Severity | Priority | Status |
|---|---|---|---|---|---|
| DEF-001 | Gmail users with dots or `+tags` in their address cannot log in after registering | TC-REG-10 | **High** | P1 | **Closed** (Phase 5) |
| DEF-002 | Malformed JSON body returns 500 with a stack trace instead of 400 | TC-API-05 | Medium | P2 | **Closed** (Phase 5) |
| DEF-003 | Disallowed CORS origin returns 500 with a stack trace | TC-API-04 | Low | P3 | **Closed** (Phase 5) |
| DEF-004 | `localhost` scan targets are rejected in development, contradicting the documented dev bypass | Run 1 cascade (TC-SCAN-01) | Low | P3 | **Closed** (Phase 5) |
| DEF-005 | Password sent as a JSON number crashes registration (500) | EP-PW-06 (Phase 3) | Medium | P2 | **Closed** (Phase 5) |
| DEF-006 | `calculateScore()` throws on a `null` finding, despite being documented as defensive | EP-SC-06 (Phase 3) | Low | P3 | **Closed** (Phase 5) |
| DEF-007 | Token with a future `nbf` (not-before) returns 500 instead of 401 | AM-P8 (Phase 4 basis path) | Low | P3 | **Closed** (Phase 5) |
| DEF-008 | Valid emails (`+tag`, TLDs longer than 3 letters such as `.info`) rejected by the User model regex | Exposed while fixing DEF-001 (Phase 5) | Medium | P2 | **Closed** (Phase 5) |
| DEF-009 | SSRF guard bypassed by redirects and DNS rebinding: the scanner can be steered to `169.254.169.254` or other internal hosts (OWASP A10) | Phase 9 code review + `security/def-009-ssrf.test.js` | **High** | P1 | **Closed** (Phase 9) |
| DEF-010 | React client served with no security headers (no CSP, no clickjacking protection, no `nosniff`) (OWASP A05) | Phase 9 ZAP passive scan (2 Medium, 1 Low) + `vercel.json` review | Medium | P2 | **Closed** (Phase 9) |
| OBS-05 | SSRF guard checks that can never fire: the `localhost` entry (blocked earlier by `isURL`) and the IPv6 regexes (the hostname keeps its brackets) | Phase 4 coverage + BP-P4b/BP-X1 | (Observation) | P2 | **Closed** (Phase 5) |
| OBS-01 | Scan button is silently disabled. The ownership message in `handleSubmit` is unreachable (dead code). | TC-UI-05 | (Observation) | P4 | **Closed** (Phase 5) |
| OBS-02 | Name of 100 characters is accepted, but the message says "under 100 characters" | BVA-NM-04/05 | (Observation) | P4 | **Closed** (Phase 5) |
| OBS-03 | Scores 87/90/93/95/96/98/99 can never occur. The schema allows grade `E`, which the scorer never produces. | BVA-SC-15 | (Observation) | P4 | **Closed** (Phase 9): `E` removed; score gaps accepted as by design |
| OBS-04 | Weak passwords such as `12345678` are accepted (no letter required, no breached-password check) | EP-PW-07 | (Observation) | P3 | **Closed** (Phase 9): a letter is now required |
| OBS-06 | Register form allows 6-character passwords (`minLength="6"`), but the API requires 8, so the browser accepts passwords the server always rejects | Phase 7 Selenium (code reading for locators) → TC-UI-11 | (Observation) | P4 | **Closed** (Phase 7) |
| OBS-07 | Sign-up has no dedicated rate limit (`registerLimiter` is commented out); it is the most CPU-expensive endpoint (bcrypt) | Phase 9 code review + JMeter breakpoint test | (Observation) | P3 | **Deferred**: recommendation |
| OBS-08 | Auth throughput ceiling: about 32 sign-ups/s and 32 logins/s on the test machine; beyond that requests queue (p95 12.4 s) but never fail | Phase 9 JMeter breakpoint (800 users) | (Observation) | P4 | **Deferred**: capacity note, tuning shown |
| OBS-09 | `runScan` is still too complex: cyclomatic V(G) 32 (was 31 in Phase 4), cognitive 28 (limit 15). The Phase 4 refactor was not done, and the DEF-009 fix added a branch | Phase 11 SonarQube S3776 (Critical, maintainability) | (Observation) | P3 | **Deferred**: refactor recommendation |

---

## DEF-001: Gmail users with dots or `+tags` cannot log in after registering

**Environment:** local QA (QA-STLC-02 §4), build `ba8a9ba`

**Steps to reproduce:**
1. `POST /api/auth/register` with `{"name":"QA Gmail","email":"qa.tester.<ts>@gmail.com","password":"Passw0rd3"}`
2. `POST /api/auth/login` with `{"email":"qa.tester.<ts>@gmail.com","password":"Passw0rd3"}`

**Expected:** step 1 → 201, step 2 → 200 with a token.
**Actual:** step 1 → 201, but `user.email` is `qatester<ts>@gmail.com` (dots removed). Step 2 → **401 "Invalid email or password"**. The user is locked out of the account they just created.

**Impact:** every Gmail or Googlemail user with a `.` or `+` in their address (a very common pattern) can register but never log back in once the 7-day token expires. Registering again fails with "User already exists".

**Initial analysis:**
- `registerValidationRules` calls `normalizeEmail()`. Its defaults are `gmail_remove_dots: true` and `gmail_remove_subaddress: true`.
- `loginValidationRules` does **not** normalise, and `login()` only applies `toLowerCase().trim()`.
- So the two sides compare differently transformed keys. Full RCA in Phase 10.

**Evidence:** `qa/evidence/api-run-2026-11-23T09-53-14-102Z.json` (TC-REG-10)

## DEF-002: Malformed JSON returns 500 with a stack trace

**Steps:** `POST /api/auth/login` with header `Content-Type: application/json` and body `{"email":`
**Expected:** 400 `{success:false, message}` with no internal details.
**Actual:** **500**, `message: "Unexpected end of JSON input"`, and the body contains `stack` with server file paths.

**Analysis:**
- `express.json()` raises an error with `err.status = 400`.
- `errorHandler` only reads `res.statusCode` (still 200 at that point) and ignores `err.status`, so it falls back to 500.
- The stack is included because `NODE_ENV !== "production"`. In production the status is still wrong (500), but the stack is hidden.

**ISO 25010:** reliability (fault tolerance) and security (confidentiality, information leakage in dev).

## DEF-003: Disallowed CORS origin returns 500 with a stack trace

**Steps:** `GET /api/health` with header `Origin: http://evil.example`
**Expected:** a clean refusal (403, or simply no `Access-Control-Allow-Origin` header) with no stack.
**Actual:** **500** `Not allowed by CORS`, with the stack trace in the body (dev mode).

**Analysis:** the `cors` origin callback passes `new Error(...)`, which the global handler maps to 500. Browsers still block the response, so this is not a security hole, but it pollutes the error logs and monitoring with false "server errors".

## DEF-004: `localhost` targets are rejected in development

**Steps:** in `NODE_ENV=development`, `POST /api/scan` with `{"url":"http://localhost:5070/","ownershipConfirmed":true}`
**Expected:** the scan runs. `scanValidators.js` says: *"In development, allow everything through so you can scan your own localhost dev server."*
**Actual:** 400 "Please provide a valid URL including http:// or https://"

**Analysis:**
- `isURL({ require_protocol: true })` runs *before* the dev bypass inside `blockPrivateTargets`.
- `isURL` defaults to `require_tld: true`, so a hostname without a TLD (`localhost`) is rejected.
- Workaround: `127.0.0.1` passes.
- The code and its documented intent disagree, which makes this a **verification** defect.

## OBS-01: Silent disabled scan button / unreachable branch

**Observed:** with the ownership box unticked, the Execute Scan button is `disabled` (shown at 50% opacity). Nothing explains why it doesn't respond.
`Dashboard.jsx` `handleSubmit` contains `if (!ownershipConfirmed) setApiError('Please confirm…')`, but that line is unreachable because a disabled submit button can't fire `onSubmit`.

**Suggestion:** either remove the dead branch, or keep the button enabled and show the message. To be used in Phase 4 as a white-box example of unreachable code (code that 100% statement coverage can never reach).

## DEF-005: Password sent as a JSON number crashes registration

**Found by:** EP-PW-06 (EP, wrong-type invalid class)
**Steps:** `POST /api/auth/register` with `{"name":"QA","email":"qa.x@example.com","password":12345678}`. The password is a number, not a string.
**Expected:** 400 with a validation message.
**Actual:** **500 "Server error"**. The server log shows: `Register error: data must be a string or Buffer and salt must either be a salt string or a number of rounds`.

**Analysis:**
- express-validator *converts* the value to a string in order to validate it (`"12345678"` has 8 characters and a digit, so it passes), but it does not change `req.body`.
- The number therefore reaches `bcrypt.hash()`, which only accepts strings or Buffers.
- The type is never asserted (`isString()` is missing).

**ISO 25010:** reliability (fault tolerance).

## DEF-006: `calculateScore()` throws on a `null` finding

**Found by:** EP-SC-06
**Steps:** `calculateScore([null])`
**Expected:** 100. The comment says the function is "defensive against bad data from a check that somehow produced a malformed finding".
**Actual:** `TypeError: Cannot read properties of null (reading 'severity')`.

**Impact:** in `runScan`, `calculateGrade` runs outside the per-check try/catch blocks. A check that returned `null` in its findings array would turn the whole scan into a 500. Low severity, because no current check returns `null`.

## OBS-02: Name length message is off by one
At 100 characters the name is accepted (`isLength({max:100})`), but the error message for 101 says "Name must be **under** 100 characters". The message should say "at most 100" or "100 characters or fewer".

## OBS-03: Score and grade reachability
- **Scores:** deductions are 25, 15, 8 and 3, so the scores {87, 90, 93, 95, 96, 98, 99} can never be produced, and the A boundary (90) is never hit by a real scan.
- **Grades:** `ScanResults.grade` allows `"E"`, but `scoreToGrade` never returns it. This is a spec/implementation mismatch, found during verification.

**Phase 9 resolution:**
- *Grade E:* fixed test-first. `unit/scanResultModel.test.js` derives the set of grades the scorer can produce (A, B, C, D, F, by walking every score 0–100) and checks that the schema accepts exactly those. `"E" is rejected` failed, `E` was removed from the enum, and it passed.
- *Score gaps:* accepted as **by design**. They come from the deduction sizes (25/15/8/3). Grade A is still reachable (100, 97, 94, 92, 91), so no requirement is broken. Changing the weights would change every user's grade, which is a product decision, not a defect.

## OBS-04: Weak passwords accepted
`12345678` satisfies the policy (at least 8 characters, at least one digit). It will be revisited under OWASP A07 (Identification and Authentication Failures) in Phase 9.

**Phase 9 resolution:** the register rule now also requires a letter (`.matches(/[A-Za-z]/)`, message "Password must contain at least one letter"). Written test-first: `security/owasp.test.js` rejects `12345678` and `00000000` (red, then green), and a control case confirms `abcdefg1` is still accepted. Black-box case EP-PW-07 now expects 400. A breached-password check (e.g. the k-anonymity Pwned Passwords API) remains a recommendation; it would send data to a third party, so it needs a product decision.

## DEF-007: Token with a future `nbf` returns 500 instead of 401

**Found by:** basis path AM-P8 (white-box, `authMiddleware` CFG node 12)
**Steps:** send `Authorization: Bearer <token>`, where the token is signed with the server secret but has `nbf` (not before) one hour in the future (`jwt.sign({id}, secret, {notBefore: "1h"})`).
**Expected:** 401 (the token is not valid yet).
**Actual:** **500 "Server error"**.

**Analysis:**
- `jwt.verify` can throw `TokenExpiredError`, `JsonWebTokenError` or `NotBeforeError`.
- The catch block compares `error.name` against only the first two names, so `NotBeforeError` falls through to the generic 500 branch.

**Severity Low:** the server never issues `nbf` tokens, and a token can't be forged without the secret. But any future change that adds `nbf`, or clock skew between servers, would turn auth failures into server errors.

## OBS-05: SSRF guard checks that can never fire

1. The `"localhost"` entry in `BLOCKED_HOSTNAMES` can never be reached. `isURL()` (which requires a TLD) rejects `localhost` earlier in the chain. The existing unit test "production blocks `http://localhost:3000`" passes **for the wrong reason**: coverage shows lines 58–59 never execute.
2. `new URL("http://[::1]/").hostname` returns `"[::1]"` with brackets, so the IPv6 regexes `/^::1$/`, `/^fc00:/` and `/^fe80:/` never match. IPv6 literals are rejected only because `dns.lookup("[::1]")` fails.

The protection holds today, but only by accident. Follow-up in Phase 9 (OWASP A10).

## DEF-008: Valid email addresses rejected by the User model regex

**Found:** while fixing DEF-001 (Phase 5). Once `normalizeEmail()` was removed, registration of `first.last+qa@gmail.com` failed with 400 instead of 201.

**Root cause:** the Mongoose schema had its own strict regex, `/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/`. It rejects:
- `+` in the local part
- TLDs longer than 3 letters (`.info`, `.online`, `.museum`)

It disagreed with the route validator (`isEmail()`), which accepts both.
- `normalizeEmail()` had been masking the `+tag` case for Gmail only.
- `user@example.info` was rejected even before the change.

**Lesson:** two validators for the same field drift apart. A fix that removes one masking layer can expose the next defect. Retesting after every fix is what caught this.

**Fix:** the model keeps only a sanity check (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Strict validation stays in one place, `isEmail()`.

---

## Phase 5 resolution summary

Every fix followed **RED → GREEN → full regression**. Evidence is in `qa/evidence/tdd/`, and the full log is in [`qa/05-unit/tdd-log.md`](../05-unit/tdd-log.md).

| ID | Fix (file) | Regression test | Retest result |
|---|---|---|---|
| DEF-001 | `normalizeEmail()` → `toLowerCase()` (validators/authValidators.js). Emails are stored as typed, per the product decision. | `defects.test.js › DEF-001` (3 tests), TC-REG-10 | PASS |
| DEF-002 | errorHandler honours `err.status`, gives a clean message for malformed JSON, and includes a stack only on 5xx (middleware/errorHandler.js) | `› DEF-002`, TC-API-05 | PASS |
| DEF-003 | CORS rejection carries `status = 403` (app.js) | `› DEF-003` (2 tests), TC-API-04 | PASS |
| DEF-004 | `isURL({ require_tld: false })` (validators/scanValidators.js) | `› DEF-004` (2 tests), EP-URL-04 | PASS |
| DEF-005 | `isString()` on the register and login password (validators/authValidators.js) | `› DEF-005` (2 tests), EP-PW-06 | PASS |
| DEF-006 | `finding?.severity` (utils/scoring.js) | `› DEF-006`, EP-SC-06 | PASS |
| DEF-007 | `error instanceof jwt.JsonWebTokenError` (middleware/authMiddleware.js) | `› DEF-007`, AM-P8 | PASS |
| DEF-008 | Model email regex relaxed to a sanity check (models/User.js) | `› DEF-008` (3 tests) | PASS |
| OBS-01 | Scan button no longer disabled while unticked, so the message shows (client Dashboard.jsx) | TC-UI-05 retest (manual, screenshot) | PASS |
| OBS-02 | Message changed to "Name must be 100 characters or fewer" | `› OBS-02` | PASS |
| OBS-05 | IPv6 brackets stripped. Added rules for `::`, fc00::/7, fe80::/10 and IPv4-mapped `::ffff:`. `localhost` now reaches the hostname rule. | `› OBS-05` (13 tests incl. 4 obfuscated-IPv4 guard tests), BP-P4b, BP-X1 | PASS |
| (comment) | False "unreachable" comment in `scoreToGrade` corrected | – | – |

Still open: OBS-03 (unreachable scores; grade `E` in the schema) and OBS-04 (weak password policy, Phase 9).

## OBS-06: Register form password minimum disagrees with the API

**Found:** Phase 7, while reading `client/src/pages/Register.jsx` to choose Selenium locators.
**Observed:** both password inputs had `minLength="6"`. The API rejects anything under 8 characters (`authValidators.js`). A 6- or 7-character password passed browser validation, then failed with a 400 after a server round trip.
**Expected:** client-side validation uses the same rule as the server, so the user gets immediate, consistent feedback.
**Root cause:** the rule is duplicated in two places (client and server), and only the server copy was updated to 8.
**Fix (test-first):** new Selenium test TC-UI-11 checks `minLength == 8` and that a 7-character password is blocked by the browser. It failed (`'6' !== '8'`), then `minLength="8"` was set on both inputs, and the test passed. The full UI suite then passed 3 runs in a row (33/33).
**Verified:** TC-UI-11, screenshot `qa/evidence/selenium/TC-UI-11.png`.

## DEF-009: SSRF guard bypassed by redirects and DNS rebinding (OWASP A10)

**Severity:** High. **Priority:** P1. **Found:** Phase 9, code review while writing the OWASP tests.
**Observed:** `validators/scanValidators.js` checks only the URL the user typed. `scanController` then calls `axios.get(url, { maxRedirects: 5 })`, which:
1. follows redirects with no further check, so a public page answering `302 Location: http://169.254.169.254/latest/meta-data/` is followed; and
2. resolves the hostname a *second* time when the socket connects, so a hostname can resolve to a public IP for the check and to `127.0.0.1` for the connection (DNS rebinding, a time-of-check vs time-of-use flaw).

After a redirect, the file-exposure check also probes `/.env`, `/.git/config` and similar paths **on the final (internal) origin**, and the TLS check connects to it, so findings about internal services could appear in the report.
**Expected:** in production, no request the scanner makes (first hop, redirect hops, file probes, TLS check) may reach a private, loopback, link-local or otherwise internal address.
**Root cause:** the SSRF control sat at the *input* boundary only. Network-level controls have to apply where the connection is actually made.
**Fix (test-first):** `security/def-009-ssrf.test.js` mocks DNS so no real internal or public host is contacted. It covers rebinding, redirect to `169.254.169.254`, redirect to a name resolving to `10.0.0.5`, the file probes, a public control case, and dev mode. 5 tests were red before the fix.
- New `server/utils/ssrfGuard.js`:
  - `guardedLookup` resolves the host and refuses if *any* address is internal. It is used by the http/https agents for every connection and redirect hop, and by the TLS check.
  - `beforeRedirect` checks literal-IP redirect targets, which skip DNS.
  - Keep-alive is off, so a pooled socket is never reused without a fresh lookup.
- Blocked targets return **400** "The target resolves to a private or internal address." Production only, matching the validator's documented dev bypass.

**Verified:** 35/35 security tests, full Jest suite 259/259, BDD, Postman and Selenium unchanged.

## DEF-010: React client served without security headers (OWASP A05)

**Severity:** Medium. **Priority:** P2. **Found:** Phase 9, ZAP passive scan of the production build: *CSP Header Not Set* (Medium), *Missing Anti-clickjacking Header* (Medium), *X-Content-Type-Options Header Missing* (Low). Confirmed by reviewing `client/vercel.json`, which only had a rewrite rule.
**Root cause:** the API is hardened with helmet, but the frontend is a static site whose headers come from the host's config, and that config had none.
**Fix (test-first):**
- `client/security-headers.json` is the single source of truth. It sets a strict CSP (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self'` plus the API origin), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`.
- `vercel.json` serves the headers in production, and `vite preview` serves the same ones locally.
- `unit/clientSecurityHeaders.test.js` fails if `vercel.json` drifts from the source file. It was red first.

**Verified:**
- ZAP rerun: 0 Medium / 0 Low on the client.
- All 11 Selenium tests pass against the CSP-protected production build, with no CSP violations in the browser console.

**Deployment note:** `productionApiOrigin` is `https://*.onrender.com`. If the API moves to a custom domain, update it there and in `vercel.json`, or the CSP will block API calls.

## OBS-07: Sign-up has no dedicated rate limit (deferred)

`authRoutes.js` has `registerLimiter` commented out, so sign-up is limited only by the general limit (100 requests per 15 min per IP). The JMeter breakpoint test showed sign-up is the most expensive endpoint (bcrypt), so it is the cheapest one to use for CPU exhaustion. **Recommendation:** enable a dedicated limiter (e.g. 10 sign-ups per hour per IP) and verify that `trust proxy` matches the real number of proxy hops in production, because every IP-based limit relies on it. Deferred rather than fixed: the right limit is a product decision, and the test suites would need a test-mode allowance.

## OBS-08: Authentication throughput ceiling (deferred, capacity note)

With 800 users arriving in 10 s, sign-up and login level off at about 32 requests/s each (about 65 bcrypt operations/s). Requests then queue (register p95 12.4 s, login p95 6.1 s) but **never fail**, and reads stay fast (p95 ≤ 14 ms) because bcrypt runs off the event loop. Raising `UV_THREADPOOL_SIZE` from 4 to 8 roughly doubled auth throughput (to about 57–60/s) and cut register p95 to 2.7 s. **Recommendation:** set `UV_THREADPOOL_SIZE` to match the host's cores and scale horizontally for peak sign-up traffic. Not a defect at realistic load: every SLA passed up to 400 users.

## OBS-09: `runScan` complexity (deferred, Phase 11)

SonarQube rule S3776 (Critical, maintainability) flags `server/controllers/scanController.js:53` `runScan` with cognitive complexity **28** (limit 15). ESLint measures V(G) **32**. Phase 4 measured 31 and recommended splitting it. That was not done, and the DEF-009 fix (`5ef122c`) added `if (isBlockedError(...))` to it. The function works and is 98.5 % line-covered, so this is not a failure. **Recommendation:** split it into `fetchTarget()`, `runChecks()` (a table of checks run in one loop with one shared `try/catch`) and `mapFetchError()` (a lookup table from error code to status and message). Each part ends up under 10. The existing 259 Jest tests and 44 BDD scenarios make the refactor safe. Deferred: a refactor is outside QA's remit. Details: [../11-metrics/sonar-metrics.md](../11-metrics/sonar-metrics.md) §3.
