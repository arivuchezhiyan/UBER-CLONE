import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RideMap from '../components/Map/RideMap';
import './CustomerHome.css';

function CustomerHome({ user }) {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [activeField, setActiveField] = useState('dropoff');

  const suggestedPlaces = [
    { id: 1, name: 'Home', address: 'Koramangala 4th Block', icon: '🏠', saved: true },
    { id: 2, name: 'Work', address: 'Whitefield Tech Park', icon: '💼', saved: true },
    { id: 3, name: 'Bangalore Airport', address: 'Kempegowda International Airport', icon: '✈️' },
    { id: 4, name: 'MG Road', address: 'MG Road Metro Station', icon: '🚇' },
    { id: 5, name: 'Indiranagar', address: '100 Feet Road, Indiranagar', icon: '📍' },
    { id: 6, name: 'Koramangala', address: 'Sony World Signal', icon: '📍' },
  ];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setPickup('Current location');
        },
        () => {
          setCurrentLocation({ lat: 12.9716, lng: 77.5946 });
          setPickup('Current location');
        }
      );
    }
  }, []);

  const handlePlaceSelect = (place) => {
    if (activeField === 'pickup') {
      setPickup(place.name);
    } else {
      setDropoff(place.name);
      // Navigate to booking when destination is selected
      setTimeout(() => {
        navigate('/book', { state: { pickup: pickup || 'Current location', dropoff: place.name } });
      }, 200);
    }
  };

  const handleConfirm = () => {
    if (pickup && dropoff) {
      navigate('/book', { state: { pickup, dropoff } });
    }
  };

  // Main screen with map
  if (!showSearch) {
    return (
      <div className="uber-home">
        {/* Full Screen Map */}
        <div className="uber-map-wrapper">
          {currentLocation && (
            <RideMap
              pickup={[currentLocation.lat, currentLocation.lng]}
              height="100%"
            />
          )}
        </div>

        {/* Top Bar */}
        <div className="uber-top-bar" style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100
        }}>
          <button className="uber-menu-btn" onClick={() => navigate('/profile')} title="My Profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/history')}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>🚗</span>
              <span>Trips</span>
            </button>

            <button
              onClick={() => navigate('/admin')}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>⚙️</span>
              <span>Admin</span>
            </button>
          </div>
        </div>

        {/* Bottom Card */}
        <div className="uber-bottom-card">
          {/* Greeting */}
          <div className="uber-greeting">
            <span className="greeting-wave">👋</span>
            <span className="greeting-text">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0] || 'there'}
            </span>
          </div>

          {/* Where to? Search Bar */}
          <div className="uber-search-bar" onClick={() => setShowSearch(true)}>
            <div className="search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <span className="search-placeholder">Where to?</span>
            <div className="search-divider"></div>
            <button className="search-now-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              Now
              <svg viewBox="0 0 24 24" fill="currentColor" width="12">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="uber-suggestions">
            {suggestedPlaces.slice(0, 2).map(place => (
              <div 
                key={place.id} 
                className="suggestion-item"
                onClick={() => {
                  setDropoff(place.name);
                  navigate('/book', { state: { pickup: pickup || 'Current location', dropoff: place.name } });
                }}
              >
                <div className="suggestion-icon">{place.icon}</div>
                <div className="suggestion-info">
                  <span className="suggestion-name">{place.name}</span>
                  <span className="suggestion-address">{place.address}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Services Grid */}
          <div className="uber-services">
            <div className="service-item" onClick={() => setShowSearch(true)}>
              <div className="service-icon-wrapper">
                <img src="https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png" alt="Ride" className="service-img"/>
              </div>
              <span>Ride</span>
            </div>
            <div className="service-item">
              <div className="service-icon-wrapper">
                <img src="https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Moto.png" alt="Two Wheeler" className="service-img"/>
              </div>
              <span>Two Wheeler</span>
            </div>
            <div className="service-item">
              <div className="service-icon-wrapper package">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
              </div>
              <span>Package</span>
            </div>
            <div className="service-item">
              <div className="service-icon-wrapper rentals">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </div>
              <span>Rentals</span>
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <nav className="uber-nav">
          <div className="nav-item active">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span>Home</span>
          </div>
          <div className="nav-item" onClick={() => navigate('/history')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Activity</span>
          </div>
          <div className="nav-item" onClick={() => navigate('/profile')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Account</span>
          </div>
        </nav>
      </div>
    );
  }

  // Search screen
  return (
    <div className="uber-search-screen">
      {/* Header */}
      <div className="search-header">
        <button className="back-btn" onClick={() => setShowSearch(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        
        <div className="location-inputs">
          <div className="input-row">
            <div className="input-dot pickup"></div>
            <input
              type="text"
              placeholder="Pickup location"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              onFocus={() => setActiveField('pickup')}
              className={activeField === 'pickup' ? 'active' : ''}
            />
          </div>
          <div className="input-connector"></div>
          <div className="input-row">
            <div className="input-dot dropoff"></div>
            <input
              type="text"
              placeholder="Where to?"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              onFocus={() => setActiveField('dropoff')}
              className={activeField === 'dropoff' ? 'active' : ''}
              autoFocus
            />
          </div>
        </div>

        <button className="add-stop-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Saved Places */}
      <div className="search-content">
        <div className="saved-section">
          <h3>Saved places</h3>
          <div className="saved-list">
            {suggestedPlaces.filter(p => p.saved).map(place => (
              <div key={place.id} className="place-item" onClick={() => handlePlaceSelect(place)}>
                <div className="place-icon saved">{place.icon}</div>
                <div className="place-details">
                  <span className="place-name">{place.name}</span>
                  <span className="place-address">{place.address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="recent-section">
          <h3>Recent</h3>
          <div className="recent-list">
            {suggestedPlaces.filter(p => !p.saved).map(place => (
              <div key={place.id} className="place-item" onClick={() => handlePlaceSelect(place)}>
                <div className="place-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div className="place-details">
                  <span className="place-name">{place.name}</span>
                  <span className="place-address">{place.address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Set location on map */}
        <div className="map-option" onClick={() => navigate('/book', { state: { pickup, dropoff: 'Set on map' } })}>
          <div className="map-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span>Set location on map</span>
        </div>
      </div>

      {/* Confirm Button */}
      {pickup && dropoff && (
        <div className="confirm-bar">
          <button className="confirm-btn" onClick={handleConfirm}>
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerHome;
