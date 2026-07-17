// Dashboard.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Clears token/user from context + localStorage (handled inside
  // AuthContext), then sends the user back to the login page.
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.text}>
          Welcome to your dashboard{user ? `, ${user.name}` : ''}.
        </p>
        <p style={styles.note}>
          This is a placeholder page for authenticated users.
        </p>

        <button style={styles.button} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </main>
  );
}

// Kept in the same file for now, matching the pattern used in
// Login.jsx / Register.jsx. Move to a shared styles file later if
// duplication across pages starts getting annoying.
const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '1rem',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: '2.5rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '420px',
    textAlign: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  title: {
    color: '#f8fafc',
    fontSize: '1.75rem',
    marginBottom: '1rem',
  },
  text: {
    color: '#e2e8f0',
    fontSize: '1rem',
    marginBottom: '0.5rem',
  },
  note: {
    color: '#94a3b8',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  button: {
    padding: '0.6rem 1.4rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
  },
};

export default Dashboard;