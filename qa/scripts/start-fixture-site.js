// qa/scripts/start-fixture-site.js
// Serves the deliberately weak QA fixture website on a fixed local port so
// Postman and Selenium runs have a safe scan target (never a real website).
//   node qa/scripts/start-fixture-site.js        -> http://127.0.0.1:5070/
const { startFixtureSite } = require("../05-unit/helpers/fixtureSite");

const PORT = Number(process.env.FIXTURE_PORT || 5070);
startFixtureSite(PORT).then(({ url }) => console.log(`[qa] fixture site on ${url}/`));
