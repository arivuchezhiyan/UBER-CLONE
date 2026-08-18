import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getAdminDashboard,
  getAdminDrivers,
  updateAdminDriverStatus,
  getAdminRides,
  cancelAdminRide,
  getAdminPricing,
  saveAdminFareRule,
  saveAdminFareModifier,
  getAdminFinance,
  getAdminAuditLogs,
  getAdminSupportTickets,
  updateAdminSupportTicket
} from '../services/api';
import './AdminDashboard.css';

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);

  // Drivers Tab State
  const [drivers, setDrivers] = useState([]);
  const [driverFilter, setDriverFilter] = useState('ALL');
  const [driverSearch, setDriverSearch] = useState('');

  // Rides Tab State
  const [rides, setRides] = useState([]);
  const [rideStatusFilter, setRideStatusFilter] = useState('ALL');

  // Pricing Tab State
  const [fareRules, setFareRules] = useState([]);
  const [fareModifiers, setFareModifiers] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [newModifier, setNewModifier] = useState({ name: '', modifierType: 'SURGE', multiplier: 1.5 });

  // Finance Tab State
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Tickets & Logs
  const [tickets, setTickets] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Toast / notification
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    loadTabContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadTabContent = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const res = await getAdminDashboard();
        if (res.data.success) {
          setStats(res.data.stats);
          setRecentRides(res.data.recentRides || []);
          setRecentLogs(res.data.recentLogs || []);
        }
      } else if (activeTab === 'drivers') {
        const res = await getAdminDrivers(driverFilter, driverSearch);
        if (res.data.success) setDrivers(res.data.drivers || []);
      } else if (activeTab === 'rides') {
        const res = await getAdminRides(rideStatusFilter);
        if (res.data.success) setRides(res.data.rides || []);
      } else if (activeTab === 'pricing') {
        const res = await getAdminPricing();
        if (res.data.success) {
          setFareRules(res.data.fareRules || []);
          setFareModifiers(res.data.modifiers || []);
        }
      } else if (activeTab === 'finance') {
        const res = await getAdminFinance();
        if (res.data.success) {
          setWallets(res.data.wallets || []);
          setTransactions(res.data.recentTransactions || []);
        }
      } else if (activeTab === 'tickets') {
        const res = await getAdminSupportTickets();
        if (res.data.success) setTickets(res.data.tickets || []);
      } else if (activeTab === 'audit') {
        const res = await getAdminAuditLogs();
        if (res.data.success) setAuditLogs(res.data.logs || []);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Driver Status Actions
  const handleDriverStatusUpdate = async (driverId, status, reason = '') => {
    try {
      const res = await updateAdminDriverStatus(driverId, status, reason);
      if (res.data.success) {
        showToast(`Driver status updated to ${status}`);
        loadTabContent();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    }
  };

  // Pricing Rule Save
  const handleSaveRule = async (e) => {
    e.preventDefault();
    try {
      const res = await saveAdminFareRule(editingRule);
      if (res.data.success) {
        showToast('Fare rule saved successfully');
        setEditingRule(null);
        loadTabContent();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save rule', 'error');
    }
  };

  // Create Modifier
  const handleCreateModifier = async (e) => {
    e.preventDefault();
    try {
      const res = await saveAdminFareModifier(newModifier);
      if (res.data.success) {
        showToast(`Modifier '${newModifier.name}' created`);
        setNewModifier({ name: '', modifierType: 'SURGE', multiplier: 1.5 });
        loadTabContent();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create modifier', 'error');
    }
  };

  // Emergency Ride Cancel
  const handleCancelRide = async (rideId) => {
    const reason = prompt('Enter cancellation reason:') || 'Administrative cancellation';
    try {
      const res = await cancelAdminRide(rideId, reason);
      if (res.data.success) {
        showToast('Ride cancelled by admin');
        loadTabContent();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel ride', 'error');
    }
  };

  return (
    <div className="admin-dashboard-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === 'success' ? '✅' : '❌'} {toast.msg}
        </div>
      )}

      {/* Admin Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <h2>🚖 RideNow</h2>
          <span className="badge-admin">Admin Control</span>
        </div>

        <nav className="admin-nav">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            📊 Dashboard
          </button>
          <button className={activeTab === 'drivers' ? 'active' : ''} onClick={() => setActiveTab('drivers')}>
            🚗 Driver Approvals
          </button>
          <button className={activeTab === 'rides' ? 'active' : ''} onClick={() => setActiveTab('rides')}>
            🗺️ Active Rides
          </button>
          <button className={activeTab === 'pricing' ? 'active' : ''} onClick={() => setActiveTab('pricing')}>
            💰 Pricing & Surge
          </button>
          <button className={activeTab === 'finance' ? 'active' : ''} onClick={() => setActiveTab('finance')}>
            💳 Finance & Ledgers
          </button>
          <button className={activeTab === 'tickets' ? 'active' : ''} onClick={() => setActiveTab('tickets')}>
            🎫 Support Tickets
          </button>
          <button className={activeTab === 'audit' ? 'active' : ''} onClick={() => setActiveTab('audit')}>
            📜 System Audit
          </button>
        </nav>

        <div className="admin-footer-actions">
          <button onClick={() => navigate('/')} className="btn-return-app">
            ← Return to App
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <header className="admin-header">
          <div className="header-title">
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p>Production Ride-Booking Management & Real-Time Monitoring</p>
          </div>
          <button className="btn-refresh" onClick={loadTabContent}>
            🔄 Refresh
          </button>
        </header>

        {loading ? (
          <div className="admin-loading">
            <div className="spinner"></div>
            <p>Loading platform metrics...</p>
          </div>
        ) : (
          <div className="admin-content-view">
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && stats && (
              <div className="tab-overview">
                <div className="metrics-grid">
                  <div className="metric-card">
                    <span className="metric-icon">🚗</span>
                    <div className="metric-details">
                      <h4>Total Rides</h4>
                      <h2>{stats.totalRides}</h2>
                      <span className="subtext">{stats.completedRides} Completed · {stats.activeRides} Active</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <span className="metric-icon">👨‍✈️</span>
                    <div className="metric-details">
                      <h4>Driver Fleet</h4>
                      <h2>{stats.totalDrivers}</h2>
                      <span className="subtext">{stats.onlineDrivers} Online · {stats.pendingApprovals} Pending</span>
                    </div>
                  </div>

                  <div className="metric-card highlight">
                    <span className="metric-icon">💰</span>
                    <div className="metric-details">
                      <h4>Platform Commission</h4>
                      <h2>₹{stats.totalPlatformCommission}</h2>
                      <span className="subtext">20% Platform Revenue Share</span>
                    </div>
                  </div>

                  <div className="metric-card">
                    <span className="metric-icon">💳</span>
                    <div className="metric-details">
                      <h4>Driver Payouts</h4>
                      <h2>₹{stats.totalDriverEarnings}</h2>
                      <span className="subtext">₹{stats.totalPaidOut} Settled</span>
                    </div>
                  </div>
                </div>

                <div className="overview-split-section">
                  <div className="panel-card">
                    <h3>📢 Live Activity Stream</h3>
                    <div className="table-responsive">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Ride ID</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Fare</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentRides.map((r) => (
                            <tr key={r._id}>
                              <td><strong>{r.rideNumber || r._id.substring(0, 8)}</strong></td>
                              <td>{r.customerId?.name || 'Customer'}</td>
                              <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
                              <td>₹{r.actualFare || r.estimatedFare}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="panel-card">
                    <h3>📜 Latest System Audit Logs</h3>
                    <ul className="audit-list">
                      {recentLogs.map((log) => (
                        <li key={log._id}>
                          <span className="log-action">{log.action}</span>
                          <span className="log-desc">{log.description}</span>
                          <span className="log-time">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* DRIVERS TAB */}
            {activeTab === 'drivers' && (
              <div className="tab-drivers">
                <div className="filter-bar">
                  <input
                    type="text"
                    placeholder="Search by driver name, phone, license plate..."
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    className="search-input"
                  />
                  <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="filter-select">
                    <option value="ALL">All Drivers</option>
                    <option value="PENDING">Pending Approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="SUSPENDED">Suspended</option>
                  </select>
                  <button onClick={loadTabContent} className="btn-primary">Search</button>
                </div>

                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Phone</th>
                        <th>Vehicle</th>
                        <th>Rating</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((d) => (
                        <tr key={d._id}>
                          <td><strong>{d.name}</strong></td>
                          <td>{d.phone}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 700 }}>{d.vehicleDetails?.model || 'Swift Dzire'}</span>
                              <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>
                                🚗 {d.vehicleDetails?.vehicleType || 'UberGo'} · {d.vehicleDetails?.licensePlate || 'KA 01 XX 1234'}
                              </span>
                            </div>
                          </td>
                          <td>⭐ {d.rating || 5.0}</td>
                          <td><span className={`status-pill ${d.approvalStatus}`}>{d.approvalStatus || 'APPROVED'}</span></td>
                          <td>
                            <div className="action-buttons">
                              {d.approvalStatus !== 'APPROVED' && (
                                <button className="btn-action-approve" onClick={() => handleDriverStatusUpdate(d._id, 'APPROVED')}>
                                  Approve
                                </button>
                              )}
                              {d.approvalStatus !== 'REJECTED' && (
                                <button className="btn-action-reject" onClick={() => handleDriverStatusUpdate(d._id, 'REJECTED', 'Documents incomplete')}>
                                  Reject
                                </button>
                              )}
                              {d.approvalStatus !== 'SUSPENDED' && (
                                <button className="btn-action-suspend" onClick={() => handleDriverStatusUpdate(d._id, 'SUSPENDED', 'Policy violation')}>
                                  Suspend
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RIDES TAB */}
            {activeTab === 'rides' && (
              <div className="tab-rides">
                <div className="filter-bar">
                  <select value={rideStatusFilter} onChange={(e) => setRideStatusFilter(e.target.value)} className="filter-select">
                    <option value="ALL">All Ride Statuses</option>
                    <option value="SEARCHING_DRIVER">Searching Driver</option>
                    <option value="DRIVER_ASSIGNED">Driver Assigned</option>
                    <option value="TRIP_STARTED">Trip In Progress</option>
                    <option value="TRIP_COMPLETED">Completed</option>
                    <option value="CANCELLED_BY_RIDER">Cancelled</option>
                  </select>
                </div>

                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Ride Number</th>
                        <th>Customer</th>
                        <th>Driver</th>
                        <th>Route</th>
                        <th>Fare</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rides.map((r) => (
                        <tr key={r._id}>
                          <td><strong>{r.rideNumber || r._id.substring(0, 8)}</strong></td>
                          <td>{r.customerId?.name || 'Customer'}<br/><small>{r.customerId?.phone}</small></td>
                          <td>{r.driverId?.name || 'Unassigned'}<br/><small>{r.driverId?.phone}</small></td>
                          <td>
                            <div className="route-preview">
                              <span>📍 {r.pickupLocation?.address}</span>
                              <span>🏁 {r.dropoffLocation?.address}</span>
                            </div>
                          </td>
                          <td>₹{r.actualFare || r.estimatedFare} ({r.paymentMethod})</td>
                          <td><span className={`status-pill ${r.status}`}>{r.status}</span></td>
                          <td>
                            {!['TRIP_COMPLETED', 'SETTLED', 'CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER'].includes(r.status) && (
                              <button className="btn-danger-sm" onClick={() => handleCancelRide(r._id)}>
                                Force Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PRICING TAB */}
            {activeTab === 'pricing' && (
              <div className="tab-pricing">
                <div className="panel-card">
                  <h3>💰 Vehicle Category Fare Configuration</h3>
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Distance Type</th>
                          <th>Base Fare</th>
                          <th>Per Km Rate</th>
                          <th>Per Min Rate</th>
                          <th>Min Fare</th>
                          <th>Commission</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fareRules.map((rule) => (
                          <tr key={rule._id}>
                            <td><strong>{rule.vehicleCategory}</strong></td>
                            <td>{rule.distanceType}</td>
                            <td>₹{rule.baseFare}</td>
                            <td>₹{rule.perKmRate}/km</td>
                            <td>₹{rule.perMinuteRate}/min</td>
                            <td>₹{rule.minimumFare}</td>
                            <td>{rule.commissionPercentage}%</td>
                            <td>
                              <button className="btn-action-edit" onClick={() => setEditingRule(rule)}>
                                Edit Rule
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Edit Rule Modal */}
                {editingRule && (
                  <div className="admin-modal">
                    <div className="modal-card">
                      <h3>Edit Fare Rule: {editingRule.vehicleCategory} ({editingRule.distanceType})</h3>
                      <form onSubmit={handleSaveRule}>
                        <div className="form-row">
                          <label>Base Fare (₹)</label>
                          <input type="number" value={editingRule.baseFare} onChange={(e) => setEditingRule({ ...editingRule, baseFare: e.target.value })} required />
                        </div>
                        <div className="form-row">
                          <label>Per Km Rate (₹)</label>
                          <input type="number" value={editingRule.perKmRate} onChange={(e) => setEditingRule({ ...editingRule, perKmRate: e.target.value })} required />
                        </div>
                        <div className="form-row">
                          <label>Per Minute Rate (₹)</label>
                          <input type="number" step="0.1" value={editingRule.perMinuteRate} onChange={(e) => setEditingRule({ ...editingRule, perMinuteRate: e.target.value })} required />
                        </div>
                        <div className="form-row">
                          <label>Minimum Fare (₹)</label>
                          <input type="number" value={editingRule.minimumFare} onChange={(e) => setEditingRule({ ...editingRule, minimumFare: e.target.value })} required />
                        </div>
                        <div className="form-row">
                          <label>Platform Commission (%)</label>
                          <input type="number" value={editingRule.commissionPercentage} onChange={(e) => setEditingRule({ ...editingRule, commissionPercentage: e.target.value })} required />
                        </div>
                        <div className="modal-actions">
                          <button type="button" className="btn-secondary" onClick={() => setEditingRule(null)}>Cancel</button>
                          <button type="submit" className="btn-primary">Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Dynamic Modifiers */}
                <div className="panel-card" style={{ marginTop: '24px' }}>
                  <h3>⚡ Dynamic Surge, Night & Weather Modifiers</h3>
                  <form className="modifier-form" onSubmit={handleCreateModifier}>
                    <input type="text" placeholder="Modifier Name (e.g. Rain Surge)" value={newModifier.name} onChange={(e) => setNewModifier({ ...newModifier, name: e.target.value })} required />
                    <select value={newModifier.modifierType} onChange={(e) => setNewModifier({ ...newModifier, modifierType: e.target.value })}>
                      <option value="SURGE">High Demand Surge</option>
                      <option value="RAIN">Rain / Storm</option>
                      <option value="NIGHT">Night Charges</option>
                      <option value="HOLIDAY">Holiday Multiplier</option>
                    </select>
                    <input type="number" step="0.1" min="1.0" max="3.0" placeholder="Multiplier (e.g. 1.5x)" value={newModifier.multiplier} onChange={(e) => setNewModifier({ ...newModifier, multiplier: e.target.value })} required />
                    <button type="submit" className="btn-primary">Add Modifier</button>
                  </form>

                  <div className="modifiers-list">
                    {fareModifiers.map((m) => (
                      <div key={m._id} className="modifier-badge">
                        <span>{m.name}</span>
                        <strong>{m.multiplier}x</strong>
                        <small>{m.modifierType}</small>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* FINANCE TAB */}
            {activeTab === 'finance' && (
              <div className="tab-finance">
                <div className="panel-card">
                  <h3>💳 Driver Ledger Wallets (Double-Entry System)</h3>
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Wallet Balance</th>
                          <th>Total Earned</th>
                          <th>Commission Paid</th>
                          <th>Total Paid Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {wallets.map((w) => (
                          <tr key={w._id}>
                            <td><strong>{w.driverId?.name || 'Driver'}</strong><br/><small>{w.driverId?.phone}</small></td>
                            <td><strong className="text-success">₹{w.balance}</strong></td>
                            <td>₹{w.totalEarned}</td>
                            <td>₹{w.totalCommissionPaid}</td>
                            <td>₹{w.totalPaidOut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="panel-card" style={{ marginTop: '24px' }}>
                  <h3>📒 Recent Double-Entry Ledger Transactions</h3>
                  <div className="table-responsive">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Driver</th>
                          <th>Type</th>
                          <th>Direction</th>
                          <th>Amount</th>
                          <th>Balance After</th>
                          <th>Idempotency Key</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t._id}>
                            <td>{t.driverId?.name || 'Driver'}</td>
                            <td><span className="type-badge">{t.type}</span></td>
                            <td><strong className={t.direction === 'CREDIT' ? 'text-success' : 'text-danger'}>{t.direction}</strong></td>
                            <td>₹{t.amount}</td>
                            <td>₹{t.balanceAfter}</td>
                            <td><code>{t.idempotencyKey}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TICKETS TAB */}
            {activeTab === 'tickets' && (
              <div className="tab-tickets">
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>User</th>
                        <th>Category</th>
                        <th>Subject</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr key={t._id}>
                          <td><strong>{t.ticketNumber}</strong></td>
                          <td>{t.createdBy?.name} ({t.createdByRole})</td>
                          <td><span className="category-pill">{t.category}</span></td>
                          <td><strong>{t.subject}</strong><br/><small>{t.description}</small></td>
                          <td><span className={`priority-pill ${t.priority}`}>{t.priority}</span></td>
                          <td><span className={`status-pill ${t.status}`}>{t.status}</span></td>
                          <td>
                            {t.status !== 'RESOLVED' && (
                              <button
                                className="btn-action-approve"
                                onClick={async () => {
                                  const resolution = prompt('Enter ticket resolution:');
                                  if (resolution) {
                                    await updateAdminSupportTicket(t._id, 'RESOLVED', resolution);
                                    showToast('Ticket marked RESOLVED');
                                    loadTabContent();
                                  }
                                }}
                              >
                                Resolve
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AUDIT LOGS TAB */}
            {activeTab === 'audit' && (
              <div className="tab-audit">
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>Entity</th>
                        <th>Admin</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log._id}>
                          <td>{new Date(log.createdAt).toLocaleString()}</td>
                          <td><strong className="text-primary">{log.action}</strong></td>
                          <td>{log.entityType}</td>
                          <td>{log.adminId?.name || 'Super Admin'}</td>
                          <td>{log.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
