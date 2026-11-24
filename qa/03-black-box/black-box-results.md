# Black-Box Execution Results (Phase 3)

Run: 2026-11-23T11:09:40.543Z · Node v25.6.0 · local MongoDB · runner `qa/scripts/run-black-box.mjs`
Raw evidence: `qa/evidence/black-box-2026-11-23T11-09-40-512Z.json` and the matching `.server.log`. Test design: [black-box-design.md](black-box-design.md)

All 123 black-box cases passed on the final build: 40 equivalence partitioning cases, 53 boundary value cases and 30 decision-table cases. The tables below list each case with its input, the expected and actual results, and the outcome.

| Technique | Cases | Pass | Fail |
|---|---|---|---|
| Equivalence partitioning | 40 | 40 | 0 |
| Boundary value analysis | 53 | 53 | 0 |
| Decision tables | 30 | 30 | 0 |

## Equivalence partitioning

### calculateScore input classes

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| EP-SC-01 | [{HIGH}] | 85 | 85 | **PASS** |
| EP-SC-02 | [] | 100 | 100 | **PASS** |
| EP-SC-03 | null | 100 | 100 | **PASS** |
| EP-SC-04 | [{UNKNOWN}] | 100 | 100 | **PASS** |
| EP-SC-05 | [{high}] | 100 | 100 | **PASS** |
| EP-SC-06 | [null] | 100 | 100 | **PASS** |
| EP-SC-07 | NaN | F | F | **PASS** |

### Password

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| EP-PW-01 | valid: 9 chars + digit | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |
| EP-PW-02 | invalid: too short | 400 min length | 400 {"success":false,"message":"Password must be at least 8 characters long","errors":[{"type":"field","value":"Pass1","msg":"Password must be at least 8 characters | **PASS** |
| EP-PW-03 | invalid: no digit | 400 needs a number | 400 {"success":false,"message":"Password must contain at least one number","errors":[{"type":"field","value":"Password","msg":"Password must contain at least one nu | **PASS** |
| EP-PW-04 | invalid: empty string | 400 required | 400 {"success":false,"message":"Password is required","errors":[{"type":"field","value":"","msg":"Password is required","path":"password","location":"body"}]} | **PASS** |
| EP-PW-05 | invalid: field missing | 400 required | 400 {"success":false,"message":"Password is required","errors":[{"type":"field","msg":"Password is required","path":"password","location":"body"}]} | **PASS** |
| EP-PW-06 | invalid type: number 12345678 | 400 (type rejected, not a crash) | 400 {"success":false,"message":"Password must be text","errors":[{"type":"field","value":12345678,"msg":"Password must be text","path":"password","location":"body"} | **PASS** |
| EP-PW-07 | valid (weak): digits only '12345678' | 201 (meets the stated rule) | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |

### Email

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| EP-EM-01 | valid | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |
| EP-EM-02 | invalid: no @ | 400 | 400 {"success":false,"message":"Please provide a valid email address","errors":[{"type":"field","value":"qa1795432172186example.com","msg":"Please provide a valid e | **PASS** |
| EP-EM-03 | invalid: no domain | 400 | 400 {"success":false,"message":"Please provide a valid email address","errors":[{"type":"field","value":"user@","msg":"Please provide a valid email address","path": | **PASS** |
| EP-EM-04 | invalid: no local part | 400 | 400 {"success":false,"message":"Please provide a valid email address","errors":[{"type":"field","value":"@example.com","msg":"Please provide a valid email address", | **PASS** |
| EP-EM-05 | invalid: empty | 400 | 400 {"success":false,"message":"Email is required","errors":[{"type":"field","value":"","msg":"Email is required","path":"email","location":"body"},{"type":"field", | **PASS** |
| EP-EM-06 | valid: mixed case + padding | 201, stored lower-case | 201 {"success":true,"token":"<redacted-test-jwt> stored=qa.case.1795432172186@example.com | **PASS** |
| EP-EM-07 | invalid type: object {$gt:''} | 400 | 400 {"success":false,"message":"Please provide a valid email address","errors":[{"type":"field","value":"[object Object]","msg":"Please provide a valid email addres | **PASS** |

### Login

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| EP-LG-01 | invalid type: {$ne:null} in email+password | 400 (never 200) | 400 {"success":false,"message":"Please provide a valid email address","errors":[{"type":"field","value":"[object Object]","msg":"Please provide a valid email addres | **PASS** |

### Scan URL

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| EP-URL-01 | valid: http + IP, reachable | 200 report | 200 {"success":true,"userId":"6b041eeee4cdc54f9055cfc0","url":"http://127.0.0.1:5070/","grade":"F","score":16,"summary":{"critical":0,"high":2,"medium":6,"low":2}," | **PASS** |
| EP-URL-02 | valid: https, unreachable | 502 not reachable | 502 {"success":false,"message":"Site could not be reached.","detail":"Connection was refused by the server."} | **PASS** |
| EP-URL-03 | valid: padded with spaces | 200 (trimmed) | 200 {"success":true,"userId":"6b041eeee4cdc54f9055cfc0","url":"http://127.0.0.1:5070/","grade":"F","score":16,"summary":{"critical":0,"high":2,"medium":6,"low":2}," | **PASS** |
| EP-URL-04 | valid (dev): localhost hostname | 200 in dev (documented bypass) | 200 {"success":true,"userId":"6b041eeee4cdc54f9055cfc0","url":"http://localhost:5070/","grade":"F","score":16,"summary":{"critical":0,"high":2,"medium":6,"low":2}," | **PASS** |
| EP-URL-05 | invalid: no scheme | 400 | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"example.com","msg":"Please provide a va | **PASS** |
| EP-URL-06 | invalid: ftp scheme | 400 | 400 {"success":false,"message":"URL must start with http:// or https://"} | **PASS** |
| EP-URL-07 | invalid: javascript: scheme | 400 | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"javascript:alert(1)","msg":"Please prov | **PASS** |
| EP-URL-08 | invalid: file scheme | 400 | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"file:///etc/passwd","msg":"Please provi | **PASS** |
| EP-URL-09 | invalid: empty | 400 A URL is required | 400 {"success":false,"message":"A URL is required","errors":[{"type":"field","value":"","msg":"A URL is required","path":"url","location":"body"},{"type":"field","v | **PASS** |
| EP-URL-10 | invalid type: number | 400 | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"12345","msg":"Please provide a valid UR | **PASS** |

### Note

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| EP-NT-01 | valid: text | 200 | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// | **PASS** |
| EP-NT-02 | valid: empty string (clears note) | 200, note cleared | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// stored(len)=0 | **PASS** |
| EP-NT-03 | valid: whitespace only | 200, stored as '' | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// stored(len)=0 | **PASS** |
| EP-NT-04 | valid: HTML/script text | 200, stored as plain text | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// stored(len)=25 | **PASS** |
| EP-NT-05 | invalid: missing field | 400 A note is required | 400 {"success":false,"message":"A note is required","errors":[{"type":"field","msg":"A note is required","path":"note","location":"body"}]} | **PASS** |
| EP-NT-06 | invalid type: number | 400 A note must be text | 400 {"success":false,"message":"A note must be text","errors":[{"type":"field","value":42,"msg":"A note must be text","path":"note","location":"body"}]} | **PASS** |
| EP-NT-07 | invalid type: null | 400 | 400 {"success":false,"message":"A note must be text","errors":[{"type":"field","value":null,"msg":"A note must be text","path":"note","location":"body"}]} | **PASS** |
| EP-NT-08 | invalid type: object | 400 | 400 {"success":false,"message":"A note must be text","errors":[{"type":"field","value":{"a":1},"msg":"A note must be text","path":"note","location":"body"}]} | **PASS** |

## Boundary value analysis

### Grade thresholds

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-GR-01 | 100 <br>*max* | A | A | **PASS** |
| BVA-GR-02 | 90 <br>*A on-boundary* | A | A | **PASS** |
| BVA-GR-03 | 89 <br>*A just-below* | B | B | **PASS** |
| BVA-GR-04 | 75 <br>*B on-boundary* | B | B | **PASS** |
| BVA-GR-05 | 74 <br>*B just-below* | C | C | **PASS** |
| BVA-GR-06 | 60 <br>*C on-boundary* | C | C | **PASS** |
| BVA-GR-07 | 59 <br>*C just-below* | D | D | **PASS** |
| BVA-GR-08 | 40 <br>*D on-boundary* | D | D | **PASS** |
| BVA-GR-09 | 39 <br>*D just-below* | F | F | **PASS** |
| BVA-GR-10 | 0 <br>*min* | F | F | **PASS** |
| BVA-GR-11 | -1 <br>*below valid range (robustness)* | F | F | **PASS** |
| BVA-GR-12 | 101 <br>*above valid range (robustness)* | A | A | **PASS** |

### Score via findings (end-to-end of scoring)

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-SC-01 | 3×CRITICAL + 8×LOW <br>*floor +1 (100-99)* | 1 / F | 1 / F | **PASS** |
| BVA-SC-02 | 4×CRITICAL <br>*floor on-boundary (100-100)* | 0 / F | 0 / F | **PASS** |
| BVA-SC-03 | 3×CRITICAL + 1×HIGH + 4×LOW <br>*raw -2 must clamp to 0* | 0 / F | 0 / F | **PASS** |
| BVA-SC-04 | 3×LOW <br>*closest reachable A above 90* | 91 / A | 91 / A | **PASS** |
| BVA-SC-05 | 1×MEDIUM + 1×LOW <br>*A just-below* | 89 / B | 89 / B | **PASS** |
| BVA-SC-06 | 3×MEDIUM <br>*B +1* | 76 / B | 76 / B | **PASS** |
| BVA-SC-07 | 1×CRITICAL <br>*B on-boundary* | 75 / B | 75 / B | **PASS** |
| BVA-SC-08 | 1×HIGH + 1×MEDIUM + 1×LOW <br>*B just-below* | 74 / C | 74 / C | **PASS** |
| BVA-SC-09 | 1×HIGH + 3×MEDIUM <br>*C +1* | 61 / C | 61 / C | **PASS** |
| BVA-SC-10 | 1×CRITICAL + 1×HIGH <br>*C on-boundary* | 60 / C | 60 / C | **PASS** |
| BVA-SC-11 | 1×CRITICAL + 2×MEDIUM <br>*C just-below* | 59 / D | 59 / D | **PASS** |
| BVA-SC-12 | 2×CRITICAL + 3×LOW <br>*D +1* | 41 / D | 41 / D | **PASS** |
| BVA-SC-13 | 4×HIGH <br>*D on-boundary* | 40 / D | 40 / D | **PASS** |
| BVA-SC-14 | 2×CRITICAL + 1×MEDIUM + 1×LOW <br>*D just-below* | 39 / F | 39 / F | **PASS** |
| BVA-SC-15 | all combinations <br>*90 is unreachable, so an exact A-boundary scan can never happen; 91 is the lowest real A* | (informational) | unreachable: 87, 90, 93, 95, 96, 98, 99 | **PASS** |

### Password length

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-PW-01 | 7 chars | 400 | 400 {"success":false,"message":"Password must be at least 8 characters long","errors":[{"type":"field","value":"aaaaaa1","msg":"Password must be at least 8 characte | **PASS** |
| BVA-PW-02 | 8 chars | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |
| BVA-PW-03 | 9 chars | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |

### Name length

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-NM-01 | 0 chars | 400 | 400 {"success":false,"message":"Name is required","errors":[{"type":"field","value":"","msg":"Name is required","path":"name","location":"body"}]} | **PASS** |
| BVA-NM-02 | 1 chars | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |
| BVA-NM-03 | 99 chars | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |
| BVA-NM-04 | 100 chars | 201 | 201 {"success":true,"token":"<redacted-test-jwt> | **PASS** |
| BVA-NM-05 | 101 chars | 400 | 400 {"success":false,"message":"Name must be 100 characters or fewer","errors":[{"type":"field","value":"nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn \| message="Name must be 100 characters or fewer" | **PASS** |

### Note length

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-NT-01 | 499 chars | 200 | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// stored(len)=499 | **PASS** |
| BVA-NT-02 | 500 chars | 200 | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// stored(len)=500 | **PASS** |
| BVA-NT-03 | 501 chars | 400 max 500 | 400 {"success":false,"message":"A note cannot be longer than 500 characters","errors":[{"type":"field","value":"nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn | **PASS** |
| BVA-NT-04 | 500 chars + 1 trailing space (501 raw) | 200, trimmed to 500 | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eeee4cdc54f9055cfe3","userId":"6b041eeee4cdc54f9055cfe2","url":"http:// stored(len)=500 | **PASS** |

### Scan id

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-ID-01 | 23 hex chars | 400 Invalid scan ID | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |
| BVA-ID-02 | 24 hex chars (valid format, not found) | 404 | 404 {"success":false,"message":"Scan result not found"} | **PASS** |
| BVA-ID-03 | 25 hex chars | 400 Invalid scan ID | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |
| BVA-ID-04 | 12 non-hex chars 'aaaaaaaaaaaa' | 400 or 404, never 500 | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |

### Login rate limit (5 / 15 min / IP)

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-RL-01 | attempt 4 | 401 (allowed) | #4=401 (all: 401,401,401,401,401,429) | **PASS** |
| BVA-RL-02 | attempt 5 | 401 (allowed, on boundary) | #5=401 (all: 401,401,401,401,401,429) | **PASS** |
| BVA-RL-03 | attempt 6 | 429 (blocked) | #6=429 (all: 401,401,401,401,401,429) | **PASS** |

### Scan rate limit (10 / 15 min / user)

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-RL-04 | request 9 | 400 (allowed, validation error) | #9=400 (all: 400,400,400,400,400,400,400,400,400,400,429) | **PASS** |
| BVA-RL-05 | request 10 | 400 (allowed, on boundary) | #10=400 (all: 400,400,400,400,400,400,400,400,400,400,429) | **PASS** |
| BVA-RL-06 | request 11 | 429 (blocked, limit checked before validation) | #11=429 (all: 400,400,400,400,400,400,400,400,400,400,429) | **PASS** |
| BVA-RL-07 | user 2, request 1 | 400 (limit is per user, not per IP) | 400 | **PASS** |

### General API limit (100 / 15 min / IP)

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| BVA-RL-08 | request 99 | 200 | #99=200 | **PASS** |
| BVA-RL-09 | request 100 | 200 (on boundary) | #100=200 | **PASS** |
| BVA-RL-10 | request 101 | 429 | #101=429 | **PASS** |

## Decision tables

### DT-1 Scan access

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| DT1-GET-R1 | C1=N C2=- C3=- C4=- C5=- | 401 Authorization token is required | 401 {"message":"Authorization token is required"} | **PASS** |
| DT1-GET-R2 | C1=N C2=- C3=N C4=- C5=- | 401 Authorization token is required | 401 {"message":"Authorization token is required"} | **PASS** |
| DT1-GET-R3 | C1=Y C2=Invalid C3=- C4=- C5=- | 401 Invalid authorization token | 401 {"message":"Invalid authorization token"} | **PASS** |
| DT1-GET-R4 | C1=Y C2=Expired C3=- C4=- C5=- | 401 Authorization token has expired | 401 {"message":"Authorization token has expired"} | **PASS** |
| DT1-GET-R5 | C1=Y C2=Valid C3=N C4=- C5=- | 400 Invalid scan ID | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |
| DT1-GET-R6 | C1=Y C2=Valid C3=Y C4=N C5=- | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} | **PASS** |
| DT1-GET-R7 | C1=Y C2=Valid C3=Y C4=Y C5=N | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} \| B's scan afterwards: 200, note="" | **PASS** |
| DT1-GET-R8 | C1=Y C2=Valid C3=Y C4=Y C5=Y | 200 | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eef969587af65eee164","userId":"6b041eef969587af65eee157","url":"http:// | **PASS** |
| DT1-PATCH-R1 | C1=N C2=- C3=- C4=- C5=- | 401 Authorization token is required | 401 {"message":"Authorization token is required"} | **PASS** |
| DT1-PATCH-R2 | C1=N C2=- C3=N C4=- C5=- | 401 Authorization token is required | 401 {"message":"Authorization token is required"} | **PASS** |
| DT1-PATCH-R3 | C1=Y C2=Invalid C3=- C4=- C5=- | 401 Invalid authorization token | 401 {"message":"Invalid authorization token"} | **PASS** |
| DT1-PATCH-R4 | C1=Y C2=Expired C3=- C4=- C5=- | 401 Authorization token has expired | 401 {"message":"Authorization token has expired"} | **PASS** |
| DT1-PATCH-R5 | C1=Y C2=Valid C3=N C4=- C5=- | 400 Invalid scan ID | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |
| DT1-PATCH-R6 | C1=Y C2=Valid C3=Y C4=N C5=- | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} | **PASS** |
| DT1-PATCH-R7 | C1=Y C2=Valid C3=Y C4=Y C5=N | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} \| B's scan afterwards: 200, note="" | **PASS** |
| DT1-PATCH-R8 | C1=Y C2=Valid C3=Y C4=Y C5=Y | 200 | 200 {"success":true,"scan":{"summary":{"critical":0,"high":2,"medium":6,"low":2},"_id":"6b041eef969587af65eee16f","userId":"6b041eef969587af65eee157","url":"http:// | **PASS** |
| DT1-DELETE-R1 | C1=N C2=- C3=- C4=- C5=- | 401 Authorization token is required | 401 {"message":"Authorization token is required"} | **PASS** |
| DT1-DELETE-R2 | C1=N C2=- C3=N C4=- C5=- | 401 Authorization token is required | 401 {"message":"Authorization token is required"} | **PASS** |
| DT1-DELETE-R3 | C1=Y C2=Invalid C3=- C4=- C5=- | 401 Invalid authorization token | 401 {"message":"Invalid authorization token"} | **PASS** |
| DT1-DELETE-R4 | C1=Y C2=Expired C3=- C4=- C5=- | 401 Authorization token has expired | 401 {"message":"Authorization token has expired"} | **PASS** |
| DT1-DELETE-R5 | C1=Y C2=Valid C3=N C4=- C5=- | 400 Invalid scan ID | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |
| DT1-DELETE-R6 | C1=Y C2=Valid C3=Y C4=N C5=- | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} | **PASS** |
| DT1-DELETE-R7 | C1=Y C2=Valid C3=Y C4=Y C5=N | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} \| B's scan afterwards: 200, note="" | **PASS** |
| DT1-DELETE-R8 | C1=Y C2=Valid C3=Y C4=Y C5=Y | 200 | 200 {"success":true,"message":"Scan deleted"} \| GET afterwards: 404 | **PASS** |

### DT-2 Run scan

| ID | Input / condition | Expected | Actual | Result |
|---|---|---|---|---|
| DT2-R1 | Auth=N URLvalid=- Owner=- Reachable=- | 401 | 401 {"message":"Authorization token is required"} | **PASS** |
| DT2-R2 | Auth=Y URLvalid=N Owner=N Reachable=- | 400 Please provide a valid URL including http:// or https:// | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"not-a-url","msg":"Please provide a vali | **PASS** |
| DT2-R3 | Auth=Y URLvalid=N Owner=Y Reachable=- | 400 Please provide a valid URL including http:// or https:// | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"not-a-url","msg":"Please provide a vali | **PASS** |
| DT2-R4 | Auth=Y URLvalid=Y Owner=N Reachable=- | 400 You must confirm you own this website or have permission to scan it. | 400 {"success":false,"message":"You must confirm you own this website or have permission to scan it."} | **PASS** |
| DT2-R5 | Auth=Y URLvalid=Y Owner=Y Reachable=N | 502 Site could not be reached. | 502 {"success":false,"message":"Site could not be reached.","detail":"Connection was refused by the server."} | **PASS** |
| DT2-R6 | Auth=Y URLvalid=Y Owner=Y Reachable=Y | 200 | 200 {"success":true,"userId":"6b041eef969587af65eee1df","url":"http://127.0.0.1:5070/","grade":"F","score":16,"summary":{"critical":0,"high":2,"medium":6,"low":2}," | **PASS** |
