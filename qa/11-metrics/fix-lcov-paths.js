// fix-lcov-paths.js: EC4206 QA phase 11.
// Jest writes lcov.info with paths relative to server/ ("SF:utils\scoring.js"
// on Windows, "SF:utils/scoring.js" on Linux). SonarQube resolves coverage
// paths from the repo root, so this writes lcov.sonar.info with every path
// rewritten to "server/utils/scoring.js". It also fixes letter case to match
// the real file: the Windows run recorded "models\User.js" but the file in git
// is models/user.js, which a case-sensitive Linux scanner cannot resolve.
//   node qa/11-metrics/fix-lcov-paths.js
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "evidence", "coverage", "jest");
const src = path.join(dir, "lcov.info");
const out = path.join(dir, "lcov.sonar.info");
const repo = path.join(__dirname, "..", "..");

// Walk the path one segment at a time, matching each against the directory
// listing without regard to case. Returns the path unchanged if not found.
function realCase(rel) {
  let cur = repo;
  const parts = [];
  for (const seg of rel.split("/")) {
    let names = [];
    try { names = fs.readdirSync(cur); } catch { return rel; }
    const hit = names.find((n) => n === seg) || names.find((n) => n.toLowerCase() === seg.toLowerCase());
    if (!hit) return rel;
    parts.push(hit);
    cur = path.join(cur, hit);
  }
  return parts.join("/");
}

const fixed = fs
  .readFileSync(src, "utf8")
  .split(/\r?\n/)
  .map((line) => {
    if (!line.startsWith("SF:")) return line;
    const p = line.slice(3).replace(/\\/g, "/");
    if (path.isAbsolute(p)) return "SF:" + p;
    return "SF:" + realCase(p.startsWith("server/") ? p : "server/" + p);
  })
  .join("\n");

fs.writeFileSync(out, fixed);
const files = (fixed.match(/^SF:/gm) || []).length;
console.log(`wrote ${path.relative(process.cwd(), out)} (${files} files)`);
