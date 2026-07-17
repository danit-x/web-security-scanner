import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';

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
    <main style={styles.page}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Register</h1>

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.success}>{message}</p>}

        <label style={styles.label} htmlFor="register-name">
          Name
          <input
            id="register-name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label} htmlFor="register-email">
          Email
          <input
            id="register-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label} htmlFor="register-password">
          Password
          <input
            id="register-password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            minLength="6"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label} htmlFor="register-confirm-password">
          Confirm password
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            minLength="6"
            required
            style={styles.input}
          />
        </label>

        <button style={styles.button} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    background: '#f4f7f5',
  },
  form: {
    width: '100%',
    maxWidth: '420px',
    display: 'grid',
    gap: '16px',
    padding: '28px',
    border: '1px solid #d8ded9',
    borderRadius: '8px',
    background: '#ffffff',
  },
  title: {
    fontSize: '28px',
    color: '#17211b',
  },
  label: {
    display: 'grid',
    gap: '8px',
    color: '#253029',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #b9c3bd',
    borderRadius: '6px',
    fontSize: '16px',
  },
  button: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: '6px',
    background: '#23684a',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    color: '#a12626',
    fontWeight: 600,
  },
  success: {
    color: '#23684a',
    fontWeight: 600,
  },
};

export default Register;