# Phase 10 Notes: Defect Management, RCA and Metrics

| File | What it contains |
|---|---|
| [defect-log.md](defect-log.md) | Every defect and observation from Phases 2 to 9: steps to reproduce, expected and actual results, the fix and the retest |
| [rca.md](rca.md) | 5 Whys and fishbone diagrams for DEF-001 and DEF-009, a short root cause analysis for the rest, root cause categories and process improvements |
| [defect-lifecycle.md](defect-lifecycle.md) | The lifecycle state diagram, each defect's real path through the phases, and DEF-001's retest loop |
| [defect-metrics.md](defect-metrics.md) | Defects by severity, phase and technique, DRE, phase containment, fix and retest metrics, defect density and a Pareto chart of root causes |

No application code changed in this phase, so there was no need to re-run the test suites. The evidence comes from the existing defect log, the TDD runs and the git history.

## Main findings

The first thing this phase taught us is that the root cause of a defect is not the same as the line of code that is wrong. For DEF-001 the faulty line was the call to `normalizeEmail()`. The real root cause was that there was no single agreed form for an email address in the system, and that no test had ever registered a user and then logged in with the same address. The change that switched the normalisation on was committed directly as "fix: correct" (`b98b027`), with no test attached.

DEF-009 had a different kind of root cause: the control was in the wrong place. The SSRF guard checked the URL as the user typed it, at the input, but the connection was made later, after redirects and a second DNS lookup. A control has to sit where the risky action actually happens.

Looking across all the defects, one pattern explains both High defects: a rule enforced in one place while the same data is used somewhere else. The same pattern also appears in DEF-008, DEF-010 and OBS-06.

All 10 defects were closed test-first, and none was reopened. DEF-001 was the only one whose retest failed. Its fix uncovered DEF-008, so it went from Fixed to Retest and back to In progress once before it was closed.

The metrics tell a similar story. By severity there were 2 High, 4 Medium and 4 Low defects. By phase, Phase 2 found 4, Phase 3 found 2, Phases 4 and 5 found 1 each, Phases 6 to 8 found none, and Phase 9 found 2. The overall defect removal efficiency (DRE) is 100%, but that is only an upper bound, because we have no data on defects found in production. The developers' original 32 tests caught none of the 10 defects, so their DRE was 0%. Phase 2's leakage was 60%: six of the ten defects were only found after Phase 2, which shows that each new technique found problems the earlier ones could not.

Phases 6 to 8 found nothing new because they reused the same functional view of the system, and they ran in development mode with the SSRF guard switched off. Only the adversarial testing in Phase 9 could see DEF-009 and DEF-010.

## Recommendations for the owner

- Check the live accounts that were registered before the DEF-001 fix. Gmail addresses were stored without dots or `+tags`, so those users can no longer log in with the address they typed. QA does not touch the live database, so this needs the owner.
- Log blocked SSRF attempts and failed logins as security events (OWASP A09).
- Start tracking production defects so that DRE can be measured properly.
