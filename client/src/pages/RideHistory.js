import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserBookings, getDriverBookings } from '../services/api';
import BackButton from '../components/BackButton/BackButton';
import './RideHistory.css';

function RideHistory({ user }) {
  const navigate = useNavigate();
  const isDriver = user?.userType === 'driver';
  const [activeTab, setActiveTab] = useState('all');
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const response = isDriver ? await getDriverBookings() : await getUserBookings();
        const formattedRides = response.data.map(ride => ({
          id: ride._id,
          date: new Date(ride.requestedAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }),
          pickup: ride.pickupLocation?.address || 'Pickup',
          dropoff: ride.dropoffLocation?.address || 'Dropoff',
          fare: ride.actualFare || ride.estimatedFare || 0,
          status: ride.status,
          distance: `${ride.distance || ride.estimatedDistance || 0} km`,
          duration: `${ride.duration || ride.estimatedDuration || 0} min`,
          driver: ride.driverId?.name || 'Driver',
          customer: ride.customerId?.name || 'Customer',
          rating: ride.customerRating || ride.driverRating || null
        }));
        setRides(formattedRides);
      } catch (err) {
        console.error('Failed to fetch rides:', err);
        // Set default empty if no rides
        setRides([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, [isDriver]);

  // Fallback demo data if no rides
  const demoRides = [
    {
      id: 1,
      date: 'Today, 2:30 PM',
      pickup: 'MG Road Metro Station',
      dropoff: 'Indiranagar 100ft Road',
      fare: 149,
      status: 'completed',
      distance: '4.2 km',
      duration: '18 min',
      driver: 'Rajesh K.',
      customer: 'Rahul S.',
      rating: 5
    }
  ];

  const displayRides = rides.length > 0 ? rides : demoRides;

  const filteredRides = activeTab === 'all' 
    ? displayRides 
    : displayRides.filter(r => r.status === activeTab);

  const totalEarnings = displayRides
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.fare || 0), 0);

  if (loading) {
    return (
      <div className="ride-history">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="ride-history">
      {/* Header */}
      <header className="history-header" style={{ padding: '20px 20px 10px' }}>
        <BackButton to="/" label="Back" theme="dark" />
        <h1 style={{ margin: 0, fontSize: '18px' }}>{isDriver ? 'My Earnings' : 'My Trips'}</h1>
        <div style={{ width: '40px' }}></div>
      </header>

      {/* Earnings Summary for Driver */}
      {isDriver && (
        <div className="earnings-overview">
          <div className="earnings-card main">
            <span className="earnings-amount">₹{totalEarnings}</span>
            <span className="earnings-label">Total Earnings</span>
          </div>
          <div className="earnings-row">
            <div className="earnings-card">
              <span className="earnings-amount">{rides.filter(r => r.status === 'completed').length}</span>
              <span className="earnings-label">Completed</span>
            </div>
            <div className="earnings-card">
              <span className="earnings-amount">{rides.filter(r => r.status === 'cancelled').length}</span>
              <span className="earnings-label">Cancelled</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="history-tabs">
        <button 
          className={`tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All
        </button>
        <button 
          className={`tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed
        </button>
        <button 
          className={`tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          Cancelled
        </button>
      </div>

      {/* Rides List */}
      <div className="rides-list">
        {filteredRides.map(ride => (
          <div key={ride.id} className="ride-card">
            <div className="ride-header">
              <span className="ride-date">{ride.date}</span>
              <span className={`ride-status ${ride.status}`}>
                {ride.status === 'completed' ? '✓ Completed' : '✕ Cancelled'}
              </span>
            </div>

            <div className="ride-route">
              <div className="route-points">
                <div className="point">
                  <div className="point-dot green"></div>
                  <span className="point-text">{ride.pickup}</span>
                </div>
                <div className="route-line"></div>
                <div className="point">
                  <div className="point-dot black"></div>
                  <span className="point-text">{ride.dropoff}</span>
                </div>
              </div>
            </div>

            <div className="ride-details">
              <div className="detail-item">
                <span className="detail-label">Fare</span>
                <span className="detail-value">₹{ride.fare}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Distance</span>
                <span className="detail-value">{ride.distance}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Duration</span>
                <span className="detail-value">{ride.duration}</span>
              </div>
            </div>

            <div className="ride-footer">
              <div className="person-info">
                <div className="person-avatar">
                  {(isDriver ? ride.customer : ride.driver).charAt(0)}
                </div>
                <span className="person-name">
                  {isDriver ? ride.customer : ride.driver}
                </span>
              </div>
              {ride.rating && (
                <div className="ride-rating">
                  {[...Array(Math.min(5, Math.max(1, ride.rating)))].map((_, i) => (
                    <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RideHistory;
