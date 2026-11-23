# QA: EC4206 Software Testing & QA (Option A)

Testing the Website Security Scanner (MERN) on branch `qa/ec4206-testing`.

| Phase | Topic | Status | Files |
|---|---|---|---|
| 1 | Test plan, ISO 25010, verification vs. validation | ✅ | [01-test-plan/test-plan.md](01-test-plan/test-plan.md) |
| 2 | STLC, environment, test cases, execution | ✅ | [02-stlc/](02-stlc/) |
| 3 | Black-box: EP, BVA, decision table | ✅ | [03-black-box/](03-black-box/) |
| 4 | White-box: cyclomatic complexity, coverage | ✅ | [04-white-box/](04-white-box/) |
| 5 | Unit tests (Jest) + TDD fixes | ✅ | [05-unit/tdd-log.md](05-unit/tdd-log.md) |
| 6 | BDD (Cucumber): 44 scenarios, mutation-checked | ✅ | [06-bdd/bdd-notes.md](06-bdd/bdd-notes.md) |
| 7 | Postman (360 assertions) + Selenium (11 UI tests, POM) | ✅ | [07-postman-selenium/phase7-notes.md](07-postman-selenium/phase7-notes.md) |
| 8 | CI (GitHub Actions) | ⏳ | |
| 9 | JMeter + OWASP | ⏳ | |
| 10 | Defects, RCA, lifecycle | 🟡 8 defects closed in P5; OBS-06 closed in P7; RCA pending | [10-defects/defect-log.md](10-defects/defect-log.md) |
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
# 210 Jest unit + API tests, with coverage
npm run test:coverage --prefix server
# 57 node:test tests (original 32 + 25 white-box basis paths)
node --test "server/tests/*.test.js" "qa/04-white-box/tests/*.test.js"
# 44 Cucumber BDD scenarios (HTML report in qa/evidence/bdd/)
npm run test:bdd --prefix server
# Postman API + data-driven runs (needs qa-api on :5000 and the fixture site on :5070)
node qa/scripts/start-fixture-site.js
powershell -File qa/07-postman-selenium/postman/run-postman.ps1
# Selenium UI tests (also needs the client on :5173)
npm install --prefix qa/07-postman-selenium/selenium
npm test --prefix qa/07-postman-selenium/selenium
```

`qa/scripts/start-test-api.js` starts the real API with a local DB and a test JWT secret, and refuses to start against a non-local database.
