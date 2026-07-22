// Navbar.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false); // mobile menu toggle

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuOpen(false);
  };

  const handleLinkClick = () => setMenuOpen(false); // close menu after navigating on mobile

  return (
    <nav className="bg-[#050000]/80 backdrop-blur-xl border-b border-red-950/80 sticky top-0 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
      <div className="flex justify-between items-center px-4 sm:px-8 py-4 max-w-7xl mx-auto">
        {/* Desktop Navigation Links */}
        <div className="hidden sm:flex items-center gap-8 font-metal tracking-widest text-xs uppercase">
          <Link
            to="/dashboard"
            className="text-[#8f706b] hover:text-white transition-colors duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          >
            Dashboard
          </Link>
          <Link
            to="/history"
            className="text-[#8f706b] hover:text-white transition-colors duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          >
            History
          </Link>
          <Link
            to="/about"
            className="text-[#8f706b] hover:text-white transition-colors duration-200 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
          >
            About
          </Link>
        </div>

        {/* Mobile: hamburger button */}
        <button
          className="sm:hidden text-[#8f706b] hover:text-white text-2xl leading-none transition-colors px-2 py-1 border border-[#8f706b]/20 bg-black/40"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        {/* Desktop Right Side Info & Logout */}
        <div className="hidden sm:flex items-center gap-6">
          {user && (
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#8f706b] border border-[#8f706b]/20 px-3 py-1 bg-black/40">
              User: <span className="text-white ml-1">{user.name}</span>
            </span>
          )}
          <Button
            variant="danger"
            onClick={handleLogout}
            className="bg-red-950/40 hover:bg-red-900/60 text-white font-metal text-xs uppercase tracking-widest px-4 py-2 border border-red-950/80 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_10px_rgba(50,0,0,0.5)] hover:border-red-800"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden flex flex-col gap-2 px-6 pb-6 border-t border-red-950/60 pt-4 bg-[#050000]/95 backdrop-blur-xl font-metal tracking-widest text-xs uppercase">
          <Link
            to="/dashboard"
            onClick={handleLinkClick}
            className="text-[#8f706b] hover:text-white py-2 border-b border-[#8f706b]/10 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            to="/history"
            onClick={handleLinkClick}
            className="text-[#8f706b] hover:text-white py-2 border-b border-[#8f706b]/10 transition-colors"
          >
            History
          </Link>
          <Link
            to="/about"
            onClick={handleLinkClick}
            className="text-[#8f706b] hover:text-white py-2 border-b border-[#8f706b]/10 transition-colors"
          >
            About
          </Link>

          {user && (
            <div className="py-2 text-[10px] uppercase tracking-[0.2em] font-bold text-[#8f706b]">
              User: <span className="text-white">{user.name}</span>
            </div>
          )}

          <Button
            variant="danger"
            onClick={handleLogout}
            className="mt-2 w-full bg-red-950/40 hover:bg-red-900/60 text-white font-metal text-xs uppercase tracking-widest py-3 border border-red-950 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_10px_rgba(50,0,0,0.5)]"
          >
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;