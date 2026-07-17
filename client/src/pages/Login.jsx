import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext'; // NEW

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth(); // NEW
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

      // Was: localStorage.setItem('token', ...) + localStorage.setItem('user', ...)
      // Now: centralized in AuthContext so context state updates immediately
      // and every other component reading useAuth() re-renders correctly.
      login(data);

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ...rest of the component (JSX) stays exactly the same
}