// pages/HistoryPage.jsx
// Lists all past scans for the logged-in user as a card list, sorted
// most recent first. Each card is clickable and navigates to the full
// report at /report/:id.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScanHistory } from '../services/scanService';
import Navbar from '../components/Navbar';
import Spinner from '../components/Spinner';
import GradeBadge from '../components/GradeBadge';

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
      <main className="flex justify-center min-h-[calc(100vh-65px)] bg-bg p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <h1 className="text-text-primary text-xl sm:text-2xl mb-4 sm:mb-6">Scan History</h1>

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
                onClick={() => navigate(`/report/${scan._id}`)}
                className="flex justify-between items-center gap-3 sm:gap-4 bg-surface border border-border rounded-lg p-4 sm:p-5 mb-3 cursor-pointer hover:border-primary transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/report/${scan._id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-semibold truncate">{scan.url}</p>
                  <p className="text-text-muted text-xs mb-1">
                    {scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : 'Unknown date'}
                  </p>
                  <p className="text-text-secondary text-sm">
                    {scan.summary?.critical > 0 && `${scan.summary.critical} Critical, `}
                    {scan.summary?.high > 0 && `${scan.summary.high} High, `}
                    {scan.summary?.medium > 0 && `${scan.summary.medium} Medium, `}
                    {scan.summary?.low > 0 && `${scan.summary.low} Low`}
                    {scan.summary &&
                      Object.values(scan.summary).every((count) => count === 0) &&
                      'No issues found'}
                  </p>
                </div>
                <GradeBadge grade={scan.grade} score={scan.score} size="small" />
              </div>
            ))}
        </div>
      </main>
    </>
  );
}

const styles = {
  error: { color: '#f87171', fontSize: '0.95rem' },

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
};

export default HistoryPage;