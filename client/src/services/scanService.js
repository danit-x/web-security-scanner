// services/scanService.js
import api from "./authService"; // reuse the shared axios instance + base URL

// Sends a scan request for the given URL. Requires the caller's JWT since
// /api/scan is a protected route on the backend.
export const scanUrl = async (url, token) => {
  const response = await api.post(
    "/api/scan",
    { url },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return response.data;
};
