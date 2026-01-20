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

            <button className="social-btn apple">
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </button>

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
