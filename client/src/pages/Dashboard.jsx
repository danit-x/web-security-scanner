// Dashboard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { scanUrl } from '../services/scanService';

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const validateUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Please enter a URL to scan.';
    if (!/^https?:\/\//i.test(trimmed)) return 'URL must start with http:// or https://';
    try {
      new URL(trimmed);
    } catch {
      return 'Please enter a valid URL.';
    }
    return '';
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
      // No token param needed anymore — the shared axios instance's
      // interceptor attaches it automatically.
      const data = await scanUrl(url.trim());
      setResult(data);
    } catch (err) {
      // Different failure types all land here, all using the backend's
      // consistent { success: false, message } error shape:
      //   - 400: bad/invalid URL, SSRF-blocked target
      //   - 408: target site took too long to respond
      //   - 429: rate limit hit (max 10 scans / 15 min)
      //   - 502: target site unreachable (DNS failure, connection refused, etc.)
      //   - 500: unexpected server error
      const status = err.response?.status;
      const backendMessage = err.response?.data?.message;

      if (status === 429) {
        setApiError(backendMessage || 'Too many scans. Please wait a few minutes and try again.');
      } else if (!err.response) {
        // No response at all usually means a network issue reaching our
        // OWN backend (server down, CORS block, no internet) — distinct
        // from the backend successfully responding that the TARGET site
        // was unreachable.
        setApiError('Could not connect to the server. Please check your connection and try again.');
      } else {
        setApiError(backendMessage || 'Scan failed. Please try again.');
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Welcome{user ? `, ${user.name}` : ''}</h1>
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
            disabled={isScanning} // lock the input while a scan is running
            style={styles.input}
          />

          {validationError && <p style={styles.error}>{validationError}</p>}
          {apiError && <p style={styles.error}>{apiError}</p>}

          <button type="submit" style={styles.button} disabled={isScanning}>
            {isScanning ? (
              <span style={styles.loadingContent}>
                <span style={styles.spinner} />
                Scanning... this can take a few seconds
              </span>
            ) : (
              'Scan'
            )}
          </button>
        </form>

        {result && (
          <div style={styles.resultBox}>
            <h2 style={styles.resultTitle}>
              Grade: {result.grade} ({result.score}/100)
            </h2>
            <p style={styles.text}>Scanned: {result.finalUrl || result.url}</p>
            <p style={styles.text}>Findings: {result.findings?.length ?? 0}</p>
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
  title: { color: '#f8fafc', fontSize: '1.5rem' },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  label: { color: '#e2e8f0', fontSize: '0.9rem' },
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
    display: 'flex',
    justifyContent: 'center',
  },
  loadingContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  // Simple CSS spinner using a border trick — no extra library needed.
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  error: { color: '#f87171', fontSize: '0.875rem', margin: 0 },
  text: { color: '#e2e8f0', fontSize: '0.95rem' },
  resultBox: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #334155',
  },
  resultTitle: { color: '#f8fafc', fontSize: '1.25rem', marginBottom: '0.5rem' },
};

export default Dashboard;