# Phase 11 Notes: SonarQube Static Analysis Metrics

| File | What it contains |
|---|---|
| [sonar-metrics.md](sonar-metrics.md) | The full report: metrics, every issue triaged, coverage and duplication per file, complexity, and a comparison with Phase 4 |
| [sonarcloud-setup.md](sonarcloud-setup.md) | One-off SonarCloud setup (the owner installs the app and adds the `SONAR_TOKEN` secret) |
| [run-sonar-local.sh](run-sonar-local.sh) / [.ps1](run-sonar-local.ps1) | Local SonarQube run in Docker, used for the main figures |
| [fix-lcov-paths.js](fix-lcov-paths.js) | Makes Jest's coverage paths relative to the repository root, and fixes the `User.js` / `user.js` case mismatch |
| [`../../sonar-project.properties`](../../sonar-project.properties) | Analysis scope, coverage report and exclusions |
| [`../evidence/sonar/`](../evidence/sonar/) | API exports for three local runs (Phase 4 baseline, core rules, extended rules), scanner logs, screenshots and the SonarCloud results |

No application code changed in this phase. CI gained a `sonar` job that uploads an analysis to SonarCloud on every push.

## Key numbers (local SonarQube, "Sonar way extended" rules, commit `89787cd`)

| Bugs | Vulnerabilities | Hotspots | Code smells | Debt | Coverage | Duplication | Cyclomatic | Cognitive |
|---|---|---|---|---|---|---|---|---|
| 5 (all false positives) | 0 (A) | 0 | 4 (2 Critical) | 49 min (0.1 %, A) | 93.9 % (line 96.1, branch 89.1) | 2.5 % | 425 | 263 |

## Main findings

Static analysis complements everything we did before. Phases 2 to 9 all ran the code; SonarQube reads it without running it, and measures internal qualities such as maintainability that no functional test can see.

The clearest example is `runScan`. Between Phase 4 and Phase 11 its cyclomatic complexity went from 31 to 32 and its cognitive complexity from 26 to 28, while its line coverage rose from 23.9 % to 98.5 %. Our tests made the function well covered, but not any simpler. The refactor we recommended in Phase 4 was never done, and the DEF-009 fix added one more branch. Complexity is a property of the design, and tests alone do not reduce it, so we logged this as OBS-09 and deferred it as a recommendation.

Re-scanning the Phase 4 code also found a Critical ReDoS vulnerability (rule S5852): a nested quantifier `(\w+)*` in the User model's email regex. It was the same regex involved in DEF-008, and it disappeared when we fixed that defect. A single static scan at the start of the project would have flagged it on day one. Between the two versions, the security rating went from E to A.

We also learned to triage before reporting. The Reliability rating of C came entirely from five "floating promise" bugs, and all five are false positives, because each async function already catches its own errors. Of the nine issues SonarQube raised, four were real, a precision of 44 %.

The rule set has a big influence on the result. The default core profile reported only one code smell and missed the `runScan` complexity problem, while the extended profile reported four. Any SonarQube result should therefore say which profile was used.

Coverage figures also depend on the formula. Jest reports 95.0 % statement and 89.1 % branch coverage, while SonarQube's 93.9 % combines lines and branches: (634 + 270) / (660 + 303).

Static analysis did not find DEF-001, DEF-009 or DEF-010. Those are data-flow and design problems spread across several files, and the Community Build has no taint analysis. Static and dynamic testing catch different kinds of defects, which is why we needed both.

The quality gate result of "Passed" also needs some care. The gate only judges new code, so on a first scan it has very little to judge. It becomes useful once SonarCloud checks every pull request in CI.

## SonarCloud in CI (added 23 November 2026)

When we connected SonarCloud, its first scan quietly analysed the whole repository, because SonarCloud ignores `sonar.sources`. We fixed that with `sonar.exclusions`. On `main`, SonarCloud now reports a passing quality gate and 93.9 % coverage, the same coverage as our local run. It also lists 5 bugs and 3 vulnerabilities. The 5 bugs are the same floating-promise false positives as above. The 3 vulnerabilities come from SonarCloud's taint analysis, which the local Community Build does not have: one NoSQL injection (Blocker) and two log injections. We checked all three and none is exploitable. The "user input" in the NoSQL case is the user ID inside a JWT that the server has already verified with its own secret, and the logged URLs cannot contain line breaks. The full triage is in [sonar-metrics.md §7](sonar-metrics.md).
