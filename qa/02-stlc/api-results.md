# API Test Execution Results (automated)

Run: 2026-11-23T09:53:14.104Z · Node v25.6.0 · local MongoDB · runner `qa/scripts/run-api-cases.mjs`
Raw evidence: `qa/evidence/api-run-2026-11-23T09-53-14-102Z.json` and the matching `.server.log`

**Total 45 · PASS 42 · FAIL 3**

| ID | Title | Expected | Actual | Result |
|---|---|---|---|---|
| TC-API-01 | Health check | 200 {status:ok} | 200 {"status":"ok"} | **PASS** |
| TC-API-02 | Unknown route | 404 JSON success:false | 404 {"success":false,"message":"Route not found: /api/does-not-exist","stack":"Error: Route not found: /api/does-not-exist\n    at notFound (C:\\dev\\mernStack\\ser | **PASS** |
| TC-API-03 | Security headers present | nosniff, X-Frame-Options set, no X-Powered-By | X-Content-Type-Options=nosniff, X-Frame-Options=SAMEORIGIN, X-Powered-By=null | **PASS** |
| TC-API-04 | Disallowed CORS origin refused cleanly | 4xx, no ACAO header, no stack trace | 500, ACAO=null, stackInBody=true, message=Not allowed by CORS | **FAIL** |
| TC-API-05 | Malformed JSON body | 400 JSON, no stack trace | 500, stackInBody=true, message=Unexpected end of JSON input | **FAIL** |
| TC-REG-01 | Register with valid data | 201 + token + user | 201 {"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZiMDQwZDA1MDlmMDlmMWUxZTZiOThkNCIsImlhdCI6MTc5NTQyNzU4OSwiZXhwIjoxNzk2MDMyMzg5fQ.gZFxpDH | **PASS** |
| TC-REG-02 | Duplicate email rejected | 400 User already exists | 400 {"success":false,"message":"User already exists"} | **PASS** |
| TC-REG-03 | Password 7 chars rejected | 400 at least 8 characters | 400 {"success":false,"message":"Password must be at least 8 characters long","errors":[{"type":"field","value":"abcdef1","msg":"Password must be at least 8 characte | **PASS** |
| TC-REG-04 | Password exactly 8 chars accepted | 201 | 201 {"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZiMDQwZDA1MDlmMDlmMWUxZTZiOThkNSIsImlhdCI6MTc5NTQyNzU4OSwiZXhwIjoxNzk2MDMyMzg5fQ.agrwKhP | **PASS** |
| TC-REG-05 | Password without digit rejected | 400 one number | 400 {"success":false,"message":"Password must contain at least one number","errors":[{"type":"field","value":"abcdefgh","msg":"Password must contain at least one nu | **PASS** |
| TC-REG-06 | Invalid email rejected | 400 valid email | 400 {"success":false,"message":"Please provide a valid email address","errors":[{"type":"field","value":"user@","msg":"Please provide a valid email address","path": | **PASS** |
| TC-REG-07 | Whitespace-only name rejected | 400 Name is required | 400 {"success":false,"message":"Name is required","errors":[{"type":"field","value":"","msg":"Name is required","path":"name","location":"body"}]} | **PASS** |
| TC-REG-08 | Name 101 chars rejected | 400 name length | 400 {"success":false,"message":"Name must be under 100 characters","errors":[{"type":"field","value":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | **PASS** |
| TC-REG-09 | Email case/space insensitive | register 201, login 200 | register 201 (stored qa.mixed.1795427588500@example.com), login 200 {"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZiMDQwZDA1MDlmMDlmMWUxZTZiOThkNiIsImlhdCI6MTc5NTQyNzU4OSwiZXhwIjoxNzk2MDMyMzg5fQ.BbW8vIn | **PASS** |
| TC-REG-10 | Gmail address can log in after register | register 201, login 200 with qa.tester.1795427588500@gmail.com | register 201 (stored as qatester1795427588500@gmail.com), login 401 {"success":false,"message":"Invalid email or password"} | **FAIL** |
| TC-REG-11 | Password hash never returned | no password field | register.user keys=_id,name,email,createdAt; me.user keys=_id,name,email,createdAt | **PASS** |
| TC-LOG-01 | Valid login | 200 + token | 200 {"success":true,"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZiMDQwZDA4NGQwNGVkZDZkZTNkZTQ0ZCIsImlhdCI6MTc5NTQyNzU5MiwiZXhwIjoxNzk2MDMyMzkyfQ.L9_iJye | **PASS** |
| TC-LOG-02 | Wrong password | 401 Invalid email or password | 401 {"success":false,"message":"Invalid email or password"} | **PASS** |
| TC-LOG-03 | Unknown email same message | 401 identical message to LOG-02 | 401 {"success":false,"message":"Invalid email or password"} | **PASS** |
| TC-LOG-04 | Missing password | 400 Password is required | 400 {"success":false,"message":"Password is required","errors":[{"type":"field","msg":"Password is required","path":"password","location":"body"}]} | **PASS** |
| TC-LOG-05 | 5 attempts allowed, 6th blocked | #5 not 429, #6 429 | #5=401, #6=429 {"success":false,"message":"Too many login attempts. Please try again in 15 minutes."} | **PASS** |
| TC-AUTH-01 | Valid token accepted | 200 own profile | 200 {"success":true,"user":{"_id":"6b040d0509f09f1e1e6b98d4","name":"QA User A","email":"qa.a.1795427588500@example.com","createdAt":"2026-11-23T09:53:09.751Z"}} | **PASS** |
| TC-AUTH-02 | No token | 401 token required | 401 {"message":"Authorization token is required"} | **PASS** |
| TC-AUTH-03 | Tampered token | 401 Invalid authorization token | 401 {"message":"Invalid authorization token"} | **PASS** |
| TC-AUTH-04 | Expired token | 401 token has expired | 401 {"message":"Authorization token has expired"} | **PASS** |
| TC-AUTH-05 | Empty bearer value | 401 | 401 {"message":"Authorization token is required"} | **PASS** |
| TC-SCAN-01 | Scan a reachable site | 200, saved _id, grade A-F, score 0-100, summary matches, header findings | 200 grade=F score=16 findings=10 summary={"critical":0,"high":2,"medium":6,"low":2} summaryMatches=true | **PASS** |
| TC-SCAN-02 | Ownership not confirmed | 400 confirm ownership | 400 {"success":false,"message":"You must confirm you own this website or have permission to scan it."} | **PASS** |
| TC-SCAN-03 | URL without protocol | 400 | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"example.com","msg":"Please provide a va | **PASS** |
| TC-SCAN-04 | Empty URL | 400 A URL is required | 400 {"success":false,"message":"A URL is required","errors":[{"type":"field","value":"","msg":"A URL is required","path":"url","location":"body"},{"type":"field","v | **PASS** |
| TC-SCAN-05 | Non-HTTP scheme | 400 | 400 {"success":false,"message":"Please provide a valid URL including http:// or https://","errors":[{"type":"field","value":"ftp://localhost/file","msg":"Please pro | **PASS** |
| TC-SCAN-06 | Unreachable host handled | 502 Site could not be reached, server still up | 502 {"success":false,"message":"Site could not be reached.","detail":"Connection was refused by the server."}; serverAlive=true | **PASS** |
| TC-SCAN-07 | Scan without auth | 401 | 401 {"message":"Authorization token is required"} | **PASS** |
| TC-SCAN-08 | 10 scans allowed, 11th blocked | #10=400, #11=429 | statuses=400,400,400,400,400,400,400,400,400,400,429 | **PASS** |
| TC-HIS-01 | History only mine, newest first | 200 count=2 all userId=A newest first | 200 count=2 allMine=true sorted=true | **PASS** |
| TC-HIS-02 | Open own scan | 200 scan | 200 id=6b040d0609f09f1e1e6b98d8 | **PASS** |
| TC-HIS-03 | Other user's scan hidden (IDOR) | 404 Scan result not found | 404 {"success":false,"message":"Scan result not found"} | **PASS** |
| TC-HIS-04 | Malformed id | 400 Invalid scan ID | 400 {"success":false,"message":"Invalid scan ID"} | **PASS** |
| TC-HIS-05 | Non-existent id | 404 | 404 {"success":false,"message":"Scan result not found"} | **PASS** |
| TC-NOTE-01 | Add note to own scan | 200 and note persisted | 200, persisted note="Fix CSP first" | **PASS** |
| TC-NOTE-02 | Note 501 chars rejected | 400 max 500 | 400 {"success":false,"message":"A note cannot be longer than 500 characters","errors":[{"type":"field","value":"nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn | **PASS** |
| TC-NOTE-03 | Non-string note rejected | 400 A note must be text | 400 {"success":false,"message":"A note must be text","errors":[{"type":"field","value":123,"msg":"A note must be text","path":"note","location":"body"}]} | **PASS** |
| TC-NOTE-04 | Cannot edit other user's note | 404, B note unchanged | 404, B note="" | **PASS** |
| TC-DEL-01 | Delete own scan | 200 then GET 404 | 200 Scan deleted; GET after=404 | **PASS** |
| TC-DEL-02 | Cannot delete other user's scan | 404; B still 200 | 404; B GET=200 | **PASS** |
