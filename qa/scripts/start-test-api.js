// qa/scripts/start-test-api.js
// Starts the real API (server/server.js) with QA-only settings, WITHOUT
// editing server/.env. dotenv never overrides variables that already exist,
// so anything set here wins over the values in .env.
//
//   node qa/scripts/start-test-api.js            -> port 5000, local DB
//   PORT=5055 node qa/scripts/start-test-api.js  -> another port
//
// Safety: refuses to start unless MONGO_URI points at a local MongoDB, so
// test runs can never write to the deployed (Atlas) database.

process.env.MONGO_URI =
  process.env.QA_MONGO_URI || "mongodb://127.0.0.1:27099/websec_qa";
process.env.JWT_SECRET =
  process.env.QA_JWT_SECRET || "qa-only-jwt-secret-not-for-production";
process.env.PORT = process.env.PORT || "5000";
process.env.NODE_ENV = process.env.NODE_ENV || "development";
process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const LOCAL_DB = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//;
if (!LOCAL_DB.test(process.env.MONGO_URI)) {
  console.error("[qa] Refusing to start: MONGO_URI is not a local MongoDB.");
  process.exit(1);
}

console.log(
  `[qa] API starting on :${process.env.PORT} (NODE_ENV=${process.env.NODE_ENV}, local DB)`,
);
require("../../server/server.js");
