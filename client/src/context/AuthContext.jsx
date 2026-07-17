// context/AuthContext.jsx
// Global auth state — holds the current user + token, and exposes
// login/logout functions so any component can read or change auth state
// without prop-drilling.

import { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // isLoading covers the brief window on app load where we're checking
  // localStorage + verifying the token against the backend. Consumers
  // (like ProtectedRoute) should wait for this before deciding whether
  // to redirect to /login, otherwise a valid logged-in user would get
  // bounced to /login for a split second on every page refresh.
  const [isLoading, setIsLoading] = useState(true);

  // On mount: check localStorage for a saved token. If one exists, verify
  // it's still valid by calling /api/auth/me rather than blindly trusting it —
  // the token could be expired, or the backend's JWT_SECRET could have
  // changed since it was issued.
useEffect(() => {
  const verifyStoredToken = async () => {
    const storedToken = localStorage.getItem('token');

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      // Interceptor attaches the token automatically now — no need to pass it.
      const data = await getCurrentUser();
      setUser(data.user);
      setToken(storedToken);
    } catch (err) {
      console.error('Stored token invalid, logging out:', err.message);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setIsLoading(false);
    }
  };

  verifyStoredToken();
}, []);

  // Called by Login.jsx after a successful login API call.
  // Centralizes the "what happens when we log in" logic here instead of
  // duplicating localStorage writes across every page that logs a user in.
  const login = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isLoading,
    isAuthenticated: !!token,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook so components just do `const { user, logout } = useAuth();`
// instead of importing useContext + AuthContext everywhere.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}