# Scoring Model — Design & Justification

This document explains the reasoning behind the scan scoring system, so the
logic can be defended in a report or viva rather than just presented as
magic numbers.

## 1. Starting point

Every scan starts at **100 points** — a "perfect" score representing a site
with no detected issues. Points are deducted per finding. This is a simple,
widely-understood model (similar to how tools like Mozilla Observatory or
SSL Labs present scores), which makes results easy to explain to a
non-technical reader: "you lost points because of X."

## 2. Point deductions per severity

| Severity | Deduction | Justification |
|----------|-----------|----------------|
| CRITICAL | -25 | Represents an issue that is directly and immediately exploitable with severe impact (e.g. an expired certificate breaking the site's entire trust model, or a leaked private key). These are rare by design — most checks top out at HIGH — so a heavier penalty is justified when one does occur. |
| HIGH | -15 | Represents a direct, exploitable risk that a real attacker could act on with realistic effort — e.g. a self-signed certificate, a missing CSP, or an exposed `.env` file. Weighted heaviest of the "common" tiers because these are the findings most likely to lead to actual compromise (XSS, credential theft, MITM). |
| MEDIUM | -8 | Represents a real weakness that raises risk or removes a layer of defense, but usually requires an additional condition to be exploitable — e.g. a missing `Secure` cookie flag (only exploitable if traffic is also intercepted), or an outdated library with a known but harder-to-trigger CVE. |
| LOW | -3 | Represents best-practice or defense-in-depth issues — e.g. a missing `Permissions-Policy` header or an exposed `.DS_Store` file. These rarely lead to compromise on their own but indicate general security hygiene gaps worth fixing. |

**Why these specific numbers and not e.g. -20 for High?**
The gap between tiers is intentionally roughly 2x (25 → 15 → 8 → 3), so
severity differences are clearly reflected in the score, but no *single*
finding — other than a genuinely critical one — can single-handedly fail an
otherwise reasonable site. A site with one missing `Referrer-Policy` header
(LOW, -3) shouldn't drop a letter grade; a site with an expired certificate
(CRITICAL, -25) should.

## 3. Minimum score cap

The score is capped at a **minimum of 0** — deductions can't produce a
negative number. A site with many severe findings is already at the worst
grade (F) well before points would go negative; allowing negative numbers
would just be confusing in a report ("-40/100") without adding any
meaningful signal.

## 4. Letter grade thresholds

| Score range | Grade | Meaning |
|-------------|-------|---------|
| 90–100 | A | Strong security posture — no or only very minor (LOW) issues. |
| 75–89 | B | Generally solid, but with a small number of MEDIUM issues or a single HIGH issue. |
| 60–74 | C | Multiple real weaknesses present — several MEDIUM findings, or a couple of HIGH findings. Should be addressed soon. |
| 40–59 | D | Significant security gaps — multiple HIGH findings or a mix including a CRITICAL one. |
| Below 40 | F | Serious, likely exploitable weaknesses present. Needs immediate attention. |

**Why these breakpoints specifically?**
They're set so that the grade boundaries roughly align with "how many
HIGH-severity findings does it take to cross a line":
- One HIGH finding (100 → 85) still lands a B — a single real issue
  shouldn't be catastrophic if everything else is solid.
- Two HIGH findings (100 → 70) lands a C — a pattern is starting to emerge.
- Three-plus HIGH findings, or any CRITICAL finding, reliably pushes into D
  or F territory, which matches the intuition that these represent
  meaningfully worse security postures.

This is a simple, explainable model, not a statistically derived one — that
is an intentional design choice for a project like this: the grading logic
needs to be easy to justify in a demo, not empirically tuned against a large
real-world dataset (which would be a reasonable "future work" extension).