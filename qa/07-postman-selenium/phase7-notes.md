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

API testing checks the backend directly over HTTP: the status code, the body, the headers and the response time. It sits in the middle of the test pyramid. It is faster and more stable than driving a browser, but closer to real use than a unit test.

In Postman, a collection is an ordered set of requests grouped into folders, and an environment holds variables such as `{{baseUrl}}`, so the same collection can run against a local, staging or production server. A pre-request script runs before a request, for example to generate test data or set headers, and a test script runs afterwards and makes `pm.test(...)` assertions. We chained requests by saving values from one response (for example `pm.environment.set("aliceToken", ...)`) and reusing them later, which let us test whole workflows: register, get a token, scan, view the history, then delete.

We also used three more advanced features. Collection-level scripts run around every request, so we used them for checks that apply everywhere. Contract testing with `pm.response.to.have.jsonSchema(schema)` checks the shape and types of a whole response rather than a single value. Data-driven testing runs one request once per row of a CSV file, which turned our Phase 3 EP and BVA tables into executable tests. Everything runs headless through the Postman CLI, which is also what CI uses in Phase 8.

### What the main collection checks

| Folder | Requests | Highlights |
|---|---|---|
| 00 Setup | 1 | health check; helmet headers (TC-API-01, TC-API-03); creates per-run emails and client IPs |
| 01 Auth | 10 | register (JSON schema, no password returned), duplicate in any case, BVA 7-char password, DEF-005, login, wrong password vs unknown email give the same message, missing password, malformed JSON (DEF-002) |
| 02 Token | 4 | valid, missing, **tampered** (one signature character flipped) and empty bearer token |
| 03 Scan | 8 | fixture scan (scan JSON schema, summary counts equal findings, the 4 known weaknesses detected), no consent, no protocol, empty, ftp://, unreachable host → 502, no login → 401 |
| 04 History | 14 | only my scans listed; open own / Bob's (IDOR 404) / malformed / unknown; note save and persist; 501-char note (BVA); non-string note; note on and delete of Bob's scan refused, and Bob's scan verified unchanged; delete own, then gone |
| 05 Security | 6 | unknown route; CORS allowed origin echoed; other origin → 403 (DEF-003); **brute force**: one request loops on itself with `pm.execution.setNextRequest` (attempts 1–5 → 401, 6 → 429), then the correct password is also blocked from that IP while another IP can still log in |

On top of these, four checks run on every response at collection level: the response time is under 2 seconds (10 seconds for scans), the content type is JSON, the body contains no stack trace, and the `X-Powered-By` header is hidden. Those account for 4 × 48 = 192 of the 288 assertions.

To make runs repeatable, each run picks random `X-Forwarded-For` client IPs and unique email addresses. The API rate-limits per client IP and trusts one proxy hop, so without this the collection would hit the 15-minute limits after a couple of runs.

### Data-driven run ([register-cases.csv](postman/register-cases.csv))

12 rows: valid; password 8 (on boundary) and 7 (below); no digit; empty; JSON number; invalid email; `+tag` Gmail; `.info` TLD; empty name; name 100 (on boundary) and 101 (above). Each row states the expected status and message, and all 12 matched.

### Files

- [postman/websec-api.postman_collection.json](postman/websec-api.postman_collection.json): import into the Postman app to show the collection visually.
- [postman/websec-register-data-driven.postman_collection.json](postman/websec-register-data-driven.postman_collection.json) and [postman/register-cases.csv](postman/register-cases.csv)
- [postman/local.postman_environment.json](postman/local.postman_environment.json): local URLs only.
- [postman/build-collections.mjs](postman/build-collections.mjs): the collections are generated from this readable source, so rebuild after editing it.
- [postman/run-postman.ps1](postman/run-postman.ps1) writes evidence to [../evidence/postman/](../evidence/postman/) (`api-run.log`, `data-driven-run.log`).

A note on privacy: we ran the CLI with `--no-report-events` and without `postman login`, so no run data is sent to Postman's cloud. The CLI's `--output` reports need a login, so we kept the console logs as evidence instead.

---

## Part B: UI automation with Selenium WebDriver

### Concepts

WebDriver is a W3C standard protocol. Our tests talk to chromedriver, which in turn drives a real Chrome browser, and Selenium Manager (bundled with Selenium) finds the chromedriver that matches the installed Chrome.

For locators we preferred element IDs (`#login-email`, `#scan-url`, `#scan-note`), then visible text or ARIA roles (`//button[.='Save Note']`, `div[role=button]`). We avoided long chains of CSS classes because Tailwind class names change often; adding `data-testid` attributes to the client would make this even more robust. Every wait in the suite is an explicit wait for a condition (`driver.wait(until.elementLocated(...))`). There are no fixed sleeps, which is the main reason the suite is not flaky.

We organised the code with the Page Object Model. The [pages/](selenium/pages/) folder has one class per page (`RegisterPage`, `LoginPage`, `NavBar`, `DashboardPage`, `ReportPage`, `HistoryPage`) that holds its locators and actions, so the tests themselves read like user stories and a UI change only means editing one class. We also followed the rule "arrange through the API, act through the UI". Users and scans are created with direct API calls ([lib/api.js](selenium/lib/api.js)), and only the behaviour being tested goes through the browser. When a test needs a logged-in user, it puts the token into `localStorage`, exactly as the app does. This keeps the tests fast and independent of each other.

The suite runs headless Chrome in CI, and setting `HEADED=1` shows the browser locally. For the mobile test we used real mobile emulation (`setMobileEmulation`, 375×812, pixel ratio 3, touch), because headless Chrome will not shrink a normal window below 500 pixels wide.

### Results (traceability to Phase 2 test cases)

| Test | Checks | Result |
|---|---|---|
| TC-UI-01 | mismatched passwords show "Passwords do not match.", and no `/api/auth/register` request is sent (checked with the Resource Timing API) | Pass |
| TC-UI-02 | registering leads to `/dashboard`, the navbar shows the name and a token is stored | Pass |
| TC-UI-03 | a wrong password shows an error, stays on `/login` and stores no token | Pass |
| TC-UI-04 | opening `/history` while logged out redirects to `/login` | Pass |
| TC-UI-05 | with the ownership box unticked a permission message appears, and the API confirms no scan was saved | Pass |
| TC-UI-06 | a fixture scan opens `/report/:id` with the grade badge and 4 severity pills, and the grade and score match the stored scan | Pass |
| TC-UI-07 | a saved note is still there after reloading the page | Pass |
| TC-UI-08 | on Delete, Cancel keeps the row and OK removes it, checked in both the UI and the API | Pass |
| TC-UI-09 | logout returns to `/login`, clears the token and user, and `/dashboard` is guarded again | Pass |
| TC-UI-10 | at 375×812 the viewport is 375 wide, there is no horizontal scroll, all controls are visible and login works | Pass |
| TC-UI-11 | new test: the register form's minimum password length is 8, the same as the API (OBS-06) | Pass after the fix |

To check stability, we ran the full suite three times in a row and got 33/33 passes with no retries. Each test saves a screenshot in [../evidence/selenium/](../evidence/selenium/), with a `FAIL-` prefix if it fails.

### Problems we hit while automating

The first problem looked like an app bug but was not. `getText()` returned "RITA REGISTER" for a user called "Rita Register". WebDriver returns the text as it is displayed, and the navbar uses CSS `uppercase`, so the test was wrong rather than the app. We fixed it by reading `textContent` instead.

The second was the mobile test. The viewport stayed at 500 pixels in what was meant to be a 375-pixel test, because headless Chrome has a minimum window width. Switching to real mobile emulation solved it.

The third was rate limiting. Every request from the test browser comes from 127.0.0.1, so repeated runs shared one login and API quota and started failing with 429 responses, which is a classic cause of flaky UI tests. We fixed it by sending a random `X-Forwarded-For` header for each browser session through the Chrome DevTools Protocol (`Network.setExtraHTTPHeaders`).

## Defects

| ID | Summary | Found by | Status |
|---|---|---|---|
| OBS-06 | Register form `minLength="6"` vs API minimum of 8: the browser accepts passwords the server always rejects | reading Register.jsx while choosing locators | Closed: TC-UI-11 was written first and failed (`'6' !== '8'`), then `minLength="8"` was set and it passed |

The details and root cause are in the [defect log](../10-defects/defect-log.md#obs-06-register-form-password-minimum-disagrees-with-the-api). The API and UI runs found no other defects, and they confirmed once more that the earlier fixes (DEF-001, DEF-002, DEF-003, DEF-005 and OBS-01) hold at both the API and UI level.
