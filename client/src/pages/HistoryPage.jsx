// pages/HistoryPage.jsx
// Lists all past scans for the logged-in user as a card list, sorted
// most recent first. Each card is clickable and navigates to the full
// report at /report/:id.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScanHistory } from '../services/scanService';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';

// Same grade-color mapping used in ReportPage — kept in sync so a grade
// looks the same color wherever it appears in the app.
const getGradeColor = (grade) => {
  if (grade === 'A' || grade === 'B') return '#22c55e';
  if (grade === 'C') return '#eab308';
  return '#ef4444';
};

function HistoryPage() {
  const navigate = useNavigate();

  const [scans, setScans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getScanHistory();
        // Backend already sorts by createdAt descending (confirmed in
        // scanRoutes.js: .sort({ createdAt: -1 })), so no need to re-sort
        // here. Keeping data.scans as-is trusts that ordering.
        setScans(data.scans);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load scan history.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <>
      <Navbar />
      <main style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.title}>Scan History</h1>

          {isLoading && <Spinner label="Loading history..." />}
          {error && <p style={styles.error}>{error}</p>}

          {/* Empty state — no scans yet for this user */}
          {!isLoading && !error && scans.length === 0 && (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>No scans yet — try scanning a URL!</p>
              <button style={styles.emptyButton} onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </button>
            </div>
          )}

          {/* Scan list */}
          {!isLoading &&
            !error &&
            scans.map((scan) => (
              <div
                key={scan._id}
                style={styles.card}
                onClick={() => navigate(`/report/${scan._id}`)}
                // Basic keyboard accessibility — lets the card be focused
                // and activated with Enter, not just mouse click.
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/report/${scan._id}`);
                }}
              >
                <div style={styles.cardLeft}>
                  <p style={styles.url}>{scan.url}</p>
                  <p style={styles.timestamp}>
                    {scan.scannedAt
                      ? new Date(scan.scannedAt).toLocaleString()
                      : 'Unknown date'}
                  </p>

                  {/* Quick severity summary, same data used in the summary
                      pills on ReportPage — just condensed to one line here */}
                  <p style={styles.summaryLine}>
                    {scan.summary?.critical > 0 && `${scan.summary.critical} Critical, `}
                    {scan.summary?.high > 0 && `${scan.summary.high} High, `}
                    {scan.summary?.medium > 0 && `${scan.summary.medium} Medium, `}
                    {scan.summary?.low > 0 && `${scan.summary.low} Low`}
                    {/* If every count is 0, show a clean fallback instead of a blank line */}
                    {scan.summary &&
                      Object.values(scan.summary).every((count) => count === 0) &&
                      'No issues found'}
                  </p>
                </div>

                <div
                  style={{
                    ...styles.gradeBadge,
                    backgroundColor: getGradeColor(scan.grade),
                  }}
                >
                  <span style={styles.gradeLetter}>{scan.grade}</span>
                  <span style={styles.gradeScore}>{scan.score}</span>
                </div>
              </div>
            ))}
        </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 65px)',
    backgroundColor: '#0f172a',
    padding: '2rem 1rem',
  },
  container: {
    width: '100%',
    maxWidth: '700px',
  },
  title: { color: '#f8fafc', fontSize: '1.5rem', marginBottom: '1.5rem' },
  text: { color: '#e2e8f0', fontSize: '0.95rem' },
  error: { color: '#f87171', fontSize: '0.95rem' },

  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '3rem 1rem',
    backgroundColor: '#1e293b',
    borderRadius: '12px',
  },
  emptyText: { color: '#94a3b8', fontSize: '1rem', marginBottom: '1rem' },
  emptyButton: {
    padding: '0.6rem 1.4rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
  },

  // Scan card
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    marginBottom: '0.75rem',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease',
  },
  cardLeft: { flex: 1, minWidth: 0 }, // minWidth: 0 lets long URLs truncate properly in a flex child
  url: {
    color: '#f8fafc',
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.2rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  timestamp: { color: '#64748b', fontSize: '0.8rem', marginBottom: '0.3rem' },
  summaryLine: { color: '#94a3b8', fontSize: '0.85rem' },

  gradeBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    padding: '0.5rem 1rem',
    minWidth: '64px',
    color: '#0f172a',
    flexShrink: 0,
  },
  gradeLetter: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 },
  gradeScore: { fontSize: '0.7rem', fontWeight: 600, marginTop: '0.15rem' },
};

export default HistoryPage;