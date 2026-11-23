# Black-Box Test Design: EP, BVA and Decision Tables

| Item | Value |
|---|---|
| Document ID | QA-BB-03 |
| Executed by | `node qa/scripts/run-black-box.mjs` (123 cases) |
| Results | [black-box-results.md](black-box-results.md) |

**Black-box testing** derives tests from the **specification only**: the documented rules, the validation messages and the UI behaviour. It never looks at the code paths. The three techniques below are *test design* techniques: they decide **which few inputs** out of millions are worth running.

---

## 1. Equivalence partitioning (EP)

**Idea:** divide the input domain into classes (partitions) the system should treat **the same way**. If one value in a class works, all values in it should work, so **one representative per class** is enough. Always include **invalid** classes, including the wrong *type*, not just the wrong value.

### 1.1 Password (register): rule "required, at least 8 characters, at least one digit"

| Class | Kind | Representative | Expected | Case |
|---|---|---|---|---|
| ≥ 8 characters with a digit | Valid | `Passw0rd1` | 201 | EP-PW-01 |
| ≥ 8 digits only (weak but meets the rule) | Valid | `12345678` | 201 | EP-PW-07 |
| < 8 characters | Invalid | `Pass1` | 400 | EP-PW-02 |
| No digit | Invalid | `Password` | 400 | EP-PW-03 |
| Empty string | Invalid | `""` | 400 | EP-PW-04 |
| Field missing | Invalid | *(omitted)* | 400 | EP-PW-05 |
| Wrong type (number) | Invalid | `12345678` as a JSON number | 400 | EP-PW-06 |

### 1.2 Email (register / login)

| Class | Kind | Representative | Expected | Case |
|---|---|---|---|---|
| Well-formed | Valid | `qa.bb.…@example.com` | 201 | EP-EM-01 |
| Mixed case + padding | Valid | `"  QA.Case@EXAMPLE.com "` | 201, stored lower-case | EP-EM-06 |
| No `@` | Invalid | `qaexample.com` | 400 | EP-EM-02 |
| No domain | Invalid | `user@` | 400 | EP-EM-03 |
| No local part | Invalid | `@example.com` | 400 | EP-EM-04 |
| Empty | Invalid | `""` | 400 | EP-EM-05 |
| Wrong type (object) | Invalid | `{"$gt":""}` | 400 | EP-EM-07 |
| Operator injection on login | Invalid | `{"$ne":null}` for email and password | 400, **never 200** | EP-LG-01 |

### 1.3 Scan URL: rule "http(s) URL; private targets blocked in production; anything allowed in development"

| Class | Kind | Representative | Expected | Case |
|---|---|---|---|---|
| http, reachable | Valid | `http://127.0.0.1:5070/` | 200 | EP-URL-01 |
| https, unreachable | Valid (format) | `https://127.0.0.1:5079/` | 502 | EP-URL-02 |
| Valid with padding | Valid | `"   http://127.0.0.1:5070/   "` | 200 | EP-URL-03 |
| `localhost` hostname (dev) | Valid | `http://localhost:5070/` | 200 | EP-URL-04 |
| No scheme | Invalid | `example.com` | 400 | EP-URL-05 |
| Disallowed scheme (ftp, javascript, file) | Invalid | `ftp://…`, `javascript:alert(1)`, `file:///etc/passwd` | 400 | EP-URL-06/07/08 |
| Empty | Invalid | `""` | 400 | EP-URL-09 |
| Wrong type | Invalid | `12345` | 400 | EP-URL-10 |

### 1.4 Note: rule "required, text, at most 500 characters, trimmed"

| Class | Kind | Representative | Expected | Case |
|---|---|---|---|---|
| Normal text | Valid | `Fix CSP` | 200 | EP-NT-01 |
| Empty (clears the note) | Valid | `""` | 200 | EP-NT-02 |
| Whitespace only | Valid | `"   "` → `""` | 200 | EP-NT-03 |
| HTML / script text | Valid (stored as text) | `<script>alert(1)</script>` | 200, stored verbatim | EP-NT-04 |
| Missing | Invalid | `{}` | 400 | EP-NT-05 |
| Number / null / object | Invalid | `42`, `null`, `{a:1}` | 400 | EP-NT-06/07/08 |

### 1.5 `calculateScore(findings)` input

| Class | Kind | Representative | Expected | Case |
|---|---|---|---|---|
| Known severities | Valid | `[{HIGH}]` | 85 | EP-SC-01 |
| Empty array | Valid | `[]` | 100 | EP-SC-02 |
| Not an array | Invalid | `null` | 100 (documented guard) | EP-SC-03 |
| Unknown / wrong-case severity | Invalid | `UNKNOWN`, `high` | 100 (no deduction, documented) | EP-SC-04/05 |
| Null element | Invalid | `[null]` | 100. The code comment promises "defensive against … a malformed finding". | EP-SC-06 |
| `scoreToGrade(NaN)` | Invalid | `NaN` | F (fallback) | EP-SC-07 |

---

## 2. Boundary value analysis (BVA)

**Idea:** defects cluster at the **edges** of partitions, through off-by-one mistakes and `>` vs `>=`. For each boundary, test the value **just below, on, and just above** it (the 3-value BVA variant).

```
 Password length         7 ✗ | 8 ✓ | 9 ✓
 Name length          0 ✗ | 1 ✓ ... 99 ✓ | 100 ✓ | 101 ✗
 Note length                   499 ✓ | 500 ✓ | 501 ✗
 Grade bands     F  39|40  D  59|60  C  74|75  B  89|90  A  100
 Score floor                 raw -2 → 0 | 0 | 1
 Login limit (per IP)           #4 ✓ | #5 ✓ | #6 ✗ 429
 Scan limit (per user)          #9 ✓ | #10 ✓ | #11 ✗ 429
 General API limit (per IP)    #99 ✓ | #100 ✓ | #101 ✗ 429
 Scan id (ObjectId = 24 hex)    23 ✗ | 24 ✓ | 25 ✗
```

| Boundary | Below | On | Above | Cases |
|---|---|---|---|---|
| Password min = 8 | 7 → 400 | 8 → 201 | 9 → 201 | BVA-PW-01…03 |
| Name 1..100 | 0 → 400 | 1 → 201, 100 → 201 | 101 → 400 | BVA-NM-01…05 (plus 99) |
| Note max = 500 | 499 → 200 | 500 → 200 | 501 → 400. **500 + 1 trailing space → 200** (trimmed before the length check) | BVA-NT-01…04 |
| Grade A ≥ 90 | 89 → B | 90 → A | 100 → A | BVA-GR-01…03 |
| Grade B ≥ 75 | 74 → C | 75 → B | | BVA-GR-04/05 |
| Grade C ≥ 60 | 59 → D | 60 → C | | BVA-GR-06/07 |
| Grade D ≥ 40 | 39 → F | 40 → D | | BVA-GR-08/09 |
| Score range 0–100 (robustness) | −1 → F | 0 → F | 101 → A | BVA-GR-10…12 |
| Score floor 0 (through findings) | raw −2 → 0 | 4×CRITICAL = 0 | 3×CRITICAL + 8×LOW = 1 | BVA-SC-01…03 |
| Grade bands via real findings | 89, 74, 59, 39 | 75, 60, 40 | 91, 76, 61, 41 | BVA-SC-04…14 |
| Login limit = 5 | #4 → 401 | #5 → 401 | #6 → 429 | BVA-RL-01…03 |
| Scan limit = 10 per user | #9 → 400 | #10 → 400 | #11 → 429. Another user → still allowed. | BVA-RL-04…07 |
| General limit = 100 | #99 → 200 | #100 → 200 | #101 → 429 | BVA-RL-08…10 |
| ObjectId length = 24 | 23 → 400 | 24 → 404 (not found) | 25 → 400 | BVA-ID-01…04 |

**Reachability insight (BVA-SC-15):**
- Deductions come only in steps of 25, 15, 8 and 3, so some scores can never occur. An exhaustive search shows **87, 90, 93, 95, 96, 98 and 99** are impossible.
- The exact A boundary (90) therefore **cannot be reached by a real scan**. It can only be tested by calling `scoreToGrade(90)` directly (a unit test).
- This is why BVA must be applied at **every level** where the boundary exists.

---

## 3. Decision tables (DT)

**Idea:** when the output depends on a **combination of conditions**, list every combination (rule) with its expected action, so no combination is missed.
- A full table has 2ⁿ rules.
- **"–" (don't care)** collapses rules where a condition no longer matters, for example once authentication fails, nothing else matters.

### DT-1: Accessing a scan by id (`GET`, `PATCH` and `DELETE /api/history/:id`)

Conditions:
- **C1** Authorization header present
- **C2** Token state
- **C3** Id well-formed
- **C4** Scan exists
- **C5** Scan belongs to the caller

The full table would be 2 × 3 × 2 × 2 × 2 = 48 rules. With don't-cares it collapses to **8**. Each rule is run against all 3 methods, giving **24 executions**.

| Rule | C1 Header | C2 Token | C3 Id format | C4 Exists | C5 Owner | **Action** |
|---|---|---|---|---|---|---|
| R1 | N | – | Y | – | – | 401 `Authorization token is required` |
| R2 | N | – | **N** | – | – | 401. Auth is checked *before* the id, so a bad id doesn't change the answer. |
| R3 | Y | Invalid signature | – | – | – | 401 `Invalid authorization token` |
| R4 | Y | Expired | – | – | – | 401 `Authorization token has expired` |
| R5 | Y | Valid | N | – | – | 400 `Invalid scan ID` |
| R6 | Y | Valid | Y | N | – | 404 `Scan result not found` |
| R7 | Y | Valid | Y | Y | **N** | **404**, identical to R6, so another user's scan id can't be detected (IDOR protection). The owner's data is unchanged. |
| R8 | Y | Valid | Y | Y | Y | 200. DELETE then makes GET return 404. |

### DT-2: Running a scan (`POST /api/scan`)

Conditions:
- **C1** Authenticated
- **C2** URL valid
- **C3** Ownership confirmed
- **C4** Target reachable

The rate-limit condition is covered by BVA-RL-06, which shows the limit is checked even before URL validation.

| Rule | C1 Auth | C2 URL valid | C3 Ownership | C4 Reachable | **Action** |
|---|---|---|---|---|---|
| R1 | N | – | – | – | 401 |
| R2 | Y | N | N | – | 400 **URL** message. Validation runs before the ownership check, so the URL error wins. |
| R3 | Y | N | Y | – | 400 URL message |
| R4 | Y | Y | N | – | 400 `You must confirm you own this website…` |
| R5 | Y | Y | Y | N | 502 `Site could not be reached.` |
| R6 | Y | Y | Y | Y | 200, report saved |

---

## 4. Summary of what the techniques found

| Finding | Technique that found it | Logged as |
|---|---|---|
| Number-typed password crashes registration (500) | EP: wrong-type class | **DEF-005** |
| `calculateScore([null])` throws, despite its documented defensive design | EP: invalid class on a pure function | **DEF-006** |
| `localhost` rejected in dev (confirmed again) | EP: valid class "localhost (dev)" | DEF-004 |
| "Name must be under 100 characters" but 100 is accepted | BVA on the name (on-boundary) | OBS-02 |
| Scores 87/90/93/95/96/98/99 unreachable; the schema allows grade `E`, which the scorer never produces | BVA reachability analysis | OBS-03 |
| `12345678` is accepted as a password (meets the rule, but weak) | EP valid class | OBS-04, input for Phase 9 (OWASP A07) |
