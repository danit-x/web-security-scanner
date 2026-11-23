# Phase 7: API testing (Postman) and UI automation (Selenium)

| Suite | Tool | Size | Result |
|---|---|---|---|
| API collection | Postman CLI 1.69 | 43 requests (48 executions), 288 assertions | **288 / 288 pass** |
| Data-driven registration | Postman CLI + CSV | 12 rows, 72 assertions | **72 / 72 pass** |
| UI end-to-end | Selenium WebDriver 4.51 + Mocha, headless Chrome | 11 tests (TC-UI-01..11) | **11 / 11 pass, 3 runs in a row** |

Everything runs against the local QA stack: `qa-db` (MongoDB 127.0.0.1:27099), `qa-api` (:5000), `qa-client` (:5173) and `qa-fixture` (the deliberately weak scan target on 127.0.0.1:5070). Atlas and real websites are never touched.

```powershell
# start the stack (Claude preview names) or the commands in qa/README.md, then:
powershell -File qa/07-postman-selenium/postman/run-postman.ps1     # both Postman runs
npm install --prefix qa/07-postman-selenium/selenium                 # first time only
npm test --prefix qa/07-postman-selenium/selenium                    # Selenium, headless
$env:HEADED=1; npm test --prefix qa/07-postman-selenium/selenium     # watch the browser
```

---

## Part A: API testing with Postman

### Concepts

- **API testing** checks the backend contract directly over HTTP: status, body, headers and timing. It is faster and more stable than UI tests, and closer to real use than unit tests (the middle of the test pyramid).
- **Collection:** an ordered set of requests in folders. **Environment:** variables such as `{{baseUrl}}`, so the same collection can run against local, staging or production.
- **Pre-request script:** runs before a request (generate data, set headers). **Test script:** runs after it, with `pm.test(...)` assertions.
- **Chaining:** a response value is saved (`pm.environment.set("aliceToken", ...)`) and reused by later requests, so whole workflows are tested: register → token → scan → history → delete.
- **Collection-level scripts** run around every request. They are used here for checks that apply everywhere (non-functional and contract checks).
- **Contract testing:** `pm.response.to.have.jsonSchema(schema)` checks the response shape and types, not just one value.
- **Data-driven testing:** one request plus a CSV file gives one iteration per row. The Phase 3 EP/BVA tables become executable.
- **Postman CLI:** headless runner for terminals and CI (Phase 8).

### What the main collection checks

| Folder | Requests | Highlights |
|---|---|---|
| 00 Setup | 1 | health check; helmet headers (TC-API-01, TC-API-03); creates per-run emails and client IPs |
| 01 Auth | 10 | register (JSON schema, no password returned), duplicate in any case, BVA 7-char password, DEF-005, login, wrong password vs unknown email give the same message, missing password, malformed JSON (DEF-002) |
| 02 Token | 4 | valid, missing, **tampered** (one signature character flipped) and empty bearer token |
| 03 Scan | 8 | fixture scan (scan JSON schema, summary counts equal findings, the 4 known weaknesses detected), no consent, no protocol, empty, ftp://, unreachable host → 502, no login → 401 |
| 04 History | 14 | only my scans listed; open own / Bob's (IDOR 404) / malformed / unknown; note save and persist; 501-char note (BVA); non-string note; note on and delete of Bob's scan refused, and Bob's scan verified unchanged; delete own, then gone |
| 05 Security | 6 | unknown route; CORS allowed origin echoed; other origin → 403 (DEF-003); **brute force**: one request loops on itself with `pm.execution.setNextRequest` (attempts 1–5 → 401, 6 → 429), then the correct password is also blocked from that IP while another IP can still log in |

**Checks on every response** (collection level): response time under 2 s (10 s for scans), JSON content type, no stack trace in the body, `X-Powered-By` hidden. That is 4 × 48 = 192 of the 288 assertions.

**Repeatable runs.** The API rate-limits per client IP and trusts one proxy hop. Each run therefore picks random `X-Forwarded-For` IPs and unique emails, so the collection can run any number of times without hitting the 15-minute limits.

### Data-driven run ([register-cases.csv](postman/register-cases.csv))

12 rows: valid; password 8 (on boundary) and 7 (below); no digit; empty; JSON number; invalid email; `+tag` Gmail; `.info` TLD; empty name; name 100 (on boundary) and 101 (above). Each row states the expected status and message, and all 12 matched.

### Files

- [postman/websec-api.postman_collection.json](postman/websec-api.postman_collection.json): import into the Postman app to show the collection visually.
- [postman/websec-register-data-driven.postman_collection.json](postman/websec-register-data-driven.postman_collection.json) and [postman/register-cases.csv](postman/register-cases.csv)
- [postman/local.postman_environment.json](postman/local.postman_environment.json): local URLs only.
- [postman/build-collections.mjs](postman/build-collections.mjs): the collections are generated from this readable source, so rebuild after editing it.
- [postman/run-postman.ps1](postman/run-postman.ps1) writes evidence to [../evidence/postman/](../evidence/postman/) (`api-run.log`, `data-driven-run.log`).

**Privacy note:** runs use `--no-report-events` and need no `postman login`, so no run data is sent to Postman's cloud. (`--output` YAML reports require a login, so they are not used.)

---

## Part B: UI automation with Selenium WebDriver

### Concepts

- **WebDriver** is a W3C protocol. The test talks to **chromedriver**, which drives real Chrome. **Selenium Manager** (bundled) finds or downloads the chromedriver that matches the installed Chrome.
- **Locators**, in order of preference here: element `id` (`#login-email`, `#scan-url`, `#scan-note`), then visible text or roles (`//button[.='Save Note']`, `div[role=button]`). Long CSS-class chains are avoided because Tailwind classes change often. *Recommendation:* add `data-testid` attributes to the client.
- **Explicit waits** (`driver.wait(until.elementLocated(...))`) wait for a condition. The suite has no fixed sleeps, which is the main defence against flaky tests.
- **Page Object Model:** [pages/](selenium/pages/) has one class per page (`RegisterPage`, `LoginPage`, `NavBar`, `DashboardPage`, `ReportPage`, `HistoryPage`) holding locators and actions. Tests read like user stories, and a UI change means editing one class.
- **Arrange through the API, act through the UI:** users and scans are created with API calls ([lib/api.js](selenium/lib/api.js)), and only the behaviour under test goes through the browser. Tests stay fast and independent. Logging in for non-login tests puts the token into `localStorage`, exactly as the app does.
- **Headless** Chrome for CI; `HEADED=1` to watch.
- **Mobile emulation** (`setMobileEmulation`, 375×812, pixel ratio 3, touch). A plain small window is not enough, because headless Chrome will not go narrower than 500px.

### Results (traceability to Phase 2 test cases)

| Test | Checks | Result |
|---|---|---|
| TC-UI-01 | mismatched passwords → "Passwords do not match.", and **no** `/api/auth/register` request (Resource Timing API) | ✅ |
| TC-UI-02 | register → `/dashboard`, navbar shows the name, token stored | ✅ |
| TC-UI-03 | wrong password → error shown, stays on `/login`, no token | ✅ |
| TC-UI-04 | logged-out `/history` → `/login` | ✅ |
| TC-UI-05 | ownership box unticked → permission message, and the API confirms 0 scans saved | ✅ |
| TC-UI-06 | fixture scan → `/report/:id`, grade badge and 4 severity pills; grade and score **match the stored scan** | ✅ |
| TC-UI-07 | note saved, page reloaded, note still there | ✅ |
| TC-UI-08 | Delete → confirm() → Cancel keeps the row (UI + API); OK removes it (UI + API) | ✅ |
| TC-UI-09 | logout → `/login`, token and user cleared, `/dashboard` guarded again | ✅ |
| TC-UI-10 | 375×812: viewport is 375, no horizontal scroll, all controls on screen, login works | ✅ |
| TC-UI-11 | **new**: register form minimum password length is 8, the same as the API (OBS-06) | ✅ after fix |

Stability: the full suite passed **3 consecutive runs (33/33)** with no retries. Evidence: one screenshot per test in [../evidence/selenium/](../evidence/selenium/) (a `FAIL-` prefix marks failures).

### Problems met while automating (good exam examples)

1. **`getText()` returned "RITA REGISTER"** for "Rita Register". WebDriver returns *rendered* text, and the navbar uses CSS `uppercase`. This is a test bug, not an app bug. Fixed by reading `textContent`.
2. **Viewport stayed 500px** in the 375px test, because headless Chrome has a minimum window width. Fixed with real mobile emulation.
3. **Rate limits during UI runs.** Every browser request comes from 127.0.0.1, so repeated runs would share one login and API quota and start failing with 429 (a classic cause of flaky tests). Fixed by adding a random `X-Forwarded-For` per browser session through the Chrome DevTools Protocol (`Network.setExtraHTTPHeaders`).

## Defects

| ID | Summary | Found by | Status |
|---|---|---|---|
| OBS-06 | Register form `minLength="6"` vs API minimum of 8: the browser accepts passwords the server always rejects | reading Register.jsx for locators | **Closed**: TC-UI-11 written first (red: `'6' !== '8'`), `minLength="8"` set, green |

Details and root cause are in [../10-defects/defect-log.md](../10-defects/defect-log.md#obs-06-register-form-password-minimum-disagrees-with-the-api). The API and UI runs found no other defects. All earlier fixes (DEF-001/002/003/005, OBS-01) are confirmed again at the API and UI levels.
