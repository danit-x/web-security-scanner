# Phase 10 Notes: Defect Management, RCA and Metrics

| File | What it contains |
|---|---|
| [defect-log.md](defect-log.md) | Every defect and observation: steps, expected/actual, fix, retest (Phases 2–9) |
| [rca.md](rca.md) | 5 Whys + fishbone for **DEF-001** and **DEF-009**, short RCA for the rest, root cause categories, process improvements |
| [defect-lifecycle.md](defect-lifecycle.md) | Lifecycle state diagram, each defect's real path through the phases, DEF-001's retest loop |
| [defect-metrics.md](defect-metrics.md) | By severity, by phase, by technique, DRE, phase containment, fix/retest metrics, density, Pareto of root causes |

No code was changed in this phase, so no test suite needed re-running; the evidence is the existing log, TDD runs and git history.

## Key points for the viva

1. **Root cause ≠ the buggy line.** DEF-001's buggy line is `normalizeEmail()`. Its root cause is that the email's canonical form had no single source of truth, and no test ever registered and then logged in. The change that switched it on was a direct commit called *"fix: correct"* (`b98b027`) with no test.
2. **DEF-009's root cause is where the control sat.** The SSRF guard checked the URL as typed, at the input. The connection was made later, after redirects and a second DNS lookup. Controls must sit where the action happens.
3. **One pattern explains both High defects:** *a rule enforced in one place while the data is used in another* (also DEF-008, DEF-010, OBS-06).
4. **Lifecycle:** all 10 defects closed test-first, 0 reopened. DEF-001 is the only one whose retest failed: the fix unmasked DEF-008, so it looped Fixed → Retest → In progress once.
5. **Metrics:**
   - Severity: 2 High, 4 Medium, 4 Low.
   - By phase: P2 found 4, P3 2, P4 1, P5 1, P6–P8 0, P9 2.
   - Overall DRE 100%, but only an upper bound (no production defect data).
   - Developer-test DRE 0%: the original 32 tests caught none of the 10.
   - Phase 2 leakage 60%: each later technique found what earlier ones could not.
6. **Why P6–P8 found nothing new:** they reused the functional view and ran with the SSRF guard switched off (dev mode). Only adversarial testing in P9 could see DEF-009 and DEF-010.

## Recommendations handed to the owner

- Check live accounts registered before the DEF-001 fix: Gmail addresses were stored without dots/`+tags`, so those users can no longer log in with what they typed (QA does not touch the live database).
- Log blocked SSRF attempts and failed logins as security events (A09).
- Start tracking production defects so DRE can be measured properly.
