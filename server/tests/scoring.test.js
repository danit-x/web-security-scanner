const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateGrade, scoreToGrade } = require("../utils/scoring");

test("a scan with no findings scores 100 and grade A", () => {
  assert.deepEqual(calculateGrade([]), { score: 100, grade: "A" });
});

test("each severity deducts its documented points", () => {
  const findings = [
    { severity: "CRITICAL" },
    { severity: "HIGH" },
    { severity: "MEDIUM" },
    { severity: "LOW" },
  ];
  assert.deepEqual(calculateGrade(findings), { score: 49, grade: "D" });
});

test("the score never goes below 0", () => {
  const findings = Array(10).fill({ severity: "CRITICAL" });
  assert.deepEqual(calculateGrade(findings), { score: 0, grade: "F" });
});

test("an unrecognised severity deducts nothing", () => {
  assert.equal(calculateGrade([{ severity: "UNKNOWN" }]).score, 100);
});

test("grade boundaries match the scoring model", () => {
  assert.equal(scoreToGrade(90), "A");
  assert.equal(scoreToGrade(89), "B");
  assert.equal(scoreToGrade(75), "B");
  assert.equal(scoreToGrade(74), "C");
  assert.equal(scoreToGrade(60), "C");
  assert.equal(scoreToGrade(59), "D");
  assert.equal(scoreToGrade(40), "D");
  assert.equal(scoreToGrade(39), "F");
});
