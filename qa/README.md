# QA: EC4206 Software Testing & QA (Option A)

Testing the Website Security Scanner (MERN) on branch `qa/ec4206-testing`.

| Phase | Topic | Status | Files |
|---|---|---|---|
| 1 | Test plan, ISO 25010, verification vs. validation | ✅ | [01-test-plan/test-plan.md](01-test-plan/test-plan.md) |
| 2 | STLC, environment, test cases, execution | ✅ | [02-stlc/](02-stlc/) |
| 3 | Black-box: EP, BVA, decision table | ✅ | [03-black-box/](03-black-box/) |
| 4 | White-box: cyclomatic complexity, coverage | ⏳ | |
| 5 | Unit tests (Jest) + TDD fixes | ⏳ | |
| 6 | BDD (Cucumber) | ⏳ | |
| 7 | Postman + Selenium | ⏳ | |
| 8 | CI (GitHub Actions) | ⏳ | |
| 9 | JMeter + OWASP | ⏳ | |
| 10 | Defects, RCA, lifecycle | 🟡 log started | [10-defects/defect-log.md](10-defects/defect-log.md) |
| 11 | SonarQube metrics | ⏳ | |
| 12 | Reflection | ⏳ | |

## Run the tests

```powershell
# local MongoDB (never the Atlas DB)
& "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --port 27099 --bind_ip 127.0.0.1 --dbpath qa\.data\db
# 45 automated API test cases
node qa/scripts/run-api-cases.mjs
# 123 black-box cases (EP, BVA, decision tables)
node qa/scripts/run-black-box.mjs
```

`qa/scripts/start-test-api.js` starts the real API with a local DB and a test JWT secret, and refuses to start against a non-local database.
