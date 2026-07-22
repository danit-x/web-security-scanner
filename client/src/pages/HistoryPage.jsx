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
      <main className="min-h-[calc(100vh-65px)] bg-[#050000] flex justify-center items-start p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          {/* Header Section */}
          <div className="space-y-2 text-center border-b border-[#8f706b]/20 pb-6 mb-8">
            <h1 className="text-3xl sm:text-4xl text-white tracking-widest font-metal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] uppercase">
              Scan History
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8f706b] font-bold">
              Prior Diagnostics Log
            </p>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-12 flex justify-center text-[#8f706b]">
              <Spinner label="Loading history..." />
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-950/20 border-l-4 border-red-900 text-[#8f706b] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] mb-6">
              <span className="text-red-700 mr-2 font-metal text-sm">X</span> {error}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && scans.length === 0 && (
            <div className="text-center py-12 px-6 bg-[#050000]/60 backdrop-blur-xl border border-red-950/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-none space-y-6">
              <p className="text-xs sm:text-sm text-[#8f706b] uppercase tracking-widest font-bold">
                No prior scan records located within the archive.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-red-950/30 hover:bg-red-900/50 text-white font-metal text-sm uppercase tracking-widest px-6 py-3 border border-red-950 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_15px_rgba(50,0,0,0.5)] cursor-pointer inline-block"
              >
                Execute New Scan
              </button>
            </div>
          )}

          {/* Scan Cards List */}
          {!isLoading &&
            !error &&
            scans.map((scan) => (
              <div
                key={scan._id}
                onClick={() => navigate(`/report/${scan._id}`)}
                className="group flex justify-between items-center gap-4 bg-[#050000]/60 backdrop-blur-xl border border-[#8f706b]/30 hover:border-red-900/80 p-5 mb-4 cursor-pointer rounded-none transition-all duration-200 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_15px_rgba(153,27,27,0.3)] relative"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/report/${scan._id}`)}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-white font-mono text-sm tracking-wider truncate group-hover:text-red-400 transition-colors">
                    {scan.url}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[#8f706b]">
                    {scan.scannedAt ? new Date(scan.scannedAt).toLocaleString() : 'Unknown date'}
                  </p>
                  <p className="text-xs text-[#8f706b]/80 tracking-wide pt-1">
                    {scan.summary?.critical > 0 && (
                      <span className="text-red-600 font-bold mr-2">{scan.summary.critical} Critical</span>
                    )}
                    {scan.summary?.high > 0 && (
                      <span className="text-red-500 font-semibold mr-2">{scan.summary.high} High</span>
                    )}
                    {scan.summary?.medium > 0 && (
                      <span className="text-amber-600 mr-2">{scan.summary.medium} Medium</span>
                    )}
                    {scan.summary?.low > 0 && (
                      <span className="text-amber-800 mr-2">{scan.summary.low} Low</span>
                    )}
                    {scan.summary &&
                      Object.values(scan.summary).every((count) => count === 0) &&
                      <span className="text-emerald-700 font-semibold">No issues found</span>}
                  </p>
                </div>
                <div className="shrink-0 pl-2">
                  <GradeBadge grade={scan.grade} score={scan.score} size="small" />
                </div>
              </div>
            ))}
        </div>
      </main>
    </>
  );
}

export default HistoryPage;