import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from './ui/Button';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="flex justify-between items-center px-8 py-4 bg-surface border-b border-border">
      <div className="flex gap-6">
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
      <div className="flex items-center gap-4">
        {user && <span className="text-text-secondary text-sm">{user.name}</span>}
        <Button variant="danger" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </nav>
  );
}

export default Navbar;