import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { registerUser } from '../services/api';
import BackButton from '../components/BackButton/BackButton';
import './RegisterPage.css';

function RegisterPage({ onLogin }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    userType: 'customer'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    setError('');
  };

  const nextStep = () => {
    if (step === 1 && formData.phone.length < 10) {
      setError('Enter a valid phone number');
      return;
    }
    if (step === 2 && (!formData.firstName || !formData.lastName)) {
      setError('Please enter your full name');
      return;
    }
    if (step === 3 && !formData.email.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    if (step === 4 && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        userType: formData.userType
      };
      
      const response = await registerUser(payload);
      localStorage.setItem('token', response.data.token);
      onLogin(response.data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-app">
      <div className="register-content">
        {/* Top Header with Back Navigation */}
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {step === 1 ? (
            <BackButton to="/login" label="Login" />
          ) : (
            <BackButton onClick={() => setStep(step - 1)} label="Back" />
          )}
          <h1 className="logo" style={{ margin: 0 }}>Uber</h1>
          <div style={{ width: '60px' }}></div>
        </div>

        {/* Progress */}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(step / 5) * 100}%` }}></div>
        </div>

        {/* Step 1: Phone */}
        {step === 1 && (
          <div className="register-form">
            <h2>Enter your mobile number</h2>
            <div className="phone-field">
              <div className="country-prefix">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                type="tel"
                placeholder="Mobile number"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                maxLength="10"
                autoFocus
              />
            </div>
            {error && <p className="error-msg">{error}</p>}
            <button className="continue-btn" onClick={nextStep}>Continue</button>
            <p className="login-link">Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
        )}

        {/* Step 2: Name */}
        {step === 2 && (
          <div className="register-form">
            <h2>What's your name?</h2>
            <input
              type="text"
              className="input-field"
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              autoFocus
            />
            <input
              type="text"
              className="input-field"
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
            />
            {error && <p className="error-msg">{error}</p>}
            <button className="continue-btn" onClick={nextStep}>Continue</button>
          </div>
        )}

        {/* Step 3: Email */}
        {step === 3 && (
          <div className="register-form">
            <h2>What's your email?</h2>
            <input
              type="email"
              className="input-field"
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              autoFocus
            />
            {error && <p className="error-msg">{error}</p>}
            <button className="continue-btn" onClick={nextStep}>Continue</button>
          </div>
        )}

        {/* Step 4: Password */}
        {step === 4 && (
          <div className="register-form">
            <h2>Create a password</h2>
            <input
              type="password"
              className="input-field"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              autoFocus
            />
            {error && <p className="error-msg">{error}</p>}
            <button className="continue-btn" onClick={nextStep}>Continue</button>
          </div>
        )}

        {/* Step 5: User Type */}
        {step === 5 && (
          <div className="register-form">
            <h2>How will you use Uber?</h2>
            
            <div 
              className={`type-card ${formData.userType === 'customer' ? 'selected' : ''}`}
              onClick={() => handleChange('userType', 'customer')}
            >
              <div className="type-emoji">🚗</div>
              <div className="type-content">
                <h3>Ride</h3>
                <p>Request rides to get where you need to go</p>
              </div>
              {formData.userType === 'customer' && <span className="check">✓</span>}
            </div>

            <div 
              className={`type-card ${formData.userType === 'driver' ? 'selected' : ''}`}
              onClick={() => handleChange('userType', 'driver')}
            >
              <div className="type-emoji">💰</div>
              <div className="type-content">
                <h3>Drive & Earn</h3>
                <p>Make money driving on your schedule</p>
              </div>
              {formData.userType === 'driver' && <span className="check">✓</span>}
            </div>

            {error && <p className="error-msg">{error}</p>}
            <button className="continue-btn" onClick={handleRegister} disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        )}

        <p className="terms-text">
          By signing up, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
