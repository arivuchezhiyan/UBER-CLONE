import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverUpiId, updateDriverUpiId, getDriverWallet, requestWithdrawal, updateUserProfile } from '../services/api';
import BackButton from '../components/BackButton/BackButton';
import './Profile.css';

function Profile({ user, onLogout }) {
  const navigate = useNavigate();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  
  // Driver specific states
  const [upiId, setUpiId] = useState('');
  const [newUpiId, setNewUpiId] = useState('');
  const [driverWallet, setDriverWallet] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Edit profile states
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');

  const isDriver = user?.userType === 'driver';

  // Fetch driver data
  useEffect(() => {
    if (isDriver) {
      fetchDriverData();
    }
  }, [isDriver]);

  const fetchDriverData = async () => {
    try {
      const [upiRes, walletRes] = await Promise.all([
        getDriverUpiId(),
        getDriverWallet()
      ]);
      setUpiId(upiRes.data.upiId || '');
      setNewUpiId(upiRes.data.upiId || '');
      setDriverWallet(walletRes.data.balance || 0);
      setWithdrawals(walletRes.data.withdrawals || []);
    } catch (err) {
      console.error('Failed to fetch driver data:', err);
    }
  };

  const handleUpdateUpi = async () => {
    if (!newUpiId || !newUpiId.includes('@')) {
      setMessage('Please enter a valid UPI ID (e.g., name@upi)');
      return;
    }
    setLoading(true);
    try {
      await updateDriverUpiId(newUpiId);
      setUpiId(newUpiId);
      setMessage('UPI ID updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update UPI ID');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      setMessage('Please enter a valid amount');
      return;
    }
    if (amount > driverWallet) {
      setMessage('Insufficient wallet balance');
      return;
    }
    setLoading(true);
    try {
      const phone = withdrawPhone || user?.phone;
      const res = await requestWithdrawal(amount, phone);
      setDriverWallet(res.data.newBalance);
      setWithdrawals([res.data.withdrawal, ...withdrawals]);
      setWithdrawAmount('');
      setShowWithdrawModal(false);
      setMessage(`₹${amount} withdrawn successfully to ${phone}`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateUserProfile({ name: editName, email: editEmail });
      setShowEditModal(false);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { icon: '🚗', label: 'My Trips', action: () => navigate('/history') },
    ...(isDriver ? [
      { icon: '📄', label: 'Vehicle & KYC Documents', action: () => navigate('/driver/documents') },
      { icon: '💰', label: 'Wallet & Earnings', action: () => setShowWalletModal(true) }
    ] : []),
    { icon: '⚙️', label: 'Admin Portal', action: () => navigate('/admin') },
    { icon: '🎁', label: 'Promotions', action: () => {} },
    { icon: '⭐', label: 'Rate us', action: () => {} },
    { icon: '❓', label: 'Help', action: () => {} },
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="profile-page">
      {/* Header */}
      <header className="profile-header" style={{ padding: '20px 20px 10px', display: 'flex', alignItems: 'center' }}>
        <BackButton to="/" label="Back" theme="dark" />
      </header>

      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-avatar">
          {user?.name?.charAt(0) || 'U'}
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{user?.name || 'User'}</h2>
          <p className="profile-phone">{user?.phone || '+91 XXXXX XXXXX'}</p>
        </div>
        <button className="edit-btn" onClick={() => setShowEditModal(true)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="profile-stats">
        <div className="stat-card">
          <span className="stat-value">4.92</span>
          <span className="stat-label">Rating</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-card">
          <span className="stat-value">47</span>
          <span className="stat-label">Rides</span>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-card">
          <span className="stat-value">2y</span>
          <span className="stat-label">Member</span>
        </div>
      </div>

      {/* Safety Section */}
      <div className="safety-banner">
        <div className="safety-icon">🛡️</div>
        <div className="safety-content">
          <h3>Safety Center</h3>
          <p>Manage your safety preferences and emergency contacts</p>
        </div>
        <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {/* Menu */}
      <div className="profile-menu">
        {menuItems.map((item, index) => (
          <div key={index} className="menu-item" onClick={item.action}>
            <span className="menu-icon">{item.icon}</span>
            <span className="menu-label">{item.label}</span>
            <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        ))}
      </div>

      {/* Logout */}
      <button className="logout-btn" onClick={handleLogout}>
        <span>🚪</span>
        Sign Out
      </button>

      {/* Version */}
      <p className="app-version">Version 1.0.0</p>

      {/* Message Toast */}
      {message && (
        <div className={`toast-message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Driver UPI Section */}
      {isDriver && (
        <div className="upi-section">
          <h3>💳 UPI Settings</h3>
          <div className="upi-input-group">
            <input
              type="text"
              value={newUpiId}
              onChange={(e) => setNewUpiId(e.target.value)}
              placeholder="Enter your UPI ID (e.g., name@upi)"
              className="upi-input"
            />
            <button 
              className="upi-save-btn" 
              onClick={handleUpdateUpi}
              disabled={loading || newUpiId === upiId}
            >
              {loading ? '...' : 'Save'}
            </button>
          </div>
          {upiId && <p className="current-upi">Current: <strong>{upiId}</strong></p>}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-avatar">
                {user?.name?.charAt(0) || 'U'}
                <button className="change-photo">📷</button>
              </div>
              <div className="form-group">
                <label>Name</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter name" 
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input 
                  type="email" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Enter email" 
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" defaultValue={user?.phone || ''} placeholder="Enter phone" disabled />
              </div>
            </div>
            <div className="modal-footer">
              <button className="save-btn" onClick={handleSaveProfile} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="wallet-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💰 Wallet & Earnings</h3>
              <button className="close-btn" onClick={() => setShowWalletModal(false)}>✕</button>
            </div>
            <div className="wallet-balance">
              <span className="balance-label">Available Balance</span>
              <span className="balance-amount">₹{driverWallet.toFixed(2)}</span>
            </div>
            <button 
              className="withdraw-btn" 
              onClick={() => {
                setWithdrawPhone(user?.phone || '');
                setShowWithdrawModal(true);
              }}
              disabled={driverWallet <= 0}
            >
              Withdraw Money
            </button>
            
            <div className="withdrawals-section">
              <h4>Recent Withdrawals</h4>
              {withdrawals.length === 0 ? (
                <p className="no-withdrawals">No withdrawals yet</p>
              ) : (
                <div className="withdrawals-list">
                  {withdrawals.slice(0, 5).map((w, idx) => (
                    <div key={idx} className={`withdrawal-item ${w.status}`}>
                      <div className="withdrawal-info">
                        <span className="withdrawal-amount">₹{w.amount}</span>
                        <span className="withdrawal-phone">to {w.phone}</span>
                      </div>
                      <div className="withdrawal-meta">
                        <span className={`withdrawal-status ${w.status}`}>{w.status}</span>
                        <span className="withdrawal-date">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="modal-overlay" onClick={() => setShowWithdrawModal(false)}>
          <div className="withdraw-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Withdraw Money</h3>
              <button className="close-btn" onClick={() => setShowWithdrawModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="available-balance">Available: ₹{driverWallet.toFixed(2)}</p>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  max={driverWallet}
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="quick-amounts">
                {[100, 500, 1000].map(amt => (
                  <button 
                    key={amt} 
                    className="quick-amount-btn"
                    onClick={() => setWithdrawAmount(Math.min(amt, driverWallet).toString())}
                    disabled={amt > driverWallet}
                  >
                    ₹{amt}
                  </button>
                ))}
                <button 
                  className="quick-amount-btn"
                  onClick={() => setWithdrawAmount(driverWallet.toString())}
                >
                  All
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowWithdrawModal(false)}>
                Cancel
              </button>
              <button 
                className="confirm-withdraw-btn" 
                onClick={handleWithdraw}
                disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
              >
                {loading ? 'Processing...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;
