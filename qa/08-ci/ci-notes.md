# Phase 8: Continuous Integration (GitHub Actions)

The pipeline is defined in [.github/workflows/qa.yml](../../.github/workflows/qa.yml), and every run can be seen at <https://github.com/danit-x/web-security-scanner/actions/workflows/qa.yml>.

## 1. Concepts

With continuous integration (CI), every push and pull request is built and tested automatically on a clean machine. A change that breaks something is found within minutes of being pushed, rather than at the end of the project.

| | Meaning | In this project |
|---|---|---|
| Continuous Integration | build and test every change automatically | This phase |
| Continuous Delivery | every green build is ready to release, but a person decides when to deploy | Vercel and Render deploy `main` |
| Continuous Deployment | every green build is released automatically | Not used |

CI matters for quality for several reasons. All of the roughly 440 automated checks from Phases 2 to 7 now run on every change, so regressions are caught straight away. Each run starts from a fresh Ubuntu machine and a fresh MongoDB, so results do not depend on anyone's laptop. A red pipeline can block a merge into `main` once branch protection is switched on, which turns the tests into a real quality gate. Problems are found early, when they are cheapest to fix, and the cheap checks run first, so a broken build fails within a minute instead of wasting time on the slow suites.

### GitHub Actions vocabulary (as used in qa.yml)

| Term | In this workflow |
|---|---|
| **Trigger** (`on:`) | `push` to `main` / `qa/**`, `pull_request` to `main`, `workflow_dispatch` (manual "Run workflow" button) |
| **Job** | 5 jobs, each on a fresh `ubuntu-latest` VM |
| **`needs:`** | job order: `lint-build` → `unit-api` → (`bdd`, `postman`, `selenium` in parallel) |
| **Step** | `run:` shell commands, or `uses:` reusable actions (`actions/checkout`, `setup-node`, `upload-artifact`) |
| **Service container** | `mongo:8` next to each job that needs a database, with a health check so tests wait until it is ready |
| **Matrix** | `unit-api` runs on Node **22 and 24** (`fail-fast: false`, so both results are always shown) |
| **Cache** | `setup-node` caches npm downloads, keyed on each `package-lock.json` |
| **Artifacts** | coverage, Cucumber report, Postman logs, Selenium screenshots and server logs, downloadable from each run |
| **Concurrency** | a newer push cancels the older run on the same branch |
| **Permissions** | `contents: read`, the least privilege the workflow needs |
| **Secrets** | none needed: every key and password is a throw-away test value. Real ones would go in *Settings → Secrets* and be read as `${{ secrets.NAME }}`, never written in the YAML |

## 2. The pipeline

```
push / PR
   │
   ▼
┌──────────────────────┐
│ lint-build           │  ESLint + vite build (client)                     fail fast, ~1 min
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ unit-api  [22] [24]  │  node:test 57 + Jest 210 with COVERAGE GATE        mongo:8 service
└──────────┬───────────┘
     ┌─────┼──────────────┐
     ▼     ▼              ▼
┌───────┐ ┌────────────┐ ┌────────────────────────┐
│ bdd   │ │ postman    │ │ selenium               │
│ 44 sc.│ │ 360 assert.│ │ 11 UI tests, headless  │
└───────┘ └────────────┘ └────────────────────────┘
```

| Job | What runs | Gate |
|---|---|---|
| lint-build | `npm run lint`, `npm run build` (client) | any ESLint error or build failure |
| unit-api (×2) | node:test (32 original + 25 white-box basis paths), Jest (210) with coverage | any failing test, **or coverage below 90 % statements / 85 % branches / 90 % functions / 90 % lines** (`coverageThreshold` in `server/jest.config.js`) |
| bdd | Cucumber, 44 scenarios, strict mode | any failing or undefined step |
| postman | API + fixture site started in the background; Postman CLI runs both collections | any failed assertion (Postman exits non-zero) |
| selenium | API, client (Vite) and fixture site started; Mocha + Selenium in headless Chrome | any failing UI test |

The servers are started with `nohup … &`, and [qa/scripts/wait-for.sh](../scripts/wait-for.sh) polls each URL until it answers. There is no fixed `sleep`, for the same reason the Selenium tests use explicit waits.

## 3. Making local tests CI-ready (portability)

| Issue | Handling |
|---|---|
| The DB address differs (local 27099, CI 27017) | tests read `TEST_MONGO_URI` / `QA_MONGO_URI`; local default unchanged; the safety check still refuses anything non-local |
| Windows vs Linux file-name case | every relative `require` was checked against the git index (Linux is case-sensitive); all match |
| Rate limits per client IP | already randomised per run (X-Forwarded-For) in Postman and Selenium (Phase 7) |
| Chrome / chromedriver | Chrome is preinstalled on GitHub runners; Selenium Manager fetches the matching driver |
| Postman CLI | `npm install --global postman-cli`; `--no-report-events` and no login |
| Node versions | `node --test` with glob patterns needs Node ≥ 21, so the matrix is 22 and 24 (Node 20 reached end-of-life in April 2026) |

## 4. Results

### Run 1: the QA branch (green on the first attempt)

[Run 45169597283](https://github.com/danit-x/web-security-scanner/actions/runs/45169597283), commit `4282ffa`, **success**, 3 min 0 s end to end.

| Job | Duration | Executed in CI |
|---|---|---|
| Lint + build client | 19 s | ESLint clean, Vite build OK |
| Unit + API tests (Node 22) | 32 s | node:test **57/57**, Jest **210/210**, coverage 95.55 % statements (gate 90 %) |
| Unit + API tests (Node 24) | 34 s | node:test **57/57**, Jest **210/210**, coverage 95.55 % statements |
| BDD (Cucumber) | 37 s | **44/44** scenarios, 202/202 steps |
| API collection (Postman CLI) | 45 s | **288/288** + **72/72** assertions |
| UI tests (Selenium) | 1 min 57 s | **11/11** in headless Chrome |

We read the counts from the job logs rather than trusting the green ticks, because a job that runs zero tests also shows green. Counting both Node versions, the run executed about 1,040 checks.

### Run 2: proving the gate blocks a real bug

A throw-away branch `qa/ci-gate-demo` removed the ownership check from `GET /history/:id`. This is a real IDOR vulnerability, the same as mutant M1 in Phase 6.

[Run 45170168432](https://github.com/danit-x/web-security-scanner/actions/runs/45170168432): **failure**.

| Job | Result |
|---|---|
| Lint + build client | success (the bug is not a lint problem) |
| Unit + API tests (Node 22 and 24) | **failure**: `GET /history/:id another user's scan`, expected 404, received 200 (1 failed, 209 passed) |
| BDD / Postman / Selenium | **skipped**: `needs: unit-api` stopped them (fail fast; no runner time spent on a known-bad build) |

We deleted the branch afterwards. The run shows that the pipeline really works as a quality gate: with branch protection ("require status checks to pass") on `main`, that pull request could not have been merged.

### Run 3: the final pipeline on `main`

After the QA branch was merged and SonarCloud was connected, the pipeline grew to seven jobs: the original five, with `unit-api` counted once per Node version, plus a SonarCloud static-analysis job. [Run 45411465382](https://github.com/danit-x/web-security-scanner/actions/runs/45411465382) on `main` (commit `7b03a3f`, 24 November 2026) passed every job in 2 minutes 26 seconds:

| Job | Result read from the log |
|---|---|
| Lint + build client | ESLint clean, Vite build of 98 modules |
| Unit + API tests (Node 22 and 24) | node:test 57/57; Jest 259/259 in 13 suites; coverage 95.02 % statements, 89.1 % branches |
| BDD (Cucumber) | 44/44 scenarios, 202/202 steps |
| API collection (Postman CLI) | 288/288 and 72/72 assertions, 0 failures |
| UI tests (Selenium) | 11 passing |
| Static analysis (SonarCloud) | analysis uploaded, quality gate passed |

Screenshots of this run are in [../evidence/ci/](../evidence/ci/): the run summary with all seven jobs green, the run history, and one page per job showing each step's result.

## 5. Recommended next step (repository settings, owner only)

We recommend turning on branch protection for `main` (*Settings → Branches → Add rule → Require status checks to pass*) and selecting the `QA pipeline` checks. That makes the gate compulsory rather than advisory. It is a repository setting, so we left the decision to the owner.

## 6. Summary

CI means every change is built and tested automatically. Continuous delivery means the software is always ready to release, and continuous deployment means it is released automatically. When designing the pipeline we tried to fail fast by running cheap checks first, to run independent suites in parallel, to isolate every run with fresh machines and service containers, and to keep the evidence of every run as downloadable artifacts. The test pyramid shows up clearly in the timings: about 30 seconds for 267 unit-level tests, but about 2 minutes for 11 UI tests. Finally, a pipeline only adds value if it can fail, and Run 2 showed that ours does.
