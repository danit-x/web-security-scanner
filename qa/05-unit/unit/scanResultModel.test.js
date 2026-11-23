// OBS-03 (closed in phase 9): the ScanResult schema allowed grade "E", which the
// scorer never produces and the product does not define. The schema must accept
// exactly the grades scoreToGrade() can return. No database needed: validateSync().
const mongoose = require("mongoose");
const ScanResult = require("@server/models/ScanResults");
const { scoreToGrade } = require("@server/utils/scoring");

const doc = (grade) =>
  new ScanResult({
    userId: new mongoose.Types.ObjectId(),
    url: "https://example.com",
    grade,
    score: 50,
    ownershipConfirmed: true,
  });

describe("ScanResult.grade matches the scoring model (OBS-03)", () => {
  // Every grade the scorer can produce, found by walking all scores 0-100.
  const producible = [...new Set(Array.from({ length: 101 }, (_, s) => scoreToGrade(s)))].sort();

  test("the scorer produces exactly A, B, C, D, F", () => {
    expect(producible).toEqual(["A", "B", "C", "D", "F"]);
  });

  test.each(["A", "B", "C", "D", "F"])("grade %s is accepted", (grade) => {
    expect(doc(grade).validateSync()?.errors?.grade).toBeUndefined();
  });

  test.each(["E", "G", "a", ""])("grade %j is rejected", (grade) => {
    expect(doc(grade).validateSync()?.errors?.grade).toBeDefined();
  });
});
