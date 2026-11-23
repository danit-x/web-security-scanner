# Defect Log

Lifecycle used: **New → Open (triaged) → In progress → Fixed → Retest → Verified → Closed**. A defect can also be Reopened, Rejected or Deferred.

Severity is the impact on the system. Priority is how urgently it must be fixed.

| ID | Title | Found by | Severity | Priority | Status |
|---|---|---|---|---|---|
| DEF-001 | Gmail users with dots or `+tags` in their address cannot log in after registering | TC-REG-10 | **High** | P1 | New |
| DEF-002 | Malformed JSON body returns 500 with a stack trace instead of 400 | TC-API-05 | Medium | P2 | New |
| DEF-003 | Disallowed CORS origin returns 500 with a stack trace | TC-API-04 | Low | P3 | New |
| DEF-004 | `localhost` scan targets are rejected in development, contradicting the documented dev bypass | Run 1 cascade (TC-SCAN-01) | Low | P3 | New |
| OBS-01 | Scan button is silently disabled. The ownership message in `handleSubmit` is unreachable (dead code). | TC-UI-05 | (Observation) | P4 | New |

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
