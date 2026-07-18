import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const data = await registerUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      login(data);

      setMessage(`Account created for ${data.user.name}`);
      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-bg px-4 py-6 sm:px-6 sm:py-8">
      <Card className="w-full max-w-md p-6 sm:p-10">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-text-primary">Register</h1>
            <p className="text-sm text-text-secondary">Create a new account to start scanning websites.</p>
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {message && <p className="text-sm font-medium text-green-600">{message}</p>}

          <label className="block text-sm font-medium text-text-primary" htmlFor="register-name">
            <span className="mb-1.5 block">Name</span>
            <Input
              id="register-name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block text-sm font-medium text-text-primary" htmlFor="register-email">
            <span className="mb-1.5 block">Email</span>
            <Input
              id="register-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="block text-sm font-medium text-text-primary" htmlFor="register-password">
            <span className="mb-1.5 block">Password</span>
            <Input
              id="register-password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              minLength="6"
              required
            />
          </label>

          <label className="block text-sm font-medium text-text-primary" htmlFor="register-confirm-password">
            <span className="mb-1.5 block">Confirm password</span>
            <Input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              minLength="6"
              required
            />
          </label>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating account...' : 'Register'}
          </Button>
        </form>
      </Card>
    </main>
  );
}

export default Register;