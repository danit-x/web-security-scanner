// Unit tests for utils/scoring.js, using the EP/BVA designs from Phase 3
// (qa/03-black-box/black-box-design.md) as data-driven Jest tables.
const { calculateScore, scoreToGrade, calculateGrade } = require("@server/utils/scoring");

const findings = (spec) =>
  Object.entries(spec).flatMap(([severity, n]) => Array(n).fill({ severity }));

describe("scoreToGrade: boundary value analysis on every grade threshold", () => {
  test.each([
    [100, "A"], [90, "A"], [89, "B"],
    [75, "B"], [74, "C"],
    [60, "C"], [59, "D"],
    [40, "D"], [39, "F"],
    [0, "F"],
  ])("score %i -> %s", (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });

  test.each([[-1, "F"], [101, "A"], [NaN, "F"]])("out-of-range %p -> %s (robustness)", (score, grade) => {
    expect(scoreToGrade(score)).toBe(grade);
  });
});

describe("calculateScore: each severity deducts its documented points", () => {
  test.each([
    ["CRITICAL", 75], ["HIGH", 85], ["MEDIUM", 92], ["LOW", 97],
  ])("one %s finding -> %i", (severity, expected) => {
    expect(calculateScore([{ severity }])).toBe(expected);
  });
});

describe("calculateGrade: boundaries reached through real deductions", () => {
  test.each([
    [{ CRITICAL: 3, LOW: 8 }, 1, "F"],
    [{ CRITICAL: 4 }, 0, "F"],
    [{ CRITICAL: 3, HIGH: 1, LOW: 4 }, 0, "F"], // raw -2 clamps to 0
    [{ LOW: 3 }, 91, "A"],
    [{ MEDIUM: 1, LOW: 1 }, 89, "B"],
    [{ CRITICAL: 1 }, 75, "B"],
    [{ HIGH: 1, MEDIUM: 1, LOW: 1 }, 74, "C"],
    [{ CRITICAL: 1, HIGH: 1 }, 60, "C"],
    [{ CRITICAL: 1, MEDIUM: 2 }, 59, "D"],
    [{ HIGH: 4 }, 40, "D"],
    [{ CRITICAL: 2, MEDIUM: 1, LOW: 1 }, 39, "F"],
  ])("%o -> %i / %s", (spec, score, grade) => {
    expect(calculateGrade(findings(spec))).toEqual({ score, grade });
  });
});

describe("calculateScore: equivalence classes of the input", () => {
  test.each([
    ["not an array (null)", null, 100],
    ["not an array (object)", { severity: "HIGH" }, 100],
    ["empty array", [], 100],
    ["unknown severity", [{ severity: "UNKNOWN" }], 100],
    ["wrong-case severity", [{ severity: "high" }], 100],
    ["null element (DEF-006)", [null], 100],
    ["undefined element", [undefined], 100],
  ])("%s -> %i", (_label, input, expected) => {
    expect(calculateScore(input)).toBe(expected);
  });
});
