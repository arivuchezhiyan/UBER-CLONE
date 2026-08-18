import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RideMap from '../components/Map/RideMap';
import BackButton from '../components/BackButton/BackButton';
import './CustomerHome.css';

export const PLACES_DATABASE = [
  // Saved / Home / Work
  { id: 's1', name: 'Home', address: 'Kelambakkam Junction, OMR', icon: '🏠', category: 'Saved', distanceKm: 1.2, isLongDistance: false, coords: { lat: 12.7871, lng: 80.2185 } },
  { id: 's2', name: 'Work', address: 'Siruseri SIPCOT IT Park, TCS Main Gate', icon: '💼', category: 'Saved', distanceKm: 4.8, isLongDistance: false, coords: { lat: 12.8277, lng: 80.2188 } },

  // Chennai & OMR / ECR Regional Hotspots (Including Kelambakkam)
  { id: 'c1', name: 'Kelambakkam Bus Stand', address: 'Rajiv Gandhi Salai, Kelambakkam Junction (OMR)', icon: '📍', category: 'Nearby', distanceKm: 0.5, isLongDistance: false, coords: { lat: 12.7871, lng: 80.2185 } },
  { id: 'c2', name: 'Siruseri SIPCOT IT Park', address: 'TCS, CTS, Hexaware Campus, OMR', icon: '🏢', category: 'Nearby', distanceKm: 4.5, isLongDistance: false, coords: { lat: 12.8277, lng: 80.2188 } },
  { id: 'c3', name: 'Navalur Vivira Mall', address: 'Rajiv Gandhi IT Expressway, Navalur (OMR)', icon: '🛍️', category: 'Nearby', distanceKm: 6.8, isLongDistance: false, coords: { lat: 12.8465, lng: 80.2260 } },
  { id: 'c4', name: 'Sholinganallur Junction', address: 'OMR - ECR Link Road Junction, Chennai', icon: '📍', category: 'Nearby', distanceKm: 12.5, isLongDistance: false, coords: { lat: 12.9010, lng: 80.2279 } },
  { id: 'c5', name: 'Thiruporur Murugan Temple', address: 'Old Mahabalipuram Road, Thiruporur', icon: '🛕', category: 'Nearby', distanceKm: 7.2, isLongDistance: false, coords: { lat: 12.7236, lng: 80.1878 } },
  { id: 'c6', name: 'Kovalam Beach & Surf School', address: 'East Coast Road (ECR), Kovalam', icon: '🏖️', category: 'Nearby', distanceKm: 5.5, isLongDistance: false, coords: { lat: 12.7925, lng: 80.2514 } },
  { id: 'c7', name: 'Mahabalipuram Shore Temple', address: 'UNESCO Heritage Site, ECR, Mamallapuram', icon: '🏛️', category: 'Nearby', distanceKm: 18.0, isLongDistance: false, coords: { lat: 12.6165, lng: 80.1983 } },
  { id: 'c8', name: 'Velachery Phoenix Marketcity', address: 'Guru Nanak College Rd, Indira Gandhi Nagar, Chennai', icon: '🛍️', category: 'Nearby', distanceKm: 23.0, isLongDistance: false, coords: { lat: 12.9922, lng: 80.2173 } },
  { id: 'c9', name: 'Guindy Kathipara Junction', address: 'Kathipara Cloverleaf Flyover & Metro, Chennai', icon: '🚇', category: 'Transit', distanceKm: 27.0, isLongDistance: false, coords: { lat: 13.0067, lng: 80.2030 } },
  { id: 'c10', name: 'T. Nagar Panagal Park', address: 'Pondy Bazaar, Ranganathan St, Chennai', icon: '🛍️', category: 'Nearby', distanceKm: 31.0, isLongDistance: false, coords: { lat: 13.0418, lng: 80.2341 } },
  { id: 'c11', name: 'Tambaram Railway Junction', address: 'GST Road, Tambaram Sanatorium (MEPZ)', icon: '🚆', category: 'Transit', distanceKm: 22.0, isLongDistance: false, coords: { lat: 12.9249, lng: 80.1000 } },
  { id: 'c12', name: 'Chennai International Airport (MAA)', address: 'Terminal 1, 2 & 4, GST Road, Meenambakkam', icon: '✈️', category: 'Airport', distanceKm: 28.5, isLongDistance: false, coords: { lat: 12.9941, lng: 80.1709 } },
  { id: 'c13', name: 'Chennai Central Railway Station', address: 'Puratchi Thalaivar Dr. M.G.R Central (MAS)', icon: '🚆', category: 'Transit', distanceKm: 36.0, isLongDistance: false, coords: { lat: 13.0827, lng: 80.2707 } },

  // Bangalore Hotspots
  { id: 'n1', name: 'Koramangala Sony World Signal', address: '80 Feet Road, Koramangala 4th Block, Bengaluru', icon: '📍', category: 'Nearby', distanceKm: 0.8, isLongDistance: false, coords: { lat: 12.9344, lng: 77.6272 } },
  { id: 'n2', name: 'Indiranagar 100 Feet Road', address: 'Near Toit & 12th Main Road Junction, Bengaluru', icon: '📍', category: 'Nearby', distanceKm: 4.2, isLongDistance: false, coords: { lat: 12.9719, lng: 77.6412 } },
  { id: 'n3', name: 'MG Road Metro Station', address: 'Mahatma Gandhi Road, Bengaluru Central', icon: '🚇', category: 'Transit', distanceKm: 5.6, isLongDistance: false, coords: { lat: 12.9756, lng: 77.6066 } },
  { id: 'n4', name: 'Whitefield Tech Park', address: 'ITPL Main Road, Prestige Shantiniketan', icon: '💼', category: 'Nearby', distanceKm: 14.5, isLongDistance: false, coords: { lat: 12.9698, lng: 77.7499 } },
  { id: 'n5', name: 'Kempegowda International Airport (BLR)', address: 'Terminal 1 & Terminal 2, Devanahalli', icon: '✈️', category: 'Airport', distanceKm: 38.5, isLongDistance: false, coords: { lat: 13.1986, lng: 77.7066 } },

  // Long Distance & Outstation Destinations
  { id: 'l1', name: 'Pondicherry (Puducherry)', address: 'White Town French Quarter & Promenade Beach', icon: '🏖️', category: 'Outstation', distanceKm: 115.0, isLongDistance: true, coords: { lat: 11.9416, lng: 79.8083 } },
  { id: 'l2', name: 'Tirupati Balaji Temple', address: 'Tirumala Hills, Andhra Pradesh', icon: '🛕', category: 'Outstation', distanceKm: 155.0, isLongDistance: true, coords: { lat: 13.6833, lng: 79.3500 } },
  { id: 'l3', name: 'Vellore Golden Temple & Fort', address: 'Sripuram & Vellore Fort, Tamil Nadu', icon: '🛕', category: 'Outstation', distanceKm: 140.0, isLongDistance: true, coords: { lat: 12.8711, lng: 79.0888 } },
  { id: 'l4', name: 'Nandi Hills', address: 'Chikkaballapur District (Hilltop Sunrise)', icon: '⛰️', category: 'Outstation', distanceKm: 62.0, isLongDistance: true, coords: { lat: 13.3702, lng: 77.6835 } },
  { id: 'l5', name: 'Mysore Palace (Mysuru)', address: 'Sayyaji Rao Rd, Mysuru, Karnataka', icon: '🏰', category: 'Outstation', distanceKm: 145.0, isLongDistance: true, coords: { lat: 12.3052, lng: 76.6552 } },
  { id: 'l6', name: 'Coorg (Madikeri Hills)', address: 'Kodagu Coffee Estates & Abbey Falls', icon: '☕', category: 'Outstation', distanceKm: 250.0, isLongDistance: true, coords: { lat: 12.4244, lng: 75.7382 } },
  { id: 'l7', name: 'Ooty (Nilgiri Mountains)', address: 'Udhagamandalam, Tamil Nadu', icon: '🌲', category: 'Outstation', distanceKm: 275.0, isLongDistance: true, coords: { lat: 11.4102, lng: 76.6950 } },
  { id: 'l8', name: 'Hyderabad (HITEC City)', address: 'Cyberabad IT Corridor, Telangana', icon: '🏙️', category: 'Outstation', distanceKm: 570.0, isLongDistance: true, coords: { lat: 17.4435, lng: 78.3772 } }
];

export const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const mainName = addr.suburb || addr.neighbourhood || addr.road || addr.village || addr.town || addr.city_district || addr.city || (data.display_name ? data.display_name.split(',')[0] : '');
      const city = addr.city || addr.state_district || addr.state || '';
      if (mainName && city && !mainName.toLowerCase().includes(city.toLowerCase())) {
        return `${mainName}, ${city}`;
      } else if (mainName) {
        return mainName;
      }
    }
  } catch (e) {
    console.warn('Reverse geocode fallback:', e);
  }
  // Realistic regional coordinates fallback
  if (lat > 12.7 && lat < 12.95 && lng > 80.1 && lng < 80.35) {
    return 'Kelambakkam, Chennai';
  } else if (lat > 12.8 && lat < 13.1 && lng > 77.4 && lng < 77.8) {
    return 'Koramangala 4th Block, Bengaluru';
  }
  return 'Current Location';
};

function CustomerHome({ user }) {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [activeField, setActiveField] = useState('dropoff');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('ALL');
  const [locationAlert, setLocationAlert] = useState('');

  // Schedule Ride States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  // Auto-fetch Current Location on Boot
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setCurrentLocation(coords);
          const placeName = await reverseGeocode(coords.lat, coords.lng);
          setPickup(placeName);
        },
        async () => {
          setCurrentLocation({ lat: 12.9716, lng: 77.5946 });
          const placeName = await reverseGeocode(12.9716, 77.5946);
          setPickup(placeName);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setCurrentLocation({ lat: 12.9716, lng: 77.5946 });
      setPickup('Koramangala 4th Block, Bengaluru');
    }
  }, []);

  // GPS Locate Button Handler
  const handleDetectGPSLocation = (e) => {
    if (e) e.stopPropagation();
    if (!navigator.geolocation) {
      setLocationAlert('⚠️ Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setCurrentLocation(coords);
        const placeName = await reverseGeocode(coords.lat, coords.lng);
        setPickup(placeName);
        setActiveField('dropoff');
      },
      (err) => {
        console.warn('GPS location request error:', err);
        setLocationAlert('⚠️ Location Access Required: Please turn on your device GPS / location services and allow location permission in your browser to auto-fill your current pickup point.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Filtered Recommendations
  const currentQuery = (activeField === 'pickup' ? pickup : dropoff) || '';
  const filteredPlaces = PLACES_DATABASE.filter(place => {
    const matchesCategory = 
      selectedFilterCategory === 'ALL' ||
      (selectedFilterCategory === 'NEARBY' && !place.isLongDistance) ||
      (selectedFilterCategory === 'OUTSTATION' && place.isLongDistance) ||
      (selectedFilterCategory === 'TRANSIT' && (place.category === 'Airport' || place.category === 'Transit'));

    const matchesQuery = !currentQuery.trim() || 
      place.name.toLowerCase().includes(currentQuery.toLowerCase()) ||
      place.address.toLowerCase().includes(currentQuery.toLowerCase()) ||
      place.category.toLowerCase().includes(currentQuery.toLowerCase());

    return matchesCategory && matchesQuery;
  });

  const handlePlaceSelect = (place) => {
    if (activeField === 'pickup') {
      setPickup(place.name);
      setActiveField('dropoff');
    } else {
      setDropoff(place.name);
      // Navigate to booking when destination is selected
      setTimeout(() => {
        navigate('/book', {
          state: {
            pickup: pickup || 'Current location',
            dropoff: place.name,
            isScheduled,
            scheduledDate,
            scheduledTime,
            estimatedDistance: place.distanceKm || 8
          }
        });
      }, 150);
    }
  };

  const handleConfirm = () => {
    if (pickup && dropoff) {
      navigate('/book', {
        state: {
          pickup,
          dropoff,
          isScheduled,
          scheduledDate,
          scheduledTime
        }
      });
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
            <button 
              className={`search-now-btn ${isScheduled ? 'scheduled-active' : ''}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowScheduleModal(true);
              }}
              title="Schedule a Ride for Future"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>{isScheduled ? `${scheduledTime || 'Scheduled'}` : 'Now'}</span>
              <svg viewBox="0 0 24 24" fill="currentColor" width="12">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="uber-suggestions">
            {PLACES_DATABASE.slice(0, 2).map(place => (
              <div 
                key={place.id} 
                className="suggestion-item"
                onClick={() => {
                  setDropoff(place.name);
                  navigate('/book', {
                    state: {
                      pickup: pickup || 'Current location',
                      dropoff: place.name,
                      isScheduled,
                      scheduledDate,
                      scheduledTime,
                      estimatedDistance: place.distanceKm || 5
                    }
                  });
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
            <div className="service-item" onClick={() => setShowSearch(true)}>
              <div className="service-icon-wrapper">
                <img src="https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Moto.png" alt="Two Wheeler" className="service-img"/>
              </div>
              <span>Two Wheeler</span>
            </div>
            <div className="service-item" onClick={() => setShowScheduleModal(true)}>
              <div className="service-icon-wrapper package" style={{ background: '#2563eb' }}>
                <span style={{ fontSize: '24px' }}>🕒</span>
              </div>
              <span>Reserve</span>
            </div>
            <div className="service-item" onClick={() => setShowSearch(true)}>
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

        {/* SCHEDULE RIDE MODAL */}
        {showScheduleModal && (
          <div className="modal-overlay" style={{ zIndex: 999999 }}>
            <div className="schedule-ride-modal">
              <div className="schedule-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '22px' }}>🕒</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Schedule a Ride</h3>
                </div>
                <button 
                  type="button" 
                  className="close-schedule-btn" 
                  onClick={() => setShowScheduleModal(false)}
                >
                  ✕
                </button>
              </div>

              <p className="schedule-modal-subtext">
                Choose your exact pickup date and time in advance. A captain will arrive right on schedule.
              </p>

              {/* Date Selection */}
              <div className="schedule-field-group">
                <label>Pickup Date</label>
                <input 
                  type="date" 
                  className="schedule-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={scheduledDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              {/* Time Selection */}
              <div className="schedule-field-group">
                <label>Pickup Time</label>
                <input 
                  type="time" 
                  className="schedule-input"
                  value={scheduledTime || '10:00'}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>

              <div className="schedule-info-box">
                <span>💡</span>
                <p>Extra wait time included to meet your ride. Free cancellation up to 60 min before pickup.</p>
              </div>

              {/* Action Buttons */}
              <div className="schedule-actions-row">
                <button 
                  type="button" 
                  className="btn-clear-schedule"
                  onClick={() => {
                    setIsScheduled(false);
                    setScheduledDate('');
                    setScheduledTime('');
                    setShowScheduleModal(false);
                  }}
                >
                  Ride Now
                </button>
                <button 
                  type="button" 
                  className="btn-confirm-schedule"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const chosenDate = scheduledDate || todayStr;
                    const chosenTime = scheduledTime || '10:00';
                    setScheduledDate(chosenDate);
                    setScheduledTime(chosenTime);
                    setIsScheduled(true);
                    setShowScheduleModal(false);
                  }}
                >
                  Set Pickup Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Search screen
  return (
    <div className="uber-search-screen">
      {/* Search Header */}
      <div className="search-top-bar">
        <BackButton onClick={() => setShowSearch(false)} label="Back" />
        <span className="search-screen-title">Where to?</span>
        <div style={{ width: '60px' }}></div>
      </div>

      <div className="search-inputs-card">
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
            <button
              type="button"
              className="locate-gps-btn"
              onClick={handleDetectGPSLocation}
              title="Detect My GPS Location"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="7"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <line x1="12" y1="2" x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="5" y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
              </svg>
              <span>Locate</span>
            </button>
          </div>
          <div className="input-connector"></div>
          <div className="input-row">
            <div className="input-dot dropoff"></div>
            <input
              type="text"
              placeholder="Where to? (e.g. Koramangala, Airport, Mysore...)"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              onFocus={() => setActiveField('dropoff')}
              className={activeField === 'dropoff' ? 'active' : ''}
              autoFocus
            />
          </div>
        </div>

        <button className="add-stop-btn" title="Add Stop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Category Recommendation Filter Tabs */}
      <div className="places-filter-bar">
        <button 
          className={`filter-pill ${selectedFilterCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('ALL')}
        >
          🌟 All
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'NEARBY' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('NEARBY')}
        >
          📍 Nearby
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'TRANSIT' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('TRANSIT')}
        >
          ✈️ Airport & Transit
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'OUTSTATION' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('OUTSTATION')}
        >
          ⛰️ Long Distance
        </button>
      </div>

      {/* Dynamic Filtered Places Recommendations */}
      <div className="search-content">
        <div className="recommendations-container">
          <div className="recommendations-header">
            <h3>
              {currentQuery ? `Results for "${currentQuery}"` : 'Recommended Destinations'}
            </h3>
            <span className="places-count-badge">{filteredPlaces.length} places</span>
          </div>

          <div className="places-list">
            {filteredPlaces.map(place => (
              <div 
                key={place.id} 
                className={`place-item ${place.isLongDistance ? 'long-distance-item' : ''}`} 
                onClick={() => handlePlaceSelect(place)}
              >
                <div className={`place-icon ${place.category.toLowerCase()}`}>
                  {place.icon}
                </div>
                <div className="place-details">
                  <div className="place-title-row">
                    <span className="place-name">{place.name}</span>
                    {place.isLongDistance ? (
                      <span className="distance-badge outstation">Outstation • {place.distanceKm} km</span>
                    ) : (
                      <span className="distance-badge nearby">{place.distanceKm} km</span>
                    )}
                  </div>
                  <span className="place-address">{place.address}</span>
                </div>
              </div>
            ))}

            {filteredPlaces.length === 0 && (
              <div 
                className="place-item custom-address-item"
                onClick={() => handlePlaceSelect({ name: currentQuery, address: 'Custom Specified Location', distanceKm: 12 })}
              >
                <div className="place-icon custom">📍</div>
                <div className="place-details">
                  <span className="place-name">Use "{currentQuery}"</span>
                  <span className="place-address">Tap to set as {activeField} location</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Set location on map */}
        <div className="map-option" onClick={() => navigate('/book', { state: { pickup: pickup || 'Current location', dropoff: dropoff || 'Set on map' } })}>
          <div className="map-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span>Set location on map</span>
        </div>
      </div>

      {/* Location Service Alert Modal */}
      {locationAlert && (
        <div className="modal-overlay" style={{ zIndex: 9999999 }}>
          <div className="location-permission-modal">
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📡</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>Location Services Required</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
              {locationAlert}
            </p>
            <button 
              className="btn-enable-location"
              onClick={() => {
                setLocationAlert('');
                handleDetectGPSLocation();
              }}
            >
              🔄 Try Again
            </button>
            <button 
              className="btn-dismiss-location"
              onClick={() => setLocationAlert('')}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Confirm Button */}
      {pickup && dropoff && (
        <div className="confirm-bar">
          <button className="confirm-btn" onClick={handleConfirm}>
            Confirm Ride ({pickup} → {dropoff})
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerHome;
