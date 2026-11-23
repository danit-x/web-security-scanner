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
  // Quality gate (QA phase 8): `jest --coverage` fails if coverage drops below
  // these. Baseline at phase 5: 95.6 % statements, 90.2 % branches.
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 90, lines: 90 },
  },
  testTimeout: 30000,
};
