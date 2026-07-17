// services/scanService.js
import api from "./authService"; // shared instance — interceptor attaches the token automatically

// Sends a scan request for the given URL. No token param needed anymore —
// the request interceptor in authService.js attaches it to every request
// made through this shared `api` instance.
export const scanUrl = async (url) => {
  const response = await api.post("/api/scan", { url });
  return response.data;
};
