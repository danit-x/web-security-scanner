# Test Cases

| Item | Value |
|---|---|
| Document ID | QA-TC-02 |
| Base URL (API) | `http://localhost:<port>/api` |
| Base URL (UI) | `http://localhost:5173` |
| Legend | **P** = priority (H/M/L) · **Type** = Pos (positive) / Neg (negative) · **Lvl** = API / UI |

Users A and B are fresh accounts created at the start of each run. Unless a case says otherwise, "token A" is user A's JWT.

## 1. Registration (F1)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-REG-01 | Register with valid data | Email not yet used | POST `/auth/register` | name `QA User A`, email `qa.a.<ts>@example.com`, pwd `Passw0rd1` | 201, `success:true`, a `token`, and `user{_id,name,email,createdAt}` | H | Pos | API |
| TC-REG-02 | Duplicate email rejected | TC-REG-01 done | POST the same email again | same as REG-01 | 400, `User already exists` | H | Neg | API |
| TC-REG-03 | Password with 7 characters rejected | – | POST register | pwd `abcdef1` (7) | 400, `Password must be at least 8 characters long` | H | Neg | API |
| TC-REG-04 | Password with exactly 8 characters accepted | – | POST register | pwd `abcdefg1` (8) | 201 | H | Pos | API |
| TC-REG-05 | Password without a digit rejected | – | POST register | pwd `abcdefgh` | 400, `Password must contain at least one number` | M | Neg | API |
| TC-REG-06 | Invalid email format rejected | – | POST register | email `user@` | 400, `Please provide a valid email address` | M | Neg | API |
| TC-REG-07 | Whitespace-only name rejected | – | POST register | name `"   "` | 400, `Name is required` | M | Neg | API |
| TC-REG-08 | Name of 101 characters rejected | – | POST register | name = 101 × `a` | 400, name length error | L | Neg | API |
| TC-REG-09 | Email is case- and space-insensitive | – | Register `"  QA.Mixed.<ts>@Example.COM "`, then log in with `qa.mixed.<ts>@example.com` | – | Register 201. Login 200. | M | Pos | API |
| TC-REG-10 | Gmail-style address can log in after registering | – | Register `qa.tester.<ts>@gmail.com`, then log in with **exactly the same** address and password | – | Register 201. Login **200**. | H | Pos | API |
| TC-REG-11 | Password hash never returned | – | Inspect the REG-01 response and `GET /auth/me` | – | Neither response contains a `password` field | H | Neg | API |

## 2. Login (F2)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-LOG-01 | Login with valid credentials | User exists | POST `/auth/login` | correct email/pwd | 200, `token`, `user` | H | Pos | API |
| TC-LOG-02 | Wrong password | User exists | POST login | pwd `WrongPass9` | 401, `Invalid email or password` | H | Neg | API |
| TC-LOG-03 | Unknown email gives the same message (no user enumeration) | – | POST login | `nobody.<ts>@example.com` | 401, **identical** message to LOG-02 | H | Neg | API |
| TC-LOG-04 | Missing password | – | POST login | email only | 400, `Password is required` | M | Neg | API |
| TC-LOG-05 | Brute-force limit: 5 attempts allowed, 6th blocked (per IP, 15 min) | Fresh server | Send login requests #5 and #6 | – | #5 → not 429. #6 → **429** `Too many login attempts…` | H | Neg | API |

## 3. Session / authentication middleware (F3)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | Valid token accepted | Token A | GET `/auth/me` | `Authorization: Bearer <A>` | 200, A's profile | H | Pos | API |
| TC-AUTH-02 | No token | – | GET `/auth/me` | no header | 401, `Authorization token is required` | H | Neg | API |
| TC-AUTH-03 | Tampered token | Token A | Change the last character of the signature | – | 401, `Invalid authorization token` | H | Neg | API |
| TC-AUTH-04 | Expired token | – | Token signed with the QA secret, `exp` in the past | – | 401, `Authorization token has expired` | H | Neg | API |
| TC-AUTH-05 | Empty bearer value | – | Header `Bearer ` | – | 401 | M | Neg | API |

## 4. Run scan (F4)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-SCAN-01 | Scan a reachable site | Token A, fixture site running | POST `/scan` | url `http://127.0.0.1:5070/` (`localhost` is rejected, see DEF-004), `ownershipConfirmed:true` | 200. `_id` saved. `grade` ∈ A–F. `score` 0–100. Findings include missing headers. `summary` counts match the findings. | H | Pos | API |
| TC-SCAN-02 | Ownership not confirmed | Token A | POST `/scan` without the flag | url fixture | 400, `You must confirm you own this website…` | H | Neg | API |
| TC-SCAN-03 | URL without protocol | Token A | POST `/scan` | `example.com` | 400, URL format error | M | Neg | API |
| TC-SCAN-04 | Empty URL | Token A | POST `/scan` | `""` | 400, `A URL is required` | M | Neg | API |
| TC-SCAN-05 | Non-HTTP scheme | Token A | POST `/scan` | `ftp://localhost/file` | 400 | M | Neg | API |
| TC-SCAN-06 | Unreachable host handled gracefully | Token A | POST `/scan` | `http://127.0.0.1:5079/` | 502, `Site could not be reached.` The server stays up. | H | Neg | API |
| TC-SCAN-07 | Scan without authentication | – | POST `/scan` without a token | – | 401 | H | Neg | API |
| TC-SCAN-08 | Scan limit: 10 allowed, 11th blocked (per user, 15 min) | Fresh server, new user | Send 11 scan requests | invalid URL (cheap; still counted) | #10 → 400. #11 → **429** `Too many scan requests…` | H | Neg | API |

## 5. History / report (F6, F7)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-HIS-01 | History shows only my scans, newest first | A has 2 scans, B has 1 | GET `/history` as A | – | 200. `count` = 2. Every `userId` = A. Sorted by `createdAt` descending. | H | Pos | API |
| TC-HIS-02 | Open own scan | A's scan id | GET `/history/:id` as A | – | 200, the scan | H | Pos | API |
| TC-HIS-03 | Another user's scan is hidden (IDOR) | B's scan id | GET `/history/:idB` as A | – | **404** `Scan result not found` (not 200, not 403) | H | Neg | API |
| TC-HIS-04 | Malformed id | – | GET `/history/abc` | – | 400, `Invalid scan ID` | M | Neg | API |
| TC-HIS-05 | Valid but non-existent id | – | GET `/history/<random ObjectId>` | – | 404 | M | Neg | API |

## 6. Notes (F8)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-NOTE-01 | Add a note to own scan | A's scan | PATCH `/history/:id` | `{"note":"Fix CSP first"}` | 200. `scan.note` saved and returned by a later GET. | M | Pos | API |
| TC-NOTE-02 | Note of 501 characters rejected | A's scan | PATCH | 501 × `n` | 400, `A note cannot be longer than 500 characters` | M | Neg | API |
| TC-NOTE-03 | Non-string note rejected | A's scan | PATCH | `{"note":123}` | 400, `A note must be text` | L | Neg | API |
| TC-NOTE-04 | Cannot edit another user's note | B's scan | PATCH as A | – | 404, B's note unchanged | H | Neg | API |

## 7. Delete (F9)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-DEL-01 | Delete own scan | A's scan | DELETE `/history/:id`, then GET it | – | 200 `Scan deleted`, then GET → 404 | M | Pos | API |
| TC-DEL-02 | Cannot delete another user's scan | B's scan | DELETE as A, then GET as B | – | 404 for A. B still gets 200. | H | Neg | API |

## 8. API hardening (F10)

| ID | Title | Pre-conditions | Steps | Test data | Expected result | P | Type | Lvl |
|---|---|---|---|---|---|---|---|---|
| TC-API-01 | Health check | Server up | GET `/api/health` | – | 200 `{"status":"ok"}` | H | Pos | API |
| TC-API-02 | Unknown route | – | GET `/api/does-not-exist` | – | 404 JSON `{success:false}` | L | Neg | API |
| TC-API-03 | Security headers present | – | GET `/api/health` | – | `X-Content-Type-Options: nosniff`, `X-Frame-Options` set, **no** `X-Powered-By` | M | Pos | API |
| TC-API-04 | Disallowed CORS origin | – | GET `/api/health` with `Origin: http://evil.example` | – | The request is refused **cleanly**: no `Access-Control-Allow-Origin` header and a 4xx status, with no stack trace in the body | M | Neg | API |
| TC-API-05 | Malformed JSON body | – | POST `/auth/login` with body `{"email":` | `Content-Type: application/json` | **400** JSON error with no stack trace | M | Neg | API |

## 9. User interface (manual, Chromium)

| ID | Title | Pre-conditions | Steps | Expected result | P | Type |
|---|---|---|---|---|---|---|
| TC-UI-01 | Register: passwords don't match | On `/register` | Fill all fields with a different confirm password → Submit | `Passwords do not match.` shown. No network call. | M | Neg |
| TC-UI-02 | Register success redirects | On `/register` | Valid data → Submit | Redirect to `/dashboard`. Navbar shows the user. | H | Pos |
| TC-UI-03 | Login wrong password | Account exists | Log in with a bad password | `Invalid email or password` shown. Stays on `/login`. | H | Neg |
| TC-UI-04 | Protected route guard | Logged out | Open `/history` directly | Redirect to `/login` | H | Neg |
| TC-UI-05 | Scan without the ownership box | Logged in | Enter URL, leave the box unticked → Scan | Permission message shown. No scan is created. | H | Neg |
| TC-UI-06 | Scan shows the report | Logged in, fixture running | Enter the fixture URL, tick the box → Scan | `/report/:id` shows the grade badge, score, severity pills and findings | H | Pos |
| TC-UI-07 | Note persists | On own report | Type a note → Save → reload | The note is still there after the reload | M | Pos |
| TC-UI-08 | Delete asks for confirmation | On `/history` with ≥ 1 scan | Click Delete → Cancel, then Delete → OK | Cancel keeps the row. OK removes it. | M | Pos |
| TC-UI-09 | Logout | Logged in | Click Logout, then open `/dashboard` | Redirect to `/login`. Token removed from localStorage. | H | Pos |
| TC-UI-10 | Mobile layout | – | `/login` at 375 × 812 | No horizontal scroll. Form usable. | L | Pos |

## 10. Requirements traceability matrix (RTM)

| Requirement | Test cases | Count |
|---|---|---|
| F1 Register | REG-01…11, UI-01, UI-02 | 13 |
| F2 Login | LOG-01…05, UI-03 | 6 |
| F3 Session / guard | AUTH-01…05, UI-04, UI-09 | 7 |
| F4 Scan | SCAN-01…08, UI-05, UI-06 | 10 |
| F5 Scoring | SCAN-01 (system level). Detailed BVA in P3, unit tests in P5. | 1 |
| F6/F7 History / report | HIS-01…05 | 5 |
| F8 Note | NOTE-01…04, UI-07 | 5 |
| F9 Delete | DEL-01, DEL-02, UI-08 | 3 |
| F10 Hardening | API-01…05 | 5 |
| F11 About / responsive | UI-10 | 1 |
| **Total distinct cases** | 45 API + 10 UI | **55** |
