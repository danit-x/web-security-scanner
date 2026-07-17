// services/authService.js
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Shared axios instance so every service file (and AuthContext) hits the
// same base URL and can share interceptors later if needed (e.g. auto-logout
// on 401 responses).
const api = axios.create({
  baseURL: API_URL,
});

export const registerUser = async (userData) => {
  const response = await api.post("/api/auth/register", userData);
  return response.data;
};

export const loginUser = async (credentials) => {
  const response = await api.post("/api/auth/login", credentials);
  return response.data;
};

// Verifies a token is still valid by hitting the protected /me route.
// Called on app load so a stale/expired token in localStorage doesn't
// silently leave the user in a broken "logged in but every request 401s" state.
export const getCurrentUser = async (token) => {
  const response = await api.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export default api;
