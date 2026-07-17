import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { getScanById } from '../services/scanService';
import Navbar from '../components/Navbar';
import FindingCard from '../components/FindingCard';
import Spinner from '../components/Spinner';

const getGradeColor = (grade) => {
  if (grade === 'A' || grade === 'B') return '#22c55e';
  if (grade === 'C') return '#eab308';
  return '#ef4444';
};

const groupByCategory = (findings) => {
  const grouped = {};
  for (const finding of findings) {
    const key = finding.category || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(finding);
  }
  return grouped;
};

function ReportPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [scan, setScan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Reset state on every id change — otherwise navigating from one
    // report directly to another (e.g. via browser back/forward) could
    // briefly show stale data from the previous scan while the new one loads.
    setScan(null);
    setError('');
    setIsLoading(true);

    if (id === 'unsaved' && location.state?.result) {
      setScan(location.state.result);
      setIsLoading(false);
      return;
    }

    const fetchScan = async () => {
      try {
        const data = await getScanById(id);
        setScan(data.scan);
      } catch (err) {
        // Covers: malformed ID (400 from backend's ObjectId check),
        // not found or belongs to another user (404 — same message for
        // both, per Day 8's "don't leak existence" decision).
        const status = err.response?.status;
        if (status === 400 || status === 404) {
          setError('Scan not found. It may have been deleted, or the link is invalid.');
        } else {
          setError(err.response?.data?.message || 'Could not load this scan result.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchScan();
  }, [id, location.state]);

  return (
    <>
      <Navbar />
      <main style={styles.page}>
        <div style={styles.card}>
          {/* Back link — always visible, even during loading/error, so
              the user is never stuck on a broken/loading page */}
          <Link to="/history" style={styles.backLink}>
            ← Back to History
          </Link>

          {isLoading && <Spinner label="Loading report..." />}

          {error && (
            <div style={styles.errorBox}>
              <p style={styles.error}>{error}</p>
              <button style={styles.errorButton} onClick={() => navigate('/dashboard')}>
                Start a new scan
              </button>
            </div>
          )}

          {!isLoading && !error && scan && (
            <>
              <div style={styles.header}>
                <div style={styles.headerInfo}>
                  <h1 style={styles.url}>{scan.finalUrl || scan.url}</h1>
                  <p style={styles.timestamp}>
                    Scanned{' '}
                    {scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : 'just now'}
                  </p>
                </div>

                <div
                  style={{ ...styles.gradeBadge, backgroundColor: getGradeColor(scan.grade) }}
                >
                  <span style={styles.gradeLetter}>{scan.grade}</span>
                  <span style={styles.gradeScore}>{scan.score}/100</span>
                </div>
              </div>

              <div style={styles.summaryRow}>
                <SummaryPill label="Critical" count={scan.summary?.critical ?? 0} color="#991b1b" />
                <SummaryPill label="High" count={scan.summary?.high ?? 0} color="#ef4444" />
                <SummaryPill label="Medium" count={scan.summary?.medium ?? 0} color="#eab308" />
                <SummaryPill label="Low" count={scan.summary?.low ?? 0} color="#3b82f6" />
              </div>

              <div style={styles.findingsSection}>
                <h2 style={styles.sectionTitle}>Findings</h2>

                {Object.entries(
                  scan.findingsByCategory || groupByCategory(scan.findings || [])
                ).map(([category, categoryFindings]) => (
                  <div key={category} style={styles.categoryGroup}>
                    <h3 style={styles.categoryTitle}>
                      {category} <span style={styles.categoryCount}>({categoryFindings.length})</span>
                    </h3>
                    {categoryFindings.map((finding, index) => (
                      <FindingCard key={index} finding={finding} />
                    ))}
                  </div>
                ))}
              </div>

              {/* Bottom nav — quick actions once you've read the report */}
              <div style={styles.bottomActions}>
                <button style={styles.secondaryButton} onClick={() => navigate('/history')}>
                  View All History
                </button>
                <button style={styles.primaryButton} onClick={() => navigate('/dashboard')}>
                  Scan Another URL
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function SummaryPill({ label, count, color }) {
  return (
    <div style={{ ...pillStyles.pill, borderColor: color }}>
      <span style={{ ...pillStyles.pillCount, color }}>{count}</span>
      <span style={pillStyles.pillLabel}>{label}</span>
    </div>
  );
}

const pillStyles = {
  pill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.5rem 0.9rem',
    borderRadius: '999px',
    border: '1.5px solid',
    backgroundColor: '#0f172a',
  },
  pillCount: { fontSize: '1rem', fontWeight: 700 },
  pillLabel: { color: '#e2e8f0', fontSize: '0.85rem' },
};

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 65px)',
    backgroundColor: '#0f172a',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: '2rem',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '700px',
  },
  backLink: {
    display: 'inline-block',
    color: '#94a3b8',
    fontSize: '0.85rem',
    textDecoration: 'none',
    marginBottom: '1.5rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '1.5rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #334155',
    flexWrap: 'wrap',
  },
  headerInfo: { flex: 1, minWidth: '200px' },
  url: { color: '#f8fafc', fontSize: '1.25rem', wordBreak: 'break-all', marginBottom: '0.25rem' },
  timestamp: { color: '#94a3b8', fontSize: '0.85rem' },
  gradeBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    padding: '0.75rem 1.5rem',
    minWidth: '100px',
    color: '#0f172a',
  },
  gradeLetter: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1 },
  gradeScore: { fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem' },
  summaryRow: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  findingsSection: { marginTop: '0.5rem' },
  sectionTitle: { color: '#f8fafc', fontSize: '1.1rem', marginBottom: '1rem' },
  categoryGroup: { marginBottom: '1.5rem' },
  categoryTitle: {
    color: '#cbd5e1',
    fontSize: '0.95rem',
    fontWeight: 700,
    marginBottom: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  categoryCount: { color: '#64748b', fontWeight: 400, textTransform: 'none' },

  errorBox: { textAlign: 'center', padding: '2rem 1rem' },
  error: { color: '#f87171', fontSize: '0.95rem', marginBottom: '1rem' },
  errorButton: {
    padding: '0.6rem 1.4rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },

  bottomActions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '2rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #334155',
    flexWrap: 'wrap',
  },
  primaryButton: {
    flex: 1,
    padding: '0.7rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    minWidth: '150px',
  },
  secondaryButton: {
    flex: 1,
    padding: '0.7rem',
    backgroundColor: 'transparent',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    minWidth: '150px',
  },
};

export default ReportPage;