// qa/09-performance-security/jmeter/check-sla.mjs <report-dir> [...]
// Reads JMeter's dashboard statistics.json and checks each request against its
// acceptance threshold (SLA). Prints a table; exit code 1 if any SLA is missed.
import { readFileSync } from "node:fs";
import { join } from "node:path";

// p95 response-time targets (ms). Password hashing (bcrypt, cost 10) is slow on
// purpose, so sign-up and login get a looser target than plain reads.
const SLA = [
  { match: /register|login/, p95: 1500, label: "auth (bcrypt)" },
  { match: /scan/i, p95: 5000, label: "scan (outbound HTTP)" },
  { match: /.*/, p95: 500, label: "read" },
];
const MAX_ERROR_PCT = 1;

let failed = false;
for (const dir of process.argv.slice(2)) {
  const stats = JSON.parse(readFileSync(join(dir, "statistics.json"), "utf8"));
  console.log(`\n## ${dir}`);
  console.log("| Request | Samples | Error % | Mean | p90 | p95 | p99 | Throughput/s | p95 target | Result |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---:|---|");
  const rows = Object.entries(stats).sort(([a], [b]) => (a === "Total") - (b === "Total") || a.localeCompare(b));
  for (const [name, s] of rows) {
    const sla = name === "Total" ? null : SLA.find((r) => r.match.test(name));
    const ok = name === "Total"
      ? s.errorPct <= MAX_ERROR_PCT
      : s.pct2ResTime <= sla.p95 && s.errorPct <= MAX_ERROR_PCT;
    if (!ok) failed = true;
    const r = (n) => Math.round(n);
    console.log(
      `| ${name === "Total" ? "**Total**" : name} | ${s.sampleCount} | ${s.errorPct.toFixed(2)} | ${r(s.meanResTime)} | ${r(s.pct1ResTime)} | ${r(s.pct2ResTime)} | ${r(s.pct3ResTime)} | ${s.throughput.toFixed(1)} | ${sla ? `${sla.p95} ms` : `errors ≤ ${MAX_ERROR_PCT}%`} | ${ok ? "PASS" : "**FAIL**"} |`,
    );
  }
}
process.exit(failed ? 1 : 0);
