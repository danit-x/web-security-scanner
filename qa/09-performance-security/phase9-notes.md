# Phase 9: Performance testing (JMeter) and security testing (OWASP)

| Area | Tool | Result |
|---|---|---|
| Load / stress / spike | Apache JMeter 5.6.3 (non-GUI, HTML dashboards) | 5 scenarios, 26,057 requests, **0 errors, every SLA met** up to 400 users |
| Breakpoint (capacity) | JMeter, 800 users in 10 s | **Limit found**: auth tops out at about 32/s per endpoint (OBS-08); queues, never fails |
| SCA (vulnerable components, A06) | `npm audit` | **2 critical + 16 high → 0** in production dependencies |
| DAST | OWASP ZAP 2.17 (automation framework) | API: 1,610 attack requests, **0 Low/Medium/High**. Client: 2 Medium + 1 Low → **0** after DEF-010 |
| Scripted OWASP tests | Jest (`qa/05-unit/security`) | 35 tests, A02–A10; found **DEF-009 (High)** |
| Defects | | **DEF-009, DEF-010** fixed; **OBS-03, OBS-04** closed; OBS-07, OBS-08 deferred |

Everything ran against the local stack only (API :5000 / DAST API :5060, client :5173 / :4173, fixture :5070, MongoDB :27099). No load or attack traffic went to Render, Vercel, Atlas or any outside site.

---

## Part A: Performance testing (JMeter)

### Concepts

| Type | Question | Shape used here |
|---|---|---|
| **Load** | Does it meet targets at expected traffic? | 50 users, 30 s ramp, 2 min, plus 10 users scanning |
| **Stress** | Where is the limit? Does it fail gracefully? | 100 → 200 → 400 users, then a **breakpoint** run of 800 users in 10 s |
| **Spike** | Does it survive a sudden burst? | 0 → 150 users in 5 s |
| Soak | Does it degrade over hours (memory leaks)? | not run (would need hours; recommended before a release) |

We measured throughput (requests per second), the error rate, the number of active users, and response-time percentiles (p90, p95 and p99). We set our targets on the 95th percentile rather than the average, because an average hides the slow tail that real users actually notice.

Each virtual user signs up and logs in once (using a Once Only Controller), then keeps looping through profile, history and health requests with a random think time of 2 to 3 seconds between them. The JWT is extracted from the login response with a JSON Extractor and sent with every later request through an HTTP Header Manager, and Response Assertions check every status code.

Because the API rate-limits per client IP, each virtual user also sends its own `X-Forwarded-For` header, set by a small Groovy script. Without that, all 400 users would look like a single machine and quickly get 429 responses. That would be a problem with the test, not a finding about the system.

Our service-level targets, checked automatically by [check-sla.mjs](jmeter/check-sla.mjs), were:

| Request type | p95 target |
|---|---|
| reads | < 500 ms |
| sign-up / login (bcrypt) | < 1,500 ms |
| scan (outbound HTTP) | < 5,000 ms |
| all requests | errors ≤ 1% |

```powershell
powershell -File qa/09-performance-security/jmeter/run-jmeter.ps1 -Scenario all         # load, stress x3, spike
powershell -File qa/09-performance-security/jmeter/run-jmeter.ps1 -Scenario breakpoint  # capacity limit
node qa/09-performance-security/jmeter/check-sla.mjs qa/evidence/jmeter/load/report
```

### Results (p95 in ms; raw results and statistics in [../evidence/jmeter/](../evidence/jmeter/), all SLA tables in [sla-summary.md](../evidence/jmeter/sla-summary.md); rebuild a dashboard with `jmeter -g <scenario>/results.jtl -o <scenario>/report`)

| Scenario | Users | Requests | Throughput | Reads p95 | Login p95 | Register p95 | Scan p95 | Errors | SLA |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Load | 50 + 10 scanning | 2,115 | 18/s | ≤ 17 | 105 | 120 | 36 | 0% | Met |
| Stress 100 | 100 | 2,952 | 34/s | ≤ 15 | 105 | 111 | – | 0% | Met |
| Stress 200 | 200 | 5,872 | 67/s | ≤ 14 | 98 | 99 | – | 0% | Met |
| Stress 400 | 400 | 11,756 | 135/s | ≤ 15 | 93 | 96 | – | 0% | Met |
| Spike | 150 in 5 s | 3,362 | 59/s | ≤ 15 | 194 | 412 | – | 0% | Met |
| Breakpoint | 800 in 10 s | 14,162 | 247/s | ≤ 14 | 6,107 | 12,389 | – | 0% | Not met (auth) |
| Breakpoint, `UV_THREADPOOL_SIZE=8` | 800 in 10 s | 16,544 | 288/s | ≤ 17 | 1,082 | 2,714 | – | 0.13%* | Login met, register not met |

\* All 22 errors were `java.net.BindException: Address already in use`, raised inside JMeter itself. After several back-to-back runs, Windows had run out of client ports on the load-generating machine, so those requests never reached the API. It was a useful reminder to check the load generator before blaming the system under test.

### Analysis

Read requests scaled almost perfectly. The 95th percentile stayed at about 15 ms all the way from 50 to 800 users, while throughput rose from 18 to 247 requests per second. The MongoDB queries are indexed by `userId` and the responses are small, so this is what we expected.

The bottleneck turned out to be password hashing. bcrypt (cost 10) is slow on purpose, and in Node it runs on the libuv thread pool, which has only 4 threads by default. That limits the server to roughly 65 hashes per second on our 16-core test machine. The spike test showed the first signs (register p95 rose from 120 to 412 ms), and the breakpoint test pushed it well past the target.

Importantly, the system degraded gracefully. Beyond the limit, sign-ups and logins queued up and waited several seconds, but none of them failed, and read requests were not affected at all, because bcrypt runs off the main event loop. That is exactly the behaviour a stress test is meant to confirm.

We then tried one tuning change. Setting `UV_THREADPOOL_SIZE=8` roughly doubled authentication throughput and cut the register p95 by a factor of 4.5. That is cheap extra capacity on any multi-core host, so we recorded it as OBS-08, together with a recommendation to scale horizontally for sign-up peaks.

One caveat applies to all of these numbers: JMeter, the API and MongoDB were running on the same laptop. The results are good for comparisons and for finding the bottleneck, but they are not production capacity figures.

---

## Part B: Security testing (OWASP)

### Approach: defence in depth needs testing in depth

| Technique | What it finds | Tool here |
|---|---|---|
| **SCA**: software composition analysis | known CVEs in dependencies (A06) | `npm audit` |
| **DAST**: dynamic testing | what an attacker sees from outside: headers, injection, errors | OWASP ZAP (passive + active) |
| **Scripted security tests** | logic flaws scanners cannot judge: IDOR, tokens, mass assignment, SSRF bypasses | Jest |
| **Code / config review** | design flaws (where a control sits), missing config | manual, guided by the tests |
| SAST: static analysis | insecure code patterns | SonarQube, Phase 11 |

### SCA results ([../evidence/sca/](../evidence/sca/))

| Package set | Before (critical / high / moderate) | After |
|---|---|---|
| server | 2 / 6 / 20 | **0 / 0** / 20 (dev tooling only) |
| client | 0 / 10 / 5 | **0 / 0 / 0** |
| selenium tests | 0 / 0 / 3 | 0 / 0 / 3 (dev tooling only) |

Several of the advisories mattered directly for this app. The axios advisories covered redirect-based SSRF and denial of service, and the scanner uses axios to fetch arbitrary URLs. The proxy-addr advisory concerned IP spoofing, and the app relies on `trust proxy`. There were also SSRF classification bypasses in ip-address and a prototype pollution issue in mongoose.

We accepted the remaining moderate findings as residual risk. All of them sit in test tools (Jest, Cucumber, Mocha and nodemon, through `glob` and `minimatch`), and npm's only suggested fix was a major-version downgrade of those tools. Running `npm audit --omit=dev` reports 0 vulnerabilities in the code that actually ships.

One "safe" upgrade broke 70 of our tests. The patched MongoDB driver (7.8) loads the `os` module with a dynamic `import()`, which Jest's sandbox does not allow. The driver swallowed the error and sent an empty handshake, so MongoDB refused the connection. Production was not affected, and our regression suite caught the problem immediately. We traced it to a single error code, `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`, and fixed it with the driver's own `runtimeAdapters` option in the Jest database helper, which only affects tests. The lesson is that patch releases are still code changes, so the full regression suite should run after every dependency update.

### Scripted OWASP tests: [../05-unit/security/owasp.test.js](../05-unit/security/owasp.test.js) + [def-009-ssrf.test.js](../05-unit/security/def-009-ssrf.test.js)

| OWASP 2021 | Checks | Result |
|---|---|---|
| A01 Broken access control | IDOR on view, note and delete (Jest, BDD and Postman, from earlier phases) | Pass |
| A02 Cryptographic failures | JWT is HS256, expires within 7 days and carries no personal data; bcrypt cost is at least 10 | Pass |
| A03 Injection | NoSQL operators (`$ne`, `$regex`, `$where`) in login and notes return 400; a stored-XSS payload comes back as inert JSON with `nosniff` | Pass |
| A05 Misconfiguration | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy and COOP set; X-Powered-By hidden; 413 for bodies over 100 kB; JSON 404s without stack traces | API passed; the client failed and was fixed as DEF-010 |
| A06 Vulnerable components | npm audit | Failed at first, fixed (see above) |
| A07 Authentication failures | `alg: none` token rejected; a token signed with another secret rejected; brute-force limit (earlier phases); digits-only passwords | Digits-only passwords were accepted; fixed as OBS-04 |
| A08 Data integrity | mass assignment of `_id`, `createdAt` and `role` on register, `grade`, `score` and `userId` on scan, and `userId` on note update: all ignored | Pass |
| A09 Logging and monitoring | cannot be tested by a script; we noted that failed logins and blocked SSRF attempts are not logged as security events | Recommendation |
| A10 SSRF | 10 disguised internal addresses (decimal, hex, octal, `127.1`, `localhost.`, IPv6, `::ffff:`, the metadata IP) return 400; redirects and DNS rebinding | Redirects and rebinding got through; fixed as DEF-009 |

(2025 note: the 2025 Top 10 keeps most of these categories. It moves SSRF under Broken Access Control and adds *Software Supply Chain Failures*, which the SCA work above covers.)

### DEF-009: the most important finding of this phase

The SSRF guard only checked the URL as the user typed it. After that, the scanner followed redirects and looked the hostname up again when it actually connected. That left two ways around the guard. A public page could simply redirect the scanner to `169.254.169.254`, the cloud metadata address where server credentials live. Or a DNS-rebinding domain could resolve to a public IP while the guard checked it, and to `127.0.0.1` a moment later when the scanner connected. Either way, the file-exposure probes (`/.env`, `/.git/config` and so on) would then run against an internal server.

Our fix, in [server/utils/ssrfGuard.js](../../server/utils/ssrfGuard.js), checks the address at the moment the connection is made. A guarded DNS lookup is plugged into the HTTP agents, so it covers every redirect hop and every probe, and it is also used by the TLS check. A `beforeRedirect` hook catches redirects to literal IP addresses. The tests mock DNS, so no real internal or public host is ever contacted, and five of them failed before the fix. The broader lesson is that a control meant to protect the network has to sit at the network layer, not only in input validation.

### ZAP DAST ([../evidence/zap/zap-report.html](../evidence/zap/zap-report.html))

We drove ZAP with an automation plan ([zap/zap-plan.yaml](zap/zap-plan.yaml), run by [zap/run-zap.ps1](zap/run-zap.ps1)). Against the API we ran an active scan, seeding every endpoint with a real logged-in user. The API instance used for this ([qa/scripts/start-dast-api.js](../scripts/start-dast-api.js)) had its rate limiters stubbed, which is normal for a scan, because the limiters have their own tests. We kept `POST /api/scan` to passive checks only, so ZAP could not make our API fetch third-party websites. Against the client we spidered the production build and ran a passive scan.

| Target | Before | After |
|---|---|---|
| Client (production build) | **Medium** CSP not set · **Medium** no anti-clickjacking · **Low** no nosniff | **0 Medium / 0 Low** (DEF-010) |
| API (1,610 attack requests) | informational only | informational only |

Getting a trustworthy result from ZAP took more work than expected, because three separate problems would each have produced a misleadingly "clean" report. First, `zap.bat` failed silently unless it was started from its own folder, so our runner now changes into that folder first. Second, ZAP does not substitute `${ENV}` variables inside request headers, so the Bearer token was being sent as literal text; our runner now fills in the plan itself before starting ZAP. Third, replacer rules from earlier runs had been saved in ZAP's home directory and kept overwriting the Bearer header, so every authenticated request got a 401. Every run now starts from a fresh ZAP home directory.

We tracked these down with an echo server and a logging proxy, which showed exactly what ZAP sent and what the API replied. The seed requests now declare the response code they expect, so a 401 shows up as a warning, and we measured attack coverage from the actual traffic: 638 attacks on register, 448 on login and 226 on note updates. The lesson we took from this is to confirm that a scanner really reached the attack surface before trusting a clean report.

## Defects this phase

| ID | Severity | Summary | Status |
|---|---|---|---|
| DEF-009 | **High** | SSRF via redirects and DNS rebinding | Closed (test-first) |
| DEF-010 | Medium | Client served without security headers | Closed (test-first, ZAP re-verified) |
| OBS-04 | (obs.) P3 | Digits-only passwords accepted | Closed |
| OBS-03 | (obs.) P4 | Grade `E` in schema; unreachable scores | Closed (`E` removed; gaps by design) |
| OBS-07 | (obs.) P3 | No dedicated sign-up rate limit | Deferred: recommendation |
| OBS-08 | (obs.) P4 | Auth throughput ceiling | Deferred: capacity note, tuning shown |

Details and root causes are in the [defect log](../10-defects/defect-log.md). After all the fixes, we ran every suite again:

| Suite | Result |
|---|---|
| node:test | 57/57 |
| Jest | **259/259** (95.0% statement coverage) |
| BDD | 44/44 |
| Postman | 360/360 |
| Selenium | 11/11 (also against the CSP-protected build) |
| Black-box script | 123/123 |
