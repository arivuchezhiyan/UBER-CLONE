import React, { useState, useEffect } from 'react';
import '../styles/DriverDashboard.css';

function DriverDashboard({ token, onLogout }) {
  const [activeRides, setActiveRides] = useState([]);
  const [isOnline, setIsOnline] = useState(false);

  return (
    <div className="driver-dashboard">
      <nav className="navbar">
        <h1>🚗 Driver Dashboard</h1>
        <div>
          <button 
            className={`toggle-btn ${isOnline ? 'online' : 'offline'}`}
            onClick={() => setIsOnline(!isOnline)}
          >
            {isOnline ? '🟢 Online' : '⭕ Offline'}
          </button>
          <button onClick={onLogout}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-container">
        {isOnline ? (
          <>
            <div className="stats">
              <div className="stat-card">
                <h3>Today's Earnings</h3>
                <p className="amount">$0</p>
              </div>
              <div className="stat-card">
                <h3>Total Rides</h3>
                <p className="amount">0</p>
              </div>
              <div className="stat-card">
                <h3>Rating</h3>
                <p className="amount">5.0 ⭐</p>
              </div>
            </div>

            <div className="active-rides">
              <h2>Available Rides</h2>
              {activeRides.length === 0 ? (
                <p className="no-rides">No rides available at the moment. Stay online to receive ride requests!</p>
              ) : (
                <div className="rides-list">
                  {activeRides.map((ride) => (
                    <div key={ride._id} className="ride-request">
                      <p><strong>Pickup:</strong> {ride.pickupLocation?.address}</p>
                      <p><strong>Dropoff:</strong> {ride.dropoffLocation?.address}</p>
                      <button className="accept-btn">Accept Ride</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="offline-message">
            <h2>You're offline</h2>
            <p>Go online to start accepting rides and earning money!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverDashboard;
