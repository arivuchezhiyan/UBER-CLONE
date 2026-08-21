import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDriverUpiId, updateDriverUpiId, getDriverWallet, requestWithdrawal, updateUserProfile, getWalletBalance } from '../services/api';
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
  const [customerWallet, setCustomerWallet] = useState(user?.walletBalance || 0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Edit profile states
  const [editName, setEditName] = useState(user?.name || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');

  const isDriver = user?.userType === 'driver';

  // Fetch wallet & profile data
  useEffect(() => {
    if (isDriver) {
      fetchDriverData();
    } else {
      getWalletBalance()
        .then(res => {
          if (res.data?.success) {
            setCustomerWallet(res.data.balance || 0);
          }
        })
        .catch(() => {});
    }
  }, [isDriver]);

  const fetchDriverData = async () => {
    try {
      const [upiRes, walletRes] = await Promise.all([
        getDriverUpiId(),
        getDriverWallet()
      ]);
      setUpiId(upiRes.data?.upiId || '');
      setNewUpiId(upiRes.data?.upiId || '');
      setDriverWallet(walletRes.data?.balance || 0);
      setWithdrawals(walletRes.data?.withdrawals || []);
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
    {
      id: 'trips',
      icon: (
        <div className="menu-icon-badge trips">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H7.5a1 1 0 0 0-.8.4L4 11l-5.16.86a1 1 0 0 0-.84.99V16h3"/>
            <circle cx="6.5" cy="16.5" r="2.5"/>
            <circle cx="16.5" cy="16.5" r="2.5"/>
          </svg>
        </div>
      ),
      label: 'My Trips',
      subtitle: 'Past activity, receipts & invoices',
      action: () => navigate('/history')
    },
    ...(isDriver ? [
      {
        id: 'driver_wallet',
        icon: (
          <div className="menu-icon-badge wallet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="3"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
              <circle cx="17" cy="15" r="1.5" fill="#34d399"/>
            </svg>
          </div>
        ),
        label: `Driver Wallet (₹${driverWallet})`,
        subtitle: 'Earnings & instant bank payout',
        action: () => setShowWalletModal(true)
      },
      {
        id: 'documents',
        icon: (
          <div className="menu-icon-badge docs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
        ),
        label: 'Vehicle & KYC Documents',
        subtitle: 'Verified license & registration',
        action: () => navigate('/driver/documents')
      }
    ] : [
      {
        id: 'cust_wallet',
        icon: (
          <div className="menu-icon-badge wallet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="3"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
              <circle cx="17" cy="15" r="1.5" fill="#34d399"/>
            </svg>
          </div>
        ),
        label: `PickMe Cash Wallet (₹${customerWallet})`,
        subtitle: 'Fast 1-tap checkout & refunds',
        action: () => alert(`Your PickMe Cash Balance is ₹${customerWallet}`)
      }
    ]),
    ...(user?.userType === 'admin' || user?.role === 'ADMIN' ? [
      {
        id: 'admin',
        icon: (
          <div className="menu-icon-badge admin">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </div>
        ),
        label: 'Admin Control Center',
        subtitle: 'System management & metrics',
        action: () => navigate('/admin')
      }
    ] : []),
    {
      id: 'promo',
      icon: (
        <div className="menu-icon-badge promo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
        </div>
      ),
      label: 'Promotions & Coupons',
      subtitle: 'Exclusive discounts & VIP codes',
      action: () => {}
    },
    {
      id: 'rate',
      icon: (
        <div className="menu-icon-badge rate">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
      ),
      label: 'Rate & Review App',
      subtitle: 'Share feedback & experience',
      action: () => {}
    },
    {
      id: 'help',
      icon: (
        <div className="menu-icon-badge help">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
      ),
      label: 'Help & 24/7 Support',
      subtitle: 'Safety, ride assistance & FAQs',
      action: () => {}
    },
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="profile-page">
      {/* Background Glow Blobs */}
      <div className="profile-ambient-glow glow-1"></div>
      <div className="profile-ambient-glow glow-2"></div>

      {/* Header */}
      <header className="profile-header">
        <BackButton to="/" label="Back" theme="dark" />
        <span className="profile-header-title">Account & Profile</span>
        <div style={{ width: '40px' }}></div>
      </header>

      <div className="profile-content-container">
        {/* Profile Card */}
        <div className="profile-card">
          <div className="profile-avatar-container">
            <div className="profile-avatar">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="avatar-verified-badge" title="Verified Rider">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          </div>

          <div className="profile-info">
            <div className="profile-name-row">
              <h2 className="profile-name">{user?.name || 'Alex Rider'}</h2>
              <span className="royal-member-tag">ROYAL VIP</span>
            </div>
            <p className="profile-phone">{user?.phone || '+91 90000 00001'}</p>
          </div>

          <button className="edit-btn" onClick={() => setShowEditModal(true)} title="Edit Profile Details">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-value-box">
              <span className="stat-value">4.92</span>
              <span className="stat-icon-sparkle">★</span>
            </div>
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
        <div className="safety-banner" onClick={() => alert('Safety Toolkit: Emergency SOS & Live GPS sharing is Active.')}>
          <div className="safety-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <div className="safety-content">
            <div className="safety-title-row">
              <h3>Safety Center</h3>
              <span className="safety-active-pill">24/7 Active</span>
            </div>
            <p>Manage your safety preferences and emergency contacts</p>
          </div>
          <div className="menu-arrow-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>

        {/* Menu */}
        <div className="profile-menu">
          {menuItems.map((item) => (
            <div key={item.id} className="menu-item" onClick={item.action}>
              {item.icon}
              <div className="menu-label-box">
                <span className="menu-label">{item.label}</span>
                {item.subtitle && <span className="menu-sublabel">{item.subtitle}</span>}
              </div>
              <div className="menu-arrow-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button className="logout-btn" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign Out</span>
        </button>

        {/* Version */}
        <p className="app-version">PickMe Royal • Version 2.4.0 (Build 2026)</p>
      </div>

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
