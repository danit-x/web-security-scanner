// services/scanService.js
import api from "./authService";

// Sends the URL and ownership confirmation together in one payload.
export const scanUrl = async (url, ownershipConfirmed) => {
  const response = await api.post("/api/scan", { url, ownershipConfirmed });
  return response.data;
};

// Fetches a single saved scan result by its MongoDB _id.
// Used by ReportPage.jsx (and later, History.jsx when linking to a past scan).
export const getScanById = async (id) => {
  const response = await api.get(`/api/history/${id}`);
  return response.data;
};

// Fetches all scan results belonging to the logged-in user.
// Not used yet (Day 10), but added now since it lives naturally alongside
// the other scan-related calls.
export const getScanHistory = async () => {
  const response = await api.get("/api/history");
  return response.data;
};

// Adds or edits the note on a saved scan.
export const updateScanNote = async (id, note) => {
  const response = await api.patch(`/api/history/${id}`, { note });
  return response.data;
};

// Permanently deletes a saved scan.
export const deleteScan = async (id) => {
  const response = await api.delete(`/api/history/${id}`);
  return response.data;
};
