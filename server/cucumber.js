// cucumber.js: Cucumber.js config for the BDD suite in qa/06-bdd (EC4206 QA).
//   npm run test:bdd                       -> run every scenario
//   npm run test:bdd -- --tags @smoke      -> run a tagged subset
module.exports = {
  default: {
    paths: ["../qa/06-bdd/features/**/*.feature"],
    require: ["../qa/06-bdd/support/**/*.js", "../qa/06-bdd/steps/**/*.js"],
    format: [
      "progress-bar",
      "summary",
      "html:../qa/evidence/bdd/cucumber-report.html",
      "json:../qa/evidence/bdd/cucumber-report.json",
    ],
    formatOptions: { snippetInterface: "async-await" },
    strict: true, // undefined or pending steps fail the run
  },
};
