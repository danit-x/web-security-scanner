# Phase 11 Notes: SonarQube Static Analysis Metrics

| File | What it contains |
|---|---|
| [sonar-metrics.md](sonar-metrics.md) | Full report: metrics, every issue triaged, coverage and duplication per file, complexity, Phase 4 comparison |
| [sonarcloud-setup.md](sonarcloud-setup.md) | One-off SonarCloud setup (owner installs app, adds `SONAR_TOKEN` secret) |
| [run-sonar-local.sh](run-sonar-local.sh) / [.ps1](run-sonar-local.ps1) | Local SonarQube (Docker) run, the fallback used for the numbers |
| [fix-lcov-paths.js](fix-lcov-paths.js) | Makes Jest's lcov paths repo-relative (and fixes `User.js` → `user.js` case) |
| [`../../sonar-project.properties`](../../sonar-project.properties) | Sources, tests, coverage and exclusions |
| [`../evidence/sonar/`](../evidence/sonar/) | API JSON for 3 runs (Phase 4 baseline, core rules, extended rules), scanner logs, screenshots |

No application code was changed in this phase. CI gained a `sonar` job that skips cleanly until the secret exists.

## Key numbers (Sonar way extended, commit `89787cd`)

| Bugs | Vulnerabilities | Hotspots | Code smells | Debt | Coverage | Duplication | Cyclomatic | Cognitive |
|---|---|---|---|---|---|---|---|---|
| 5 (all false positives) | **0** (A) | 0 | 4 (2 Critical) | 49 min (0.1 %, A) | **93.9 %** (line 96.1, branch 89.1) | **2.5 %** | 425 | 263 |

## Key points for the viva

1. **Static vs. dynamic.** Phases 2–9 ran the code. SonarQube reads it without running it, and measures *internal* quality (maintainability) that no functional test can see.
2. **runScan, Phase 4 → Phase 11:** V(G) **31 → 32**, cognitive 26 → 28, coverage **23.9 % → 98.5 %**. Tests made it *well covered* but not *simpler*. The Phase 4 refactor was never done, and the DEF-009 fix added one more branch. Complexity is a design property, and tests don't reduce it. Logged as **OBS-09** (deferred).
3. **Phase 4 code had a Critical ReDoS vulnerability** (S5852, nested quantifier `(\w+)*` in the User email regex). It is the same regex as DEF-008 and was removed by accident when DEF-008 was fixed. One early static scan would have flagged it on day one. Security rating went from **E to A**.
4. **Triage before you report.** Reliability rating **C** comes from 5 "floating promise" bugs that are all false positives (each async function catches its own errors). Of 9 issues, 4 are real: 44 % precision.
5. **The rule set decides the result.** The default *core* profile reports 1 smell and misses the `runScan` complexity issue. *Extended* reports 4. Always name the profile.
6. **Coverage numbers differ by formula.** Jest says 95.0 % statements / 89.1 % branches. Sonar's 93.9 % combines lines and branches: (634 + 270) / (660 + 303).
7. **Static analysis did not find** DEF-001, DEF-009 or DEF-010: they are data-flow and design problems across files. The Community Build has no taint analysis. Static and dynamic testing catch different defects, so we need both.
8. **Quality gate "Passed"** means little on a first scan: the gate judges *new code*. It becomes useful on every PR once SonarCloud runs in CI.
