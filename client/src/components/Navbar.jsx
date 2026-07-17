// components/Navbar.jsx
// Simple nav bar shown on authenticated pages — links to Dashboard,
// History, and a Logout button. Kept as a separate component so it can
// be dropped into any protected page without duplicating the JSX.

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.left}>
        <Link to="/dashboard" style={styles.link}>
          Dashboard
        </Link>
        <Link to="/history" style={styles.link}>
          History
        </Link>
      </div>
      <div style={styles.right}>
        {user && <span style={styles.userName}>{user.name}</span>}
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  left: { display: 'flex', gap: '1.5rem' },
  right: { display: 'flex', alignItems: 'center', gap: '1rem' },
  link: {
    color: '#e2e8f0',
    textDecoration: 'none',
    fontSize: '0.95rem',
  },
  userName: { color: '#94a3b8', fontSize: '0.875rem' },
  logoutButton: {
    padding: '0.4rem 0.9rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};

export default Navbar;