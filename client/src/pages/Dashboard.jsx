// Dashboard.jsx
// Main landing page after login. Lets the user submit a URL to scan and
// shows a basic result once the scan completes.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { scanUrl } from '../services/scanService';

function Dashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null); // holds the scan report once one comes back

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Client-side validation before we even attempt the API call — catches
  // the obvious mistakes instantly instead of making the user wait on a
  // round trip just to be told "URL must start with http://".
  // NOTE: this is a UX convenience only. The backend still validates
  // (and enforces SSRF protection) independently — never trust the
  // frontend check alone for security.
  const validateUrl = (value) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return 'Please enter a URL to scan.';
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return 'URL must start with http:// or https://';
    }

    try {
      new URL(trimmed);
    } catch {
      return 'Please enter a valid URL.';
    }

    return ''; // no error
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setApiError('');
    setResult(null);

    const error = validateUrl(url);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError('');

    setIsScanning(true);
    try {
      const data = await scanUrl(url.trim(), token);
      setResult(data);
    } catch (err) {
      // Covers backend validation errors (bad URL, SSRF block), rate
      // limiting (429), and site-unreachable errors (502/408) — all of
      // which come back with a "message" field from our consistent
      // error response shape.
      setApiError(err.response?.data?.message || 'Scan failed. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>
            Welcome{user ? `, ${user.name}` : ''}
          </h1>
          <button style={styles.logoutButton} onClick={handleLogout}>
            Logout
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="scan-url">
            Website URL to scan
          </label>
          <input
            id="scan-url"
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={styles.input}
          />

          {validationError && <p style={styles.error}>{validationError}</p>}
          {apiError && <p style={styles.error}>{apiError}</p>}

          <button type="submit" style={styles.button} disabled={isScanning}>
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </form>

        {/* Minimal result display for now — real dashboard styling comes
            on Day 10/11. Just proving the flow works end to end. */}
        {result && (
          <div style={styles.resultBox}>
            <h2 style={styles.resultTitle}>
              Grade: {result.grade} ({result.score}/100)
            </h2>
            <p style={styles.text}>Scanned: {result.finalUrl || result.url}</p>
            <p style={styles.text}>
              Findings: {result.findings?.length ?? 0}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: '2.5rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    color: '#f8fafc',
    fontSize: '1.5rem',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    color: '#e2e8f0',
    fontSize: '0.9rem',
  },
  input: {
    padding: '0.7rem',
    borderRadius: '6px',
    border: '1px solid #334155',
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    fontSize: '1rem',
  },
  button: {
    marginTop: '0.5rem',
    padding: '0.7rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
  },
  error: {
    color: '#f87171',
    fontSize: '0.875rem',
    margin: 0,
  },
  text: {
    color: '#e2e8f0',
    fontSize: '0.95rem',
  },
  resultBox: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #334155',
  },
  resultTitle: {
    color: '#f8fafc',
    fontSize: '1.25rem',
    marginBottom: '0.5rem',
  },
};

export default Dashboard;