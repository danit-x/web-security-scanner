// utils/scoring.js
// Converts a list of findings into a numeric score (0-100) and a letter
// grade (A-F). See docs/scoring-model.md for the full reasoning behind
// these specific numbers — keep that doc in sync if these values change.

const STARTING_SCORE = 100;
const MINIMUM_SCORE = 0;

// Points deducted per finding, based on its severity.
// Matches the severity enum in models/ScanResults.js exactly.
const SEVERITY_DEDUCTIONS = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3,
};

// Score ranges mapped to a letter grade, checked top-down (first match wins).
const GRADE_THRESHOLDS = [
  { minScore: 90, grade: "A" },
  { minScore: 75, grade: "B" },
  { minScore: 60, grade: "C" },
  { minScore: 40, grade: "D" },
  { minScore: 0, grade: "F" },
];

/**
 * Calculates a numeric score (0-100) from a list of findings.
 * Starts at 100, deducts per finding by severity, floors at 0.
 *
 * @param {Array<{severity: string}>} findings
 * @returns {number}
 */
const calculateScore = (findings) => {
  if (!Array.isArray(findings) || findings.length === 0) {
    return STARTING_SCORE;
  }

  let score = STARTING_SCORE;

  for (const finding of findings) {
    // Default to 0 deduction for an unrecognized severity value rather
    // than crashing — defensive against bad data from a check that
    // somehow produced a malformed finding.
    const deduction = SEVERITY_DEDUCTIONS[finding.severity] || 0;
    score -= deduction;
  }

  return Math.max(MINIMUM_SCORE, score);
};

/**
 * Converts a numeric score into a letter grade, per the thresholds above.
 *
 * @param {number} score
 * @returns {string} 'A' | 'B' | 'C' | 'D' | 'F'
 */
const scoreToGrade = (score) => {
  for (const { minScore, grade } of GRADE_THRESHOLDS) {
    if (score >= minScore) {
      return grade;
    }
  }
  return "F"; // unreachable given the thresholds above, but a safe fallback
};

/**
 * Convenience wrapper: takes findings, returns both the score and grade
 * together, since the controller will almost always want both at once.
 *
 * @param {Array<{severity: string}>} findings
 * @returns {{ score: number, grade: string }}
 */
const calculateGrade = (findings) => {
  const score = calculateScore(findings);
  const grade = scoreToGrade(score);
  return { score, grade };
};

module.exports = { calculateScore, scoreToGrade, calculateGrade };
