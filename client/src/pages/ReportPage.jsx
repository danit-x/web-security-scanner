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
  Critical: 'border-red-900 bg-red-950/30 text-red-500',
  High: 'border-red-950 bg-red-950/20 text-red-600',
  Medium: 'border-amber-900/60 bg-amber-950/20 text-amber-500',
  Low: 'border-[#8f706b]/40 bg-black/40 text-[#8f706b]',
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
  }, [id]);

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-65px)] bg-[#050000] flex justify-center items-start p-4 sm:p-8">
        <div className="bg-[#050000]/60 backdrop-blur-xl border border-red-950/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-none p-6 sm:p-10 w-full max-w-3xl relative z-10">
          <Link
            to="/history"
            className="inline-flex items-center text-xs uppercase tracking-widest font-metal text-[#8f706b] hover:text-white transition-colors mb-6 gap-2"
          >
            <span>←</span> Back to History
          </Link>

          {isLoading && (
            <div className="py-12 flex justify-center text-[#8f706b]">
              <Spinner label="Loading report..." />
            </div>
          )}

          {error && (
            <div className="text-center py-8 space-y-6">
              <div className="p-4 bg-red-950/20 border-l-4 border-red-900 text-[#8f706b] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <span className="text-red-700 mr-2 font-metal text-sm">X</span> {error}
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-red-950/30 hover:bg-red-900/50 text-white font-metal text-xs uppercase tracking-widest px-6 py-3 border border-red-950 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_15px_rgba(50,0,0,0.5)] cursor-pointer"
              >
                Start a new scan
              </button>
            </div>
          )}

          {!isLoading && !error && scan && (
            <>
              {/* Header Section */}
              <div className="flex justify-between items-start gap-4 mb-6 pb-6 border-b border-[#8f706b]/20 flex-wrap">
                <div className="flex-1 min-w-50 space-y-1">
                  <h1 className="text-white font-mono text-lg sm:text-xl break-all tracking-wider">
                    {scan.finalUrl || scan.url}
                  </h1>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#8f706b]">
                    Scanned {scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : 'just now'}
                  </p>
                </div>

                <div className="shrink-0">
                  <GradeBadge grade={scan.grade} score={scan.score} size="large" />
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="flex gap-3 mb-8 flex-wrap">
                <SummaryPill label="Critical" count={scan.summary?.critical ?? 0} />
                <SummaryPill label="High" count={scan.summary?.high ?? 0} />
                <SummaryPill label="Medium" count={scan.summary?.medium ?? 0} />
                <SummaryPill label="Low" count={scan.summary?.low ?? 0} />
              </div>

              {/* Findings Section */}
              <div className="space-y-6">
                <h2 className="text-xl text-white font-metal tracking-widest uppercase border-b border-[#8f706b]/20 pb-2">
                  Findings
                </h2>

                {Object.entries(
                  scan.findingsByCategory || groupByCategory(scan.findings || [])
                ).map(([category, categoryFindings]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-xs uppercase tracking-[0.2em] font-metal text-white border-l-2 border-red-900 pl-3">
                      {category} <span className="text-[#8f706b] font-normal">({categoryFindings.length})</span>
                    </h3>
                    <div className="space-y-3">
                      {categoryFindings.map((finding, index) => (
                        <FindingCard key={index} finding={finding} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row gap-4 mt-10 pt-6 border-t border-[#8f706b]/20">
                <button
                  onClick={() => navigate('/history')}
                  className="flex-1 bg-black/40 hover:bg-black/70 text-[#8f706b] hover:text-white font-metal text-xs uppercase tracking-widest py-3 px-4 border border-[#8f706b]/30 rounded-none transition-all cursor-pointer"
                >
                  View All History
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 bg-red-950/30 hover:bg-red-900/50 text-white font-metal text-xs uppercase tracking-widest py-3 px-4 border border-red-950 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_15px_rgba(50,0,0,0.5)] cursor-pointer"
                >
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
    <div
      className={`flex items-center gap-2 px-4 py-1.5 rounded-none border text-xs font-mono tracking-widest uppercase backdrop-blur-sm ${SUMMARY_COLORS[label]}`}
    >
      <span className="font-bold text-sm">{count}</span>
      <span className="opacity-80">{label}</span>
    </div>
  );
}

export default ReportPage;