// A deliberately weak local website used as the ONLY scan target in tests:
// no security headers, an insecure cookie, an old jQuery, a redirect and a 404.
const http = require("http");

function startFixtureSite() {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html", "Set-Cookie": "session=abc123; Path=/" });
      return res.end(`<!doctype html><html><head><title>QA fixture</title>
<script src="/js/jquery-1.12.4.min.js"></script></head><body><h1>Fixture</h1></body></html>`);
    }
    if (req.url === "/redirect") {
      res.writeHead(302, { Location: "/" });
      return res.end();
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("not found");
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      resolve({ url, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// A port that is guaranteed closed: open one, read its number, close it.
function closedPortUrl() {
  return new Promise((resolve) => {
    const s = http.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(`http://127.0.0.1:${port}/`));
    });
  });
}

module.exports = { startFixtureSite, closedPortUrl };
