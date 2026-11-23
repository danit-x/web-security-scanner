// qa/scripts/start-dast-api.js
// Starts the real API for the OWASP ZAP scan (QA phase 9): port 5060, its own
// local database, and the rate limiters stubbed out.
//
// Why stub the limiters: an active DAST scan sends thousands of requests from
// one IP. With the real limits (100 per 15 min, login 5) almost every attack
// request would get 429 and the scan would test nothing. Scanning with rate
// limiting off (or the scanner allow-listed) is standard practice. The limiters
// themselves are tested separately (TC-LOG-05, BDD @rate-limit, Postman 05).
// Nothing in server/ is changed: the stub is injected into Node's module cache.
const path = require("path");
const { createRequire } = require("module");

const serverRequire = createRequire(path.resolve(__dirname, "../../server/package.json"));
const limiterPath = serverRequire.resolve("express-rate-limit");
const passThrough = () => (req, res, next) => next();
passThrough.ipKeyGenerator = (ip) => ip;
passThrough.rateLimit = passThrough;
passThrough.default = passThrough;
require.cache[limiterPath] = { id: limiterPath, filename: limiterPath, loaded: true, exports: passThrough };

process.env.PORT = process.env.PORT || "5060";
process.env.QA_MONGO_URI = process.env.QA_MONGO_URI || "mongodb://127.0.0.1:27099/websec_dast";
console.log("[qa] DAST API: rate limiting stubbed for the ZAP scan only");
require("./start-test-api.js");
