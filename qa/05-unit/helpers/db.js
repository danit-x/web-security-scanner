// Connects Mongoose to a throw-away database on the LOCAL MongoDB (or the CI
// service container), one database per test file so files can run in parallel.
const mongoose = require("mongoose");

const LOCAL = /^mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

async function connectTestDb() {
  const base = process.env.TEST_MONGO_URI;
  if (!LOCAL.test(base)) {
    throw new Error(`Refusing to run tests against a non-local MongoDB: ${base}`);
  }
  const name = `websec_jest_${process.env.JEST_WORKER_ID || 0}_${Date.now()}`;
  await mongoose.connect(`${base.replace(/\/$/, "")}/${name}`);
}

async function disconnectTestDb() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

module.exports = { connectTestDb, disconnectTestDb };
