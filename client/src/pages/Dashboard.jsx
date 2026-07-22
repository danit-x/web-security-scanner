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

      if (data._id) {
        navigate(`/report/${data._id}`);
      } else {
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
      <main className="min-h-[calc(100vh-65px)] bg-[#050000] flex justify-center items-start p-4 sm:p-8">
        {/* Main Card */}
        <div className="w-full max-w-lg p-8 sm:p-12 bg-[#050000]/60 backdrop-blur-xl border border-red-950/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-none relative z-10">
          <div className="space-y-2 text-center border-b border-[#8f706b]/20 pb-6 mb-8">
            <h1 className="text-3xl sm:text-4xl text-white tracking-widest font-metal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] uppercase">
              Welcome{user ? `, ${user.name}` : ''}
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8f706b] font-bold">
              Target Diagnostic System
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input with floating badge style */}
            <label className="block relative group" htmlFor="scan-url">
              <span className="absolute -top-2.5 left-3 bg-[#050000] px-2 text-[10px] uppercase tracking-widest font-bold text-[#8f706b] z-10 border border-[#8f706b]/20 border-b-0">
                Website URL to scan
              </span>
              <input
                id="scan-url"
                type="text"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isScanning}
                className="w-full bg-black/40 border border-[#8f706b]/40 text-white placeholder:text-[#8f706b]/50 focus:border-red-900 focus:bg-black/60 focus:outline-none focus:ring-0 transition-all p-4 pt-5 rounded-none text-sm tracking-wider relative z-0 backdrop-blur-sm disabled:opacity-50"
              />
            </label>

            {/* Checkbox with custom style */}
            <label className="flex items-start gap-3 cursor-pointer group text-xs text-[#8f706b] tracking-wider uppercase leading-relaxed">
              <input
                type="checkbox"
                checked={ownershipConfirmed}
                onChange={(e) => setOwnershipConfirmed(e.target.checked)}
                disabled={isScanning}
                className="mt-0.5 accent-red-900 cursor-pointer h-4 w-4 bg-black/60 border border-[#8f706b]/40 rounded-none focus:ring-0 disabled:cursor-not-allowed"
              />
              <span>
                I confirm I own this website or have explicit permission to scan it.{' '}
                <Link to="/about" className="font-bold text-white underline hover:text-red-700 transition-colors inline-block ml-1">
                  Why does this matter?
                </Link>
              </span>
            </label>

            {/* Error notifications */}
            {validationError && (
              <div className="p-4 bg-red-950/20 border-l-4 border-red-900 text-[#8f706b] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <span className="text-red-700 mr-2 font-metal text-sm">X</span> {validationError}
              </div>
            )}
            {apiError && (
              <div className="p-4 bg-red-950/20 border-l-4 border-red-900 text-[#8f706b] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                <span className="text-red-700 mr-2 font-metal text-sm">X</span> {apiError}
              </div>
            )}

            {/* Action Button */}
<button
  type="submit"
  disabled={isScanning || !ownershipConfirmed}
  className="relative group w-full bg-red-950/30 hover:bg-red-800/50 text-white font-metal text-lg uppercase tracking-widest py-4 border border-red-950 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_15px_rgba(50,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex justify-center items-center overflow-hidden outline-offset-4 focus:outline focus:outline-2 focus:outline-red-600"
>
  {/* Inner Text / Spinner Content */}
  <span className="relative z-20">
    {isScanning ? (
      <span className="flex items-center gap-3 text-sm tracking-widest uppercase">
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        Scanning... Please Wait
      </span>
    ) : (
      'Execute Scan'
    )}
  </span>

  {/* Light Streak / Sheen Effect */}
  <span
    className="absolute left-[-75%] top-0 h-full w-[50%] bg-red-500/20 rotate-12 z-10 blur-lg group-hover:left-[125%] transition-all duration-1000 ease-in-out pointer-events-none"
  ></span>

  {/* Top-Left Corner Frame */}
  <span
    className="w-1/2 transition-all duration-300 block border-red-500/60 absolute h-[20%] border-l-2 border-t-2 top-0 left-0 pointer-events-none"
  ></span>

  {/* Top-Right Corner Frame (Expands down on hover) */}
  <span
    className="w-1/2 transition-all duration-300 block border-red-500/60 absolute group-hover:h-[90%] h-[60%] border-r-2 border-t-2 top-0 right-0 pointer-events-none"
  ></span>

  {/* Bottom-Left Corner Frame (Expands up on hover) */}
  <span
    className="w-1/2 transition-all duration-300 block border-red-500/60 absolute h-[60%] group-hover:h-[90%] border-l-2 border-b-2 left-0 bottom-0 pointer-events-none"
  ></span>

  {/* Bottom-Right Corner Frame */}
  <span
    className="w-1/2 transition-all duration-300 block border-red-500/60 absolute h-[20%] border-r-2 border-b-2 right-0 bottom-0 pointer-events-none"
  ></span>
</button>
          </form>
        </div>
      </main>
    </>
  );
}

export default Dashboard;