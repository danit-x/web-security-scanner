// jest.config.js
// The Jest suite lives in qa/05-unit (EC4206 QA work); Jest itself is
// installed here in server/. `@server/<path>` resolves to this folder.
//
//   npm run test:unit       -> run the Jest suite
//   npm run test:coverage   -> run it with coverage (text + lcov for SonarQube)
module.exports = {
  rootDir: __dirname,
  roots: ["<rootDir>/../qa/05-unit"],
  testMatch: ["**/*.test.js"],
  testEnvironment: "node",
  moduleDirectories: ["node_modules", "<rootDir>/node_modules"],
  moduleNameMapper: { "^@server/(.*)$": "<rootDir>/$1" },
  setupFiles: ["<rootDir>/../qa/05-unit/setup/env.js"],
  collectCoverageFrom: [
    "**/*.js",
    "!node_modules/**",
    "!tests/**",
    "!scripts/**",
    "!coverage/**",
    "!jest.config.js",
    "!server.js",
  ],
  coverageDirectory: "<rootDir>/../qa/evidence/coverage/jest",
  coverageReporters: ["text", "text-summary", "lcovonly", "json-summary"],
  testTimeout: 30000,
};
