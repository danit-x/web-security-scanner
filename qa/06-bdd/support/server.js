// Cucumber, supertest and the app all live under server/node_modules, but the
// BDD files live in qa/06-bdd. Resolve every package FROM server/ so that the
// step files and the cucumber-js runner share one copy of @cucumber/cucumber.
const path = require("path");
const { createRequire } = require("module");

const SERVER_DIR = path.resolve(__dirname, "../../../server");
const fromServer = createRequire(path.join(SERVER_DIR, "package.json"));

module.exports = { SERVER_DIR, fromServer };
