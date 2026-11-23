# Defect Log

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
| OBS-05 | SSRF guard checks that can never fire: the `localhost` entry (blocked earlier by `isURL`) and the IPv6 regexes (the hostname keeps its brackets) | Phase 4 coverage + BP-P4b/BP-X1 | (Observation) | P2 | **Closed** (Phase 5) |
| OBS-01 | Scan button is silently disabled. The ownership message in `handleSubmit` is unreachable (dead code). | TC-UI-05 | (Observation) | P4 | **Closed** (Phase 5) |
| OBS-02 | Name of 100 characters is accepted, but the message says "under 100 characters" | BVA-NM-04/05 | (Observation) | P4 | **Closed** (Phase 5) |
| OBS-03 | Scores 87/90/93/95/96/98/99 can never occur. The schema allows grade `E`, which the scorer never produces. | BVA-SC-15 | (Observation) | P4 | New |
| OBS-04 | Weak passwords such as `12345678` are accepted (no letter required, no breached-password check) | EP-PW-07 | (Observation) | P3 | New |

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

## OBS-04: Weak passwords accepted
`12345678` satisfies the policy (at least 8 characters, at least one digit). It will be revisited under OWASP A07 (Identification and Authentication Failures) in Phase 9.

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
