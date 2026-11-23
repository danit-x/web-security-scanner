// API tests for /api/auth (register, login, me) against the real app + local DB.
const { app, request, registerUser, uniqueEmail, PASSWORD } = require("../helpers/api");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const User = require("@server/models/user");

beforeAll(connectTestDb);
afterAll(disconnectTestDb);
afterEach(() => jest.restoreAllMocks());

describe("POST /api/auth/register", () => {
  test("201 with token and a user object that never includes the password", async () => {
    const { res, body } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, token: expect.any(String) });
    expect(res.body.user).toEqual({
      _id: expect.any(String), name: "Jest User", email: body.email, createdAt: expect.any(String),
    });
    const stored = await User.findOne({ email: body.email });
    expect(stored.password).toMatch(/^\$2[aby]\$10\$/); // bcrypt hash, cost 10
  });

  test("duplicate email -> 400 User already exists", async () => {
    const { body } = await registerUser();
    const { res } = await registerUser({ email: body.email.toUpperCase() });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("User already exists");
  });

  test("validation failure -> 400 with field errors, DB untouched", async () => {
    const email = uniqueEmail("bad");
    const res = await request(app).post("/api/auth/register").send({ name: "", email, password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(1);
    expect(await User.countDocuments({ email })).toBe(0);
  });

  test("database failure -> 500 Server error (no internals leaked)", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(User, "findOne").mockRejectedValueOnce(new Error("db down"));
    const { res } = await registerUser();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Server error" });
  });
});

describe("GET /api/auth/me", () => {
  test("returns the current user's profile", async () => {
    const { token, user } = await registerUser();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user._id).toBe(user._id);
    expect(res.body.user).not.toHaveProperty("password");
  });

  test("401 without a token", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  test("404 when the token's user has been deleted", async () => {
    const { token, user } = await registerUser();
    await User.deleteOne({ _id: user._id });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("500 when the database fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { token } = await registerUser();
    jest.spyOn(User, "findById").mockImplementationOnce(() => ({ select: () => Promise.reject(new Error("db down")) }));
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(500);
  });
});

// Login is limited to 5 attempts per IP per 15 minutes, and every request in
// this file comes from the same IP, so this block counts its attempts.
describe("POST /api/auth/login (5 attempts, then 429)", () => {
  let email;
  beforeAll(async () => { ({ body: { email } } = await registerUser()); });
  const login = (body) => request(app).post("/api/auth/login").send(body);

  test("#1 valid credentials -> 200 with token", async () => {
    const res = await login({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test("#2 and #3 wrong password and unknown email give the same 401 message", async () => {
    const wrong = await login({ email, password: "WrongPass9" });
    const unknown = await login({ email: uniqueEmail("nobody"), password: "WrongPass9" });
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  test("#4 database failure -> 500", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(User, "findOne").mockRejectedValueOnce(new Error("db down"));
    expect((await login({ email, password: PASSWORD })).status).toBe(500);
  });

  test("#5 is still allowed, #6 is blocked with 429", async () => {
    expect((await login({ email, password: "WrongPass9" })).status).toBe(401);
    const sixth = await login({ email, password: PASSWORD });
    expect(sixth.status).toBe(429);
    expect(sixth.body.message).toBe("Too many login attempts. Please try again in 15 minutes.");
  });
});
