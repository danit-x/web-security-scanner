// Dashboard.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { scanUrl } from '../services/scanService';
import Navbar from '../components/Navbar';

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [apiError, setApiError] = useState('');
  const [isScanning, setIsScanning] = useState(false);

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

    const error = validateUrl(url);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError('');

    if (!ownershipConfirmed) {
      setApiError('Please confirm you own or have permission to scan this site.');
      return;
    }

    setIsScanning(true);

    try {
      const data = await scanUrl(url.trim(), ownershipConfirmed);

      // The backend saves the scan and returns the full document, which
      // includes _id (from savedScan.toJSON() in scanController.js).
      // If for some reason the save failed (data.saved === false, no _id),
      // fall back to passing the result directly via router state instead
      // of navigating to a route that would fail to fetch it.
      if (data._id) {
        navigate(`/report/${data._id}`);
      } else {
        // Rare edge case: scan succeeded but DB save failed. Pass the
        // in-memory result via navigation state so the user still sees
        // something, rather than losing the scan entirely.
        navigate('/report/unsaved', { state: { result: data } });
      }
    } catch (err) {
      const status = err.response?.status;
      const backendMessage = err.response?.data?.message;

      if (status === 429) {
        setApiError(backendMessage || 'Too many scans. Please wait a few minutes and try again.');
      } else if (!err.response) {
        setApiError('Could not connect to the server. Please check your connection and try again.');
      } else {
        setApiError(backendMessage || 'Scan failed. Please try again.');
      }
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <>
      <Navbar />
      <main style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Welcome{user ? `, ${user.name}` : ''}</h1>

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
              disabled={isScanning}
              style={styles.input}
            />

            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={ownershipConfirmed}
                onChange={(e) => setOwnershipConfirmed(e.target.checked)}
                disabled={isScanning}
                style={styles.checkbox}
              />
              <span>
                I confirm I own this website or have explicit permission to scan it.{' '}
                <Link to="/about" style={styles.aboutLink}>
                  Why does this matter?
                </Link>
              </span>
            </label>

            {validationError && <p style={styles.error}>{validationError}</p>}
            {apiError && <p style={styles.error}>{apiError}</p>}

            <button
              type="submit"
              style={{
                ...styles.button,
                opacity: ownershipConfirmed ? 1 : 0.5,
                cursor: ownershipConfirmed ? 'pointer' : 'not-allowed',
              }}
              disabled={isScanning || !ownershipConfirmed}
            >
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
        </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 'calc(100vh - 65px)', // accounts for navbar height
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
  title: { color: '#f8fafc', fontSize: '1.5rem', marginBottom: '1.5rem' },
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
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.6rem',
    color: '#94a3b8',
    fontSize: '0.85rem',
    lineHeight: 1.4,
    marginTop: '0.25rem',
    cursor: 'pointer',
  },
  checkbox: {
    marginTop: '0.15rem',
    cursor: 'pointer',
    flexShrink: 0,
  },
  aboutLink: {
    color: '#60a5fa',
    textDecoration: 'underline',
  },
  loadingContent: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.4)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  error: { color: '#f87171', fontSize: '0.875rem', margin: 0 },
};

export default Dashboard;