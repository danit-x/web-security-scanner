// DEF-009 (phase 9, OWASP A10 SSRF): the SSRF guard only checked the URL the
// user typed. The scanner then (1) followed redirects without re-checking and
// (2) resolved the host a second time when connecting, so a "public" site could
// redirect it, or re-point DNS (rebinding), to internal addresses.
//
// These tests run the guard in production mode. No real internal or public
// host is ever contacted: DNS is mocked, and a local fixture plays the
// attacker's "public" website.
const http = require("node:http");
const dns = require("node:dns");
const { app, request, registerUser } = require("../helpers/api");
const { connectTestDb, disconnectTestDb } = require("../helpers/db");
const validators = require("@server/validators/scanValidators");
const checkFileExposure = require("@server/utils/checks/fileExposureCheck");

const PUBLIC_IP = "93.184.216.34"; // documentation-style public address
let fixture, port, hits, user;

// The attacker's "public" site: a normal page and two malicious redirects.
function startFixture() {
  hits = [];
  fixture = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === "/to-metadata") {
      res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
      return res.end();
    }
    if (req.url === "/to-internal-name") {
      res.writeHead(302, { Location: `http://internal.example:${port}/` });
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><title>public</title>");
  });
  return new Promise((r) => fixture.listen(0, "127.0.0.1", () => { port = fixture.address().port; r(); }));
}

// DNS as the attacker controls it:
//   check-time (validator, dns.promises.lookup): every *.example name looks public
//   connect-time (dns.lookup, used by sockets):   public.example -> the local fixture,
//                                                 rebind.example -> 127.0.0.1 (rebinding),
//                                                 internal.example -> 10.0.0.5
function mockDns() {
  jest.spyOn(dns.promises, "lookup").mockImplementation(async (host) => {
    if (host.endsWith(".example")) return { address: PUBLIC_IP, family: 4 };
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  });
  const connectTime = { "public.example": "127.0.0.1", "rebind.example": "127.0.0.1", "internal.example": "10.0.0.5" };
  const realLookup = dns.lookup;
  jest.spyOn(dns, "lookup").mockImplementation((host, options, cb) => {
    if (typeof options === "function") [cb, options] = [options, {}];
    const address = connectTime[host];
    if (!address) return realLookup.call(dns, host, options, cb);
    if (options && options.all) return cb(null, [{ address, family: 4 }]);
    return cb(null, address, 4);
  });
}

// In these tests the fixture (on loopback) stands in for a PUBLIC website, so
// 127.0.0.1 is treated as public, but only when the test says so.
function treatLoopbackAsPublic() {
  const real = validators.isPrivateOrReservedIp;
  jest.spyOn(validators, "isPrivateOrReservedIp").mockImplementation((ip) => (ip === "127.0.0.1" ? false : real(ip)));
}

const scan = (url) =>
  request(app).post("/api/scan").set("Authorization", `Bearer ${user.token}`).send({ url, ownershipConfirmed: true });

beforeAll(async () => {
  await connectTestDb();
  user = await registerUser();
  await startFixture();
});
afterAll(async () => {
  await new Promise((r) => fixture.close(r));
  await disconnectTestDb();
});
beforeEach(() => {
  hits.length = 0;
  process.env.NODE_ENV = "production";
  mockDns();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  process.env.NODE_ENV = "test";
  jest.restoreAllMocks();
});

describe("DEF-009 SSRF via DNS rebinding (check-time != connect-time address)", () => {
  test("scan is refused and the internal address is never contacted", async () => {
    const res = await scan(`http://rebind.example:${port}/`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("The target resolves to a private or internal address.");
    expect(hits).toEqual([]); // nothing reached 127.0.0.1
  });

  test("the file-exposure probes are guarded too", async () => {
    const findings = await checkFileExposure(`http://rebind.example:${port}`);
    expect(findings).toEqual([]);
    expect(hits).toEqual([]);
  });
});

describe("DEF-009 SSRF via redirect from a public site", () => {
  beforeEach(treatLoopbackAsPublic);

  test("control: a normal public page still scans (200)", async () => {
    const res = await scan(`http://public.example:${port}/`);
    expect(res.status).toBe(200);
    expect(hits).toContain("/");
  });

  test("redirect to the cloud metadata IP (169.254.169.254) is blocked", async () => {
    const res = await scan(`http://public.example:${port}/to-metadata`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("The target resolves to a private or internal address.");
  }, 20000);

  test("redirect to a hostname that resolves internally (10.0.0.5) is blocked", async () => {
    const res = await scan(`http://public.example:${port}/to-internal-name`);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("The target resolves to a private or internal address.");
  }, 20000);
});

describe("DEF-009 guard is production-only, like the validator", () => {
  test("development/test mode still lets you scan your own localhost", async () => {
    process.env.NODE_ENV = "test";
    const res = await scan(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
  });
});
