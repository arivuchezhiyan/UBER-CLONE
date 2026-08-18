import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { loginUser, forgotPassword, resetPassword } from '../services/api';
import './LoginPage.css';

function LoginPage({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Forgot password
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotPhone, setForgotPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleContinue = () => {
    if (phone.length >= 10) {
      setStep(2);
      setError('');
    } else {
      setError('Enter a valid phone number');
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await loginUser({ phone, password });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    if (forgotPhone.length < 10) return;
    setLoading(true);
    try {
      const response = await forgotPassword(forgotPhone);
      if (response.data.success) {
        setForgotStep(2);
        if (response.data.otp) alert(`Test OTP: ${response.data.otp}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (otp.length !== 6 || newPassword.length < 6) return;
    setLoading(true);
    try {
      await resetPassword(forgotPhone, otp, newPassword);
      setShowForgot(false);
      setForgotStep(1);
      alert('Password reset! Please login.');
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoPhone, demoPassword) => {
    setLoading(true);
    setError('');
    try {
      const response = await loginUser({ phone: demoPhone, password: demoPassword });
      const { token, user } = response.data;
      localStorage.setItem('token', token);
      onLogin(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-app">
      <div className="login-content">
        {/* Logo */}
        <div className="logo-section">
          <h1 className="logo">Uber</h1>
        </div>

        {step === 1 ? (
          <div className="login-form">
            <h2>What's your phone number?</h2>
            
            <div className="phone-field">
              <div className="country-prefix">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                maxLength="10"
                autoFocus
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button 
              className="continue-btn" 
              onClick={handleContinue}
              disabled={phone.length < 10}
            >
              Continue
            </button>

            <div className="divider">
              <span>or</span>
            </div>

            <button className="social-btn google">
              <img src="https://www.google.com/favicon.ico" alt="" />
              Continue with Google
            </button>

            {/* Instant Demo Accounts Selector */}
            <div className="demo-accounts-card" style={{ marginTop: '16px', padding: '14px', background: '#f8fafc', borderRadius: '14px', border: '1px solid #cbd5e1' }}>
              <div style={{ fontWeight: 800, fontSize: '12px', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚡</span>
                <span>Instant 1-Click Demo Login:</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('9000000001', 'password123')}
                  disabled={loading}
                  style={{ padding: '10px 8px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  👤 Demo Rider
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('9000000002', 'password123')}
                  disabled={loading}
                  style={{ padding: '10px 8px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🚗 Car Captain
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('9000000003', 'password123')}
                  disabled={loading}
                  style={{ padding: '10px 8px', background: '#d97706', color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  🛺 Auto Captain
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoLogin('9000000000', 'adminpassword123')}
                  disabled={loading}
                  style={{ padding: '10px 8px', background: '#475569', color: 'white', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  👑 Super Admin
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                Password for Rider/Captains: <strong>password123</strong>
              </div>
            </div>

            <p className="register-link">
              Don't have an account? <Link to="/register">Sign up</Link>
            </p>
          </div>
        ) : (
          <div className="login-form">
            <button className="back-btn" onClick={() => setStep(1)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            
            <h2>Welcome back</h2>
            <p className="phone-display">+91 {phone}</p>

            <input
              type="password"
              className="password-field"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              autoFocus
            />

            {error && <p className="error-msg">{error}</p>}

            <button 
              className="continue-btn" 
              onClick={handleLogin}
              disabled={loading || !password}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <p className="forgot-link" onClick={() => { setShowForgot(true); setForgotPhone(phone); }}>
              Forgot password?
            </p>
          </div>
        )}

        <p className="terms-text">
          By proceeding, you agree to our Terms and Privacy Policy.
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div className="modal-overlay" onClick={() => setShowForgot(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button onClick={() => setShowForgot(false)}>✕</button>
            </div>
            
            {forgotStep === 1 ? (
              <>
                <p>Enter your phone number to receive OTP</p>
                <div className="phone-field">
                  <div className="country-prefix">
                    <span>🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value.replace(/\D/g, ''))}
                    maxLength="10"
                  />
                </div>
                <button className="continue-btn" onClick={handleSendOTP} disabled={loading}>
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </>
            ) : (
              <>
                <p>Enter OTP sent to +91 {forgotPhone}</p>
                <input
                  type="text"
                  className="otp-field"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  maxLength="6"
                />
                <input
                  type="password"
                  className="password-field"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                {error && <p className="error-msg">{error}</p>}
                <button className="continue-btn" onClick={handleResetPassword} disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
