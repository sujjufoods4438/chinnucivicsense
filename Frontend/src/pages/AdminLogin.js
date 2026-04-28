import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Auth.css';
import { API_BASE_URL, API_URL } from "../config";

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const trimmedEmail = email.trim().toLowerCase();
        const response = await axios.post(`${API_URL}/auth/admin-login`, {
          email: trimmedEmail,
          password
        });

        if (response.data.success) {
          localStorage.setItem('adminToken', response.data.token);
          localStorage.setItem('adminUser', JSON.stringify(response.data.user));
          navigate('/admin-dashboard');
          return;
        }
      } catch (err) {
        console.log(`Admin login attempt ${attempt} failed:`, err.message);
        lastError = err;
        
        if (attempt === maxRetries) {
          console.error('All admin login attempts failed:', err);
          if (err.response) {
            const errorMsg = err.response.data.message || err.response.data.error || 'Admin login failed';
            setError(errorMsg);
          } else if (err.request) {
            setError(`Backend waking up... Try again in 60s (${API_BASE_URL})`);
          } else {
            setError('Connection error: ' + err.message);
          }
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      };
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>Admin Login</h2>
        <form onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Admin Login'}
          </button>
        </form>
        <p>
          Citizen login? <Link to="/login">Click here</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminLogin;
