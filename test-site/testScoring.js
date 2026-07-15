// test-scoring.js
// Quick manual sanity check for utils/scoring.js — run with:
//   node test-scoring.js
// (from inside the server/ folder). Not part of the app itself, just a
// throwaway script to confirm the math behaves sensibly before wiring
// it into a real scan.

const { calculateGrade } = require("../server/utils/scoring.js");

const runTest = (label, findings) => {
  const result = calculateGrade(findings);
  console.log(`${label}: score=${result.score}, grade=${result.grade}`);
};

console.log("--- Scoring sanity checks ---\n");

// No findings at all — should be a perfect score.
runTest("No findings", []);

// A single LOW finding — should barely move the needle.
runTest("1x LOW", [{ severity: "LOW" }]);

// All LOW severity — several minor issues, should stay in the A/B range.
runTest("All LOW (5 findings)", Array(5).fill({ severity: "LOW" }));

// A single MEDIUM finding.
runTest("1x MEDIUM", [{ severity: "MEDIUM" }]);

// All MEDIUM severity — a handful of real weaknesses.
runTest("All MEDIUM (5 findings)", Array(5).fill({ severity: "MEDIUM" }));

// A single HIGH finding — should still land a B, per the design doc.
runTest("1x HIGH", [{ severity: "HIGH" }]);

// All HIGH severity — should drop hard, likely into D/F territory.
runTest("All HIGH (5 findings)", Array(5).fill({ severity: "HIGH" }));

// A realistic mixed bag — a couple of each severity, like a real scan.
runTest("Realistic mix", [
  { severity: "HIGH" },
  { severity: "MEDIUM" },
  { severity: "MEDIUM" },
  { severity: "LOW" },
  { severity: "LOW" },
]);

// One CRITICAL finding alone — should be a serious hit even by itself.
runTest("1x CRITICAL", [{ severity: "CRITICAL" }]);

// Worst case — a real mess of a site.
runTest("Worst case (CRITICAL + multiple HIGH)", [
  { severity: "CRITICAL" },
  { severity: "HIGH" },
  { severity: "HIGH" },
  { severity: "HIGH" },
  { severity: "MEDIUM" },
]);

// Edge case: an unrecognized severity value (shouldn't crash, should
// just deduct 0 for that entry since it's not in SEVERITY_DEDUCTIONS).
runTest("Unknown severity (defensive check)", [
  { severity: "LOW" },
  { severity: "BANANA" },
]);
