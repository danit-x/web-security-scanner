// utils/asyncHandler.js
// Wraps an async route/controller function so any rejected promise or
// thrown error is automatically passed to next(error) — which forwards it
// to our global error-handling middleware instead of crashing the process
// or leaving the request hanging.
//
// This is a safety net, NOT a replacement for the specific try/catch blocks
// already inside scanController.js — those still handle expected failures
// (bad URL, DNS failure, etc.) with precise status codes and messages.
// asyncHandler only catches anything that slips past those, e.g. a bug in
// orchestration logic itself.

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
