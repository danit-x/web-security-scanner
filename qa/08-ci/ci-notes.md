# Phase 8: Continuous Integration (GitHub Actions)

**Workflow:** [.github/workflows/qa.yml](../../.github/workflows/qa.yml)
**Runs:** <https://github.com/danit-x/web-security-scanner/actions/workflows/qa.yml>

## 1. Concepts

**Continuous Integration (CI):** every push or pull request is built and tested automatically on a clean machine, so a breaking change is found within minutes of being made, not at the end of the project.

| | Meaning | Here |
|---|---|---|
| Continuous **Integration** | build + test every change automatically | ✅ this phase |
| Continuous **Delivery** | every green build is *ready* to release; a human presses deploy | Vercel/Render deploy `main` (outside QA scope) |
| Continuous **Deployment** | every green build is released automatically | not used |

**Why it matters for quality:**
- **Regression safety:** all ≈ 440 automated checks from phases 2–7 run on every change.
- **Same result every time:** a fresh Ubuntu VM and a fresh MongoDB on every run, so no "works on my machine".
- **Quality gate:** a red pipeline blocks merging to `main` when branch protection requires the check.
- **Shift-left:** problems are caught early, when they are cheapest to fix.
- **Fail fast:** cheap checks run first and expensive ones only if those pass.

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

The counts were read from the job logs, not just the green ticks, to confirm the suites really ran (a job that runs zero tests is also green). In total there were ≈ 1,040 executed checks, including the second Node version.

### Run 2: proving the gate blocks a real bug

A throw-away branch `qa/ci-gate-demo` removed the ownership check from `GET /history/:id`. This is a real IDOR vulnerability, the same as mutant M1 in Phase 6.

[Run 45170168432](https://github.com/danit-x/web-security-scanner/actions/runs/45170168432): **failure**.

| Job | Result |
|---|---|
| Lint + build client | success (the bug is not a lint problem) |
| Unit + API tests (Node 22 and 24) | **failure**: `GET /history/:id another user's scan`, expected 404, received 200 (1 failed, 209 passed) |
| BDD / Postman / Selenium | **skipped**: `needs: unit-api` stopped them (fail fast; no runner time spent on a known-bad build) |

The branch was then deleted. This shows the pipeline acts as a *quality gate*: with branch protection ("require status checks to pass") on `main`, that pull request could not be merged.

## 5. Recommended next step (repository settings, owner only)

Turn on branch protection for `main`: *Settings → Branches → Add rule → Require status checks to pass*, then select the six `QA pipeline` checks. That makes the gate mandatory instead of advisory. It is a repository setting, so it is left to the owner.

## 6. Exam summary

- CI = automatic build + test on every change; CD = always releasable (Delivery) or automatically released (Deployment).
- Pipeline design: **fail fast** (cheap checks first), **parallelise** independent suites, **isolate** with fresh VMs and service containers, **keep evidence** as artifacts.
- The test pyramid shows in the timings: unit ≈ 30 s for 267 tests; UI ≈ 2 min for 11 tests.
- A pipeline only adds value if it can fail, so Run 2 proves it does.
