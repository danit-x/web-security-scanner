// Where the QA stack runs. All local: the client (Vite) talks to the QA API,
// which uses the local MongoDB. The only scan target is the fixture website.
module.exports = {
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
  API_URL: process.env.API_URL || "http://127.0.0.1:5000/api",
  FIXTURE_URL: process.env.FIXTURE_URL || "http://127.0.0.1:5070/",
  PASSWORD: "Passw0rd1",
  WAIT_MS: 10000, // explicit-wait ceiling; never a fixed sleep
};
