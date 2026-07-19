import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { getScanById } from '../services/scanService';
import Navbar from '../components/Navbar';
import FindingCard from '../components/FindingCard';
import Spinner from '../components/Spinner';
import GradeBadge from '../components/GradeBadge';

const groupByCategory = (findings) => {
  const grouped = {};
  for (const finding of findings) {
    const key = finding.category || 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(finding);
  }
  return grouped;
};

const SUMMARY_COLORS = {
  Critical: 'border-critical text-critical',
  High: 'border-high text-high',
  Medium: 'border-medium text-medium',
  Low: 'border-low text-low',
};

function ReportPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Initialize state instantly if data already exists in route state
  const [scan, setScan] = useState(() => {
    if (id === 'unsaved' && location.state?.result) {
      return location.state.result;
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(() => {
    if (id === 'unsaved' && location.state?.result) {
      return false;
    }
    return true;
  });

  const [error, setError] = useState('');

  useEffect(() => {
    // 2. If it's 'unsaved', the state initializer handled it. Stop right here.
    if (id === 'unsaved') return;

    const fetchScan = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await getScanById(id);
        setScan(data.scan);
      } catch (err) {
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
  }, [id]); // Removed location.state from dependencies since we only fetch when id changes

  return (
    <>
      <Navbar />
      <main className="flex justify-center min-h-[calc(100vh-65px)] bg-bg p-4 sm:p-8">
        <div className="bg-surface rounded-xl p-5 sm:p-8 w-full max-w-2xl">
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
              <div className="flex justify-between items-start gap-4 mb-6 pb-6 border-b border-border flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <h1 className="text-text-primary text-xl break-all mb-1">
                    {scan.finalUrl || scan.url}
                  </h1>
                  <p className="text-text-secondary text-sm">
                    Scanned {scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : 'just now'}
                  </p>
                </div>

                <GradeBadge grade={scan.grade} score={scan.score} size="large" />
              </div>

              <div className="flex gap-3 mb-6 flex-wrap">
                <SummaryPill label="Critical" count={scan.summary?.critical ?? 0} />
                <SummaryPill label="High" count={scan.summary?.high ?? 0} />
                <SummaryPill label="Medium" count={scan.summary?.medium ?? 0} />
                <SummaryPill label="Low" count={scan.summary?.low ?? 0} />
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

function SummaryPill({ label, count }) {
  return (
    <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border-[1.5px] bg-bg ${SUMMARY_COLORS[label]}`}>
      <span className="text-base font-bold">{count}</span>
      <span className="text-text-primary text-sm">{label}</span>
    </div>
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