// Runs before every Jest test file. Test-only settings; never the real .env.
process.env.JWT_SECRET = "jest-only-secret-not-for-production";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";
process.env.TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27099";
