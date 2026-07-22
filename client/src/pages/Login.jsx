import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    setIsSubmitting(true);

    try {
      const data = await loginUser(formData);
      login(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen grid place-items-center bg-black px-4 py-6 sm:px-6 sm:py-8 overflow-hidden">
      
{/* Background Graphic: WEB SECURITY SCANNER (Bloody & Glowing) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
        <h1 className="font-bloody text-[12vw] leading-[0.85] font-normal text-red-600/50 uppercase tracking-widest text-center transform -rotate-6 animate-pulse drop-shadow-[0_0_35px_rgba(220,38,38,0.6)]">
          Web Security<br />
          Scanner
        </h1>
      </div>

      {/* Dark Glass Filter Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-zinc-950/70 backdrop-blur-[4px] z-0 pointer-events-none" />

      {/* Main Card */}
      <Card className="w-full max-w-md p-8 sm:p-12 bg-[#050000]/60 backdrop-blur-xl border border-red-950/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] rounded-none relative z-10">
        <form className="space-y-8" onSubmit={handleSubmit}>
          
          <div className="space-y-2 text-center border-b border-[#8f706b]/20 pb-6">
            <h2 className="text-4xl text-white tracking-widest font-metal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] uppercase">
              System Access
            </h2>
            <p className="text-xs uppercase tracking-[0.2em] text-[#8f706b] font-bold">
              Authenticate Identity
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-950/20 border-l-4 border-red-900 text-[#8f706b] text-xs font-bold uppercase tracking-widest backdrop-blur-sm shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              <span className="text-red-700 mr-2 font-metal text-sm">X</span> {error}
            </div>
          )}
          {message && (
            <div className="p-4 bg-black/50 border-l-4 border-[#8f706b] text-white text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
              {message}
            </div>
          )}

          <div className="space-y-6">
            <label className="block relative group" htmlFor="login-email">
              <span className="absolute -top-2.5 left-3 bg-[#050000] px-2 text-[10px] uppercase tracking-widest font-bold text-[#8f706b] z-10 border border-[#8f706b]/20 border-b-0">
                Email / ID
              </span>
              <Input
                id="login-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full bg-black/40 border border-[#8f706b]/40 text-white focus:border-red-900 focus:bg-black/60 focus:outline-none focus:ring-0 transition-all p-4 pt-5 rounded-none text-sm tracking-wider relative z-0 backdrop-blur-sm"
              />
            </label>

            <label className="block relative group" htmlFor="login-password">
              <span className="absolute -top-2.5 left-3 bg-[#050000] px-2 text-[10px] uppercase tracking-widest font-bold text-[#8f706b] z-10 border border-[#8f706b]/20 border-b-0">
                Passphrase
              </span>
              <Input
                id="login-password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full bg-black/40 border border-[#8f706b]/40 text-white focus:border-red-900 focus:bg-black/60 focus:outline-none focus:ring-0 transition-all p-4 pt-5 rounded-none text-sm tracking-wider relative z-0 backdrop-blur-sm"
              />
            </label>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-950/30 hover:bg-red-900/50 text-white font-metal text-lg uppercase tracking-widest py-4 border border-red-950 backdrop-blur-md rounded-none transition-all shadow-[inset_0_0_15px_rgba(50,0,0,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Verifying...' : 'Access'}
          </Button>

          <p className="text-center text-sm text-[#8f706b] uppercase tracking-[0.2em]">
            No account?{' '}
            <Link to="/register" className="font-bold text-white hover:text-red-700 transition-colors">
              Create one
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

export default Login;