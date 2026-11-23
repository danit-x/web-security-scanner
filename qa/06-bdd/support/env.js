// Test-only settings, loaded before the app. Never the real server/.env.
process.env.JWT_SECRET = "bdd-only-secret-not-for-production";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.NODE_ENV = "test";
process.env.TEST_MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27099";
