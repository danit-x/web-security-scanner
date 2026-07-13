import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';

function Login() {
  const navigate = useNavigate();
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

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={styles.page}>
      <form style={styles.form} onSubmit={handleSubmit}>
        <h1 style={styles.title}>Login</h1>

        {error && <p style={styles.error}>{error}</p>}
        {message && <p style={styles.success}>{message}</p>}

        <label style={styles.label} htmlFor="login-email">
          Email
          <input
            id="login-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label} htmlFor="login-password">
          Password
          <input
            id="login-password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={styles.input}
          />
        </label>

        <button style={styles.button} type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in...' : 'Login'}
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

export default Login;
