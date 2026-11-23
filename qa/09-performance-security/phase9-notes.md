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

**Metrics:**
- **Throughput:** requests per second.
- **Percentiles (p90, p95, p99):** the mean hides the slow tail, so SLAs are set on p95.
- **Error rate.**
- **Concurrency:** active users.

**Workload model.** Each virtual user signs up and logs in once (*Once Only Controller*), then loops profile → history → health, with **2–3 s think time** (*Uniform Random Timer*). The JWT is taken from the login response (*JSON Extractor*) and sent in a header (*HTTP Header Manager*). *Response Assertions* check every status code.

**Realistic users and rate limits.** The API rate-limits per client IP, so each virtual user sends its own `X-Forwarded-For` (Groovy *JSR223 PreProcessor*). Without that, all 400 users would look like one machine and hit 429s, which is a test artifact rather than a finding.

**SLAs** (checked automatically by [check-sla.mjs](jmeter/check-sla.mjs)):

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
| Load | 50 + 10 scanning | 2,115 | 18/s | ≤ 17 | 105 | 120 | 36 | 0% | ✅ |
| Stress 100 | 100 | 2,952 | 34/s | ≤ 15 | 105 | 111 | – | 0% | ✅ |
| Stress 200 | 200 | 5,872 | 67/s | ≤ 14 | 98 | 99 | – | 0% | ✅ |
| Stress 400 | 400 | 11,756 | 135/s | ≤ 15 | 93 | 96 | – | 0% | ✅ |
| Spike | 150 in 5 s | 3,362 | 59/s | ≤ 15 | 194 | **412** | – | 0% | ✅ |
| **Breakpoint** | **800 in 10 s** | 14,162 | 247/s | ≤ 14 | **6,107** | **12,389** | – | 0% | ❌ auth |
| Breakpoint, `UV_THREADPOOL_SIZE=8` | 800 in 10 s | 16,544 | 288/s | ≤ 17 | **1,082** | **2,714** | – | 0.13%* | login ✅ / register ❌ |

\* All 22 errors were `java.net.BindException: Address already in use` **inside JMeter**: Windows ran out of ephemeral client ports after back-to-back runs. The API never saw those requests. Lesson: check the load generator before blaming the system under test.

### Analysis

1. **Reads scale linearly and stay flat.** p95 is about 15 ms from 50 to 800 users (throughput 18 → 247 req/s). MongoDB queries are indexed by `userId` and responses are small.
2. **The bottleneck is password hashing.** bcrypt (cost 10) is deliberately slow and runs on Node's libuv thread pool (**4 threads by default**). That gives a ceiling of about 65 hashes/s on this 16-core machine. The spike shows the first sign (register p95 120 → 412 ms) and the breakpoint pushes it past the SLA.
3. **Graceful degradation.** Past the limit, requests *queue* (multi-second waits) but **none fail**, and reads are unaffected, because bcrypt runs off the event loop. That's the behaviour a stress test should confirm.
4. **Tuning experiment.** `UV_THREADPOOL_SIZE=8` roughly **doubled** auth throughput and cut register p95 by 4.5×. This is cheap capacity on multi-core hosts. Recorded as **OBS-08** with that recommendation, plus horizontal scaling for sign-up peaks.

Caveat: JMeter, the API and MongoDB shared one laptop, so the numbers are relative (comparisons and the location of the bottleneck), not production capacity figures.

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

- **Relevant to this app:**
  - *axios*: redirect-based SSRF and DoS advisories, and the scanner fetches arbitrary URLs with it.
  - *proxy-addr*: IP spoofing; the app uses `trust proxy`.
  - *ip-address*: SSRF classification bypasses.
  - *mongoose*: prototype pollution.
- **Residual risk accepted:** the 23 remaining moderate findings are all in test tools (Jest, Cucumber, Mocha, nodemon → `glob`/`minimatch`). npm's only "fix" is a major-version *downgrade* of those tools. `npm audit --omit=dev` = **0 vulnerabilities**.
- **A "safe" upgrade broke 70 tests.** The patched MongoDB driver (7.8) loads `os` with a dynamic `import()`, which Jest's sandbox rejects. The driver swallowed the error and sent an empty handshake, so MongoDB refused it. Production was unaffected. The regression suite caught it, and the root cause was traced to a one-line `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG`. Fixed with the driver's own `runtimeAdapters` option in the Jest DB helper (test-only). **Lesson: patch releases are code changes; run the full regression suite after every dependency update.**

### Scripted OWASP tests: [../05-unit/security/owasp.test.js](../05-unit/security/owasp.test.js) + [def-009-ssrf.test.js](../05-unit/security/def-009-ssrf.test.js)

| OWASP 2021 | Checks | Result |
|---|---|---|
| A01 Broken access control | IDOR view / note / delete (Jest, BDD, Postman, from earlier phases) | ✅ |
| A02 Cryptographic failures | JWT is HS256, expiry ≤ 7 days, no personal data in the token; bcrypt cost ≥ 10 | ✅ |
| A03 Injection | NoSQL operators (`$ne`, `$regex`, `$where`) in login and note → 400; stored-XSS payload returned as inert JSON with `nosniff` | ✅ |
| A05 Misconfiguration | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, COOP; no X-Powered-By; 413 for > 100 kB bodies; JSON 404s without stack traces | ✅ API · client ❌ → **DEF-010** fixed |
| A06 Vulnerable components | npm audit | ❌ → fixed (above) |
| A07 Authentication failures | `alg: none` token rejected; token signed with another secret rejected; brute-force limit (earlier phases); **digits-only passwords** | ❌ → **OBS-04** fixed |
| A08 Data integrity | mass assignment: `_id`/`createdAt`/`role` on register, `grade`/`score`/`userId` on scan, `userId` on note update → all ignored | ✅ |
| A09 Logging & monitoring | not testable by script; gap noted: failed logins and blocked SSRF attempts are not logged as security events | recommendation |
| A10 SSRF | 10 obfuscated internal addresses (decimal, hex, octal, `127.1`, `localhost.`, IPv6, `::ffff:`, metadata IP) → 400 · **redirects and DNS rebinding** | ❌ → **DEF-009** fixed |

(2025 note: the 2025 Top 10 keeps most of these categories. It moves SSRF under Broken Access Control and adds *Software Supply Chain Failures*, which the SCA work above covers.)

### DEF-009: the most important finding of this phase

The SSRF guard validated **only the URL as typed**. The scanner then followed redirects and **looked up the hostname again when connecting**. So a public page could redirect the scanner to `169.254.169.254` (cloud credentials), or a DNS-rebinding domain could resolve to a public IP for the check and to `127.0.0.1` for the connection. The file-exposure probes (`/.env`, `/.git/config`…) would then run against that internal origin.

- **Fix:** [server/utils/ssrfGuard.js](../../server/utils/ssrfGuard.js) re-checks the address **where the connection is made**:
  - a guarded DNS lookup in the HTTP agents, covering every hop and every probe, and in the TLS check;
  - a `beforeRedirect` hook for literal-IP redirects.
- **Testing:** the tests mock DNS, so no real internal or public host is contacted. Five tests were red before the fix.
- **Lesson:** controls that protect the network belong at the network layer, not only at input validation.

### ZAP DAST ([../evidence/zap/zap-report.html](../evidence/zap/zap-report.html))

The automation plan ([zap/zap-plan.yaml](zap/zap-plan.yaml), run by [zap/run-zap.ps1](zap/run-zap.ps1)):
- **API (active scan):** every endpoint is seeded with a real logged-in user. The DAST instance ([qa/scripts/start-dast-api.js](../scripts/start-dast-api.js)) has the rate limiters stubbed, as is standard for scans; the limiters are tested separately. `POST /api/scan` is passive-only, so ZAP can't make the API fetch third-party sites.
- **Client (passive scan):** spider plus passive scan of the production build.

| Target | Before | After |
|---|---|---|
| Client (production build) | **Medium** CSP not set · **Medium** no anti-clickjacking · **Low** no nosniff | **0 Medium / 0 Low** (DEF-010) |
| API (1,610 attack requests) | informational only | informational only |

**Making the scanner trustworthy.** Three problems would each have produced a misleading "clean" report:
1. `zap.bat` failed silently when not started from its own folder. → The runner `cd`s into it.
2. ZAP doesn't substitute `${ENV}` variables **inside request headers**, so the Bearer token was sent as literal text. → The runner renders the plan itself.
3. Replacer rules from earlier runs were **saved in ZAP's home directory** and kept overwriting the Bearer header, so every authenticated request got 401. → Every run starts from a fresh ZAP home.

These were diagnosed with an echo server and a logging proxy, which showed exactly what ZAP sent and what the API answered. Seeds now declare `responseCode`, so a 401 shows up as a warning, and attack coverage was measured at the traffic level: 638 register, 448 login and 226 note-update attacks. **Lesson: verify the scanner actually reached the attack surface before trusting a clean report.**

## Defects this phase

| ID | Severity | Summary | Status |
|---|---|---|---|
| DEF-009 | **High** | SSRF via redirects and DNS rebinding | Closed (test-first) |
| DEF-010 | Medium | Client served without security headers | Closed (test-first, ZAP re-verified) |
| OBS-04 | (obs.) P3 | Digits-only passwords accepted | Closed |
| OBS-03 | (obs.) P4 | Grade `E` in schema; unreachable scores | Closed (`E` removed; gaps by design) |
| OBS-07 | (obs.) P3 | No dedicated sign-up rate limit | Deferred: recommendation |
| OBS-08 | (obs.) P4 | Auth throughput ceiling | Deferred: capacity note, tuning shown |

Details and root causes: [../10-defects/defect-log.md](../10-defects/defect-log.md).

**Regression after all fixes:**

| Suite | Result |
|---|---|
| node:test | 57/57 |
| Jest | **259/259** (95.0% statement coverage) |
| BDD | 44/44 |
| Postman | 360/360 |
| Selenium | 11/11 (also against the CSP-protected build) |
| Black-box script | 123/123 |
