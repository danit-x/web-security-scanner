// pages/ReportPage.jsx
// Fetches and displays a single scan result by ID from the URL param.
// Shows a color-coded grade header and a severity summary row before
// the detailed findings (findings list styling itself is Day 10's
// remaining task — this covers the header + summary row specifically).

import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { getScanById } from '../services/scanService';
import Navbar from '../components/Navbar';
import FindingCard from '../components/FindingCard';

// Maps a letter grade to a color — green for good grades, yellow for
// middling, red for bad ones. Centralized here so both the big grade
// badge and any future small grade indicators (e.g. history list) can
// reuse the same mapping consistently.
const getGradeColor = (grade) => {
  if (grade === 'A' || grade === 'B') return '#22c55e'; // green
  if (grade === 'C') return '#eab308'; // yellow
  return '#ef4444'; // red — D, E, F
};

function ReportPage() {
  const { id } = useParams();
  const location = useLocation();

  const [scan, setScan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Edge case from Dashboard.jsx: unsaved scan (DB save failed) passed
    // via router state instead of a real ID.
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
        setError(err.response?.data?.message || 'Could not load this scan result.');
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
          {isLoading && <p style={styles.text}>Loading report...</p>}
          {error && <p style={styles.error}>{error}</p>}

          {scan && (
            <>
              {/* --- Header: URL, timestamp, grade --- */}
              <div style={styles.header}>
                <div style={styles.headerInfo}>
                  <h1 style={styles.url}>{scan.finalUrl || scan.url}</h1>
                  <p style={styles.timestamp}>
                    Scanned{' '}
                    {scan.scannedAt
                      ? new Date(scan.scannedAt).toLocaleString()
                      : 'just now'}
                  </p>
                </div>

                {/* Color-coded grade badge — color comes from getGradeColor,
                    so A/B = green, C = yellow, D/E/F = red */}
                <div
                  style={{
                    ...styles.gradeBadge,
                    backgroundColor: getGradeColor(scan.grade),
                  }}
                >
                  <span style={styles.gradeLetter}>{scan.grade}</span>
                  <span style={styles.gradeScore}>{scan.score}/100</span>
                </div>
              </div>

              {/* --- Severity summary row --- */}
              {/* scan.summary comes straight from the backend schema:
                  { critical, high, medium, low } — always all four keys
                  present even if 0, per the ScanResult model. */}
              <div style={styles.summaryRow}>
                <SummaryPill label="Critical" count={scan.summary?.critical ?? 0} color="#991b1b" />
                <SummaryPill label="High" count={scan.summary?.high ?? 0} color="#ef4444" />
                <SummaryPill label="Medium" count={scan.summary?.medium ?? 0} color="#eab308" />
                <SummaryPill label="Low" count={scan.summary?.low ?? 0} color="#3b82f6" />
              </div>

              {/* --- Raw findings dump for now — replaced with a proper
                  grouped/styled findings list later in Day 10 --- */}
              <pre style={styles.rawJson}>
                {JSON.stringify(scan.findings, null, 2)}
              </pre>
            </>
          )}
        </div>
      </main>
    </>
  );
}

// Small reusable pill for the severity summary row. Kept in the same file
// since it's only used here — pull into its own component file if it ends
// up reused elsewhere (e.g. a dashboard widget later).
function SummaryPill({ label, count, color }) {
  return (
    <div style={{ ...styles.pill, borderColor: color }}>
      <span style={{ ...styles.pillCount, color }}>{count}</span>
      <span style={styles.pillLabel}>{label}</span>
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
  text: { color: '#e2e8f0', fontSize: '0.95rem' },
  error: { color: '#f87171', fontSize: '0.95rem' },

  // Header
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
  url: {
    color: '#f8fafc',
    fontSize: '1.25rem',
    wordBreak: 'break-all',
    marginBottom: '0.25rem',
  },
  timestamp: { color: '#94a3b8', fontSize: '0.85rem' },

  // Grade badge
  gradeBadge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '12px',
    padding: '0.75rem 1.5rem',
    minWidth: '100px',
    color: '#0f172a', // dark text reads better on the bright badge colors
  },
  gradeLetter: { fontSize: '2.25rem', fontWeight: 700, lineHeight: 1 },
  gradeScore: { fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem' },

  // Severity summary row
  summaryRow: {
    display: 'flex',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
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

  // Raw JSON (temporary, Day 10 replaces this)
  rawJson: {
    backgroundColor: '#0f172a',
    color: '#94a3b8',
    padding: '1rem',
    borderRadius: '8px',
    overflowX: 'auto',
    fontSize: '0.8rem',
    border: '1px solid #334155',
  },
};

export default ReportPage;