import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
    <main className="min-h-screen grid place-items-center bg-bg px-6 py-8">
      <Card className="w-full max-w-md">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-text-primary">Login</h1>
            <p className="text-sm text-text-secondary">Sign in to continue to your dashboard.</p>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {message && <p className="text-sm font-medium text-green-600">{message}</p>}

          <label className="block text-sm font-medium text-text-primary" htmlFor="login-email">
            <span className="mb-1.5 block">Email</span>
            <Input
              id="login-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block text-sm font-medium text-text-primary" htmlFor="login-password">
            <span className="mb-1.5 block">Password</span>
            <Input
              id="login-password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </label>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default Login;