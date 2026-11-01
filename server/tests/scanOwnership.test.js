const test = require("node:test");
const assert = require("node:assert/strict");
const ScanResult = require("../models/ScanResults");
const {
  updateScanNote,
  deleteScan,
} = require("../controllers/scanController");

const SCAN_ID = "507f1f77bcf86cd799439011";
const OWNER_ID = "507f191e810c19729de860ea";
const OTHER_USER_ID = "507f191e810c19729de860eb";

// A stand-in for a saved scan, so these tests don't need a database.
const fakeScan = () => ({
  userId: OWNER_ID,
  note: "",
  saved: false,
  deleted: false,
  async save() {
    this.saved = true;
  },
  async deleteOne() {
    this.deleted = true;
  },
});

// Resolves once the handler has sent its response. asyncHandler doesn't
// return its promise, so awaiting the handler itself wouldn't wait for it.
const call = (handler, { id = SCAN_ID, userId, note }) =>
  new Promise((resolve, reject) => {
    const req = { params: { id }, userId, body: { note } };
    const res = {
      statusCode: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json() {
        resolve(this);
        return this;
      },
    };
    handler(req, res, reject);
  });

test("the owner can update a scan's note", async (t) => {
  const scan = fakeScan();
  t.mock.method(ScanResult, "findById", async () => scan);

  const res = await call(updateScanNote, { userId: OWNER_ID, note: "Fix CSP" });

  assert.equal(res.statusCode, 200);
  assert.equal(scan.note, "Fix CSP");
  assert.equal(scan.saved, true);
});

test("another user cannot update the note and gets 404", async (t) => {
  const scan = fakeScan();
  t.mock.method(ScanResult, "findById", async () => scan);

  const res = await call(updateScanNote, {
    userId: OTHER_USER_ID,
    note: "Changed",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(scan.note, "");
  assert.equal(scan.saved, false);
});

test("the owner can delete a scan", async (t) => {
  const scan = fakeScan();
  t.mock.method(ScanResult, "findById", async () => scan);

  const res = await call(deleteScan, { userId: OWNER_ID });

  assert.equal(res.statusCode, 200);
  assert.equal(scan.deleted, true);
});

test("another user cannot delete a scan and gets 404", async (t) => {
  const scan = fakeScan();
  t.mock.method(ScanResult, "findById", async () => scan);

  const res = await call(deleteScan, { userId: OTHER_USER_ID });

  assert.equal(res.statusCode, 404);
  assert.equal(scan.deleted, false);
});

test("a missing scan returns 404", async (t) => {
  t.mock.method(ScanResult, "findById", async () => null);

  const res = await call(deleteScan, { userId: OWNER_ID });

  assert.equal(res.statusCode, 404);
});

test("an invalid scan ID returns 400", async () => {
  const res = await call(deleteScan, { id: "not-an-id", userId: OWNER_ID });

  assert.equal(res.statusCode, 400);
});
