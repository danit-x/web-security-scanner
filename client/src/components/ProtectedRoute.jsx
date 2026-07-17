// components/ProtectedRoute.jsx
// Wraps any route that requires login. Redirects to /login if there's no
// valid authenticated user, otherwise renders the requested page.

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  // While AuthContext is still verifying a stored token on app load, don't
  // redirect yet — otherwise a refreshed page would flash to /login even
  // for a genuinely logged-in user, since isAuthenticated starts false
  // before the check completes.
  if (isLoading) {
    return <p>Loading...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;