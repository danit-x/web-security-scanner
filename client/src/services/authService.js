// services/authService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Shared axios instance used by every service file.
const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor: runs before every single request made through this
// instance. Reads the token straight from localStorage (not React state,
// since interceptors run outside the component tree and can't call hooks)
// and attaches it as a Bearer token automatically. This means individual
// service functions (scanUrl, getHistory, etc.) never need to know or
// care about the token — one less thing to pass around and forget.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: if ANY request comes back 401 (token invalid/expired),
// clear the stale auth data automatically. This handles the case where a
// token expires mid-session — without this, the user would keep seeing
// confusing "failed" errors on every action instead of being logged out
// and sent back to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Full page redirect (not react-router navigate) since this runs
      // outside any component — simplest reliable way to force back to login.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export const registerUser = async (userData) => {
  const response = await api.post("/api/auth/register", userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post("/api/auth/login", credentials);
  return response.data;
};

export const getCurrentUser = async () => {
  // No need to manually attach the header anymore — the interceptor does it.
  const response = await api.get("/api/auth/me");
  return response.data;
};

export default api;
