// services/scanService.js
import api from "./authService";

export const scanUrl = async (url) => {
  const response = await api.post("/api/scan", { url });
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
