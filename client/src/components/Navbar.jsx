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
    <nav className="bg-surface border-b border-border">
      <div className="flex justify-between items-center px-4 sm:px-8 py-4">
        <div className="hidden sm:flex gap-6">
          <Link to="/dashboard" className="text-text-primary text-sm hover:text-primary transition-colors">
            Dashboard
          </Link>
          <Link to="/history" className="text-text-primary text-sm hover:text-primary transition-colors">
            History
          </Link>
          <Link to="/about" className="text-text-primary text-sm hover:text-primary transition-colors">
            About
          </Link>
        </div>

        {/* Mobile: hamburger button, only shown below sm breakpoint */}
        <button
          className="sm:hidden text-text-primary text-2xl leading-none"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>

        <div className="hidden sm:flex items-center gap-4">
          {user && <span className="text-text-secondary text-sm">{user.name}</span>}
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile dropdown — simple stacked links, only rendered when open */}
      {menuOpen && (
        <div className="sm:hidden flex flex-col gap-1 px-4 pb-4 border-t border-border pt-3">
          <Link to="/dashboard" onClick={handleLinkClick} className="text-text-primary text-sm py-2">
            Dashboard
          </Link>
          <Link to="/history" onClick={handleLinkClick} className="text-text-primary text-sm py-2">
            History
          </Link>
          <Link to="/about" onClick={handleLinkClick} className="text-text-primary text-sm py-2">
            About
          </Link>
          {user && <span className="text-text-secondary text-sm py-2">{user.name}</span>}
          <Button variant="danger" onClick={handleLogout} className="mt-1 w-full">
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;