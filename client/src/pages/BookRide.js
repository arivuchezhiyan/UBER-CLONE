import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { requestRide, getRideTypes } from '../services/api';
import RideMap from '../components/Map/RideMap';
import BackButton from '../components/BackButton/BackButton';
import { PLACES_DATABASE, reverseGeocode } from './CustomerHome';
import './BookRide.css';

function BookRide({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pickup, setPickup] = useState(location.state?.pickup || '');
  const [dropoff, setDropoff] = useState(location.state?.dropoff || '');
  const isScheduled = location.state?.isScheduled || false;
  const scheduledDate = location.state?.scheduledDate || '';
  const scheduledTime = location.state?.scheduledTime || '';
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rideOptions, setRideOptions] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState(location.state?.estimatedDistance || 5);
  const [promoCode, setPromoCode] = useState('');
  
  // Location editing and autocomplete state
  const [activeEditingField, setActiveEditingField] = useState(null); // 'pickup' | 'dropoff' | null
  const [locationAlert, setLocationAlert] = useState('');

  // Get coordinates on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPickupCoords({ lat, lng });
          
          if (!pickup || pickup === 'Current location' || pickup.includes('GPS')) {
            const realName = await reverseGeocode(lat, lng);
            setPickup(realName);
          }

          // Set dropoff coords based on place or offset
          const matchedPlace = PLACES_DATABASE.find(p => p.name.toLowerCase() === (dropoff || '').toLowerCase());
          if (matchedPlace && matchedPlace.coords) {
            setDropoffCoords(matchedPlace.coords);
          } else {
            setDropoffCoords({ lat: lat + 0.025, lng: lng + 0.02 });
          }
        },
        async () => {
          const defaultLat = 12.9716;
          const defaultLng = 77.5946;
          setPickupCoords({ lat: defaultLat, lng: defaultLng });
          if (!pickup) setPickup('Koramangala 4th Block, Bengaluru');
          setDropoffCoords({ lat: defaultLat + 0.02, lng: defaultLng + 0.015 });
        }
      );
    } else {
      setPickupCoords({ lat: 12.9716, lng: 77.5946 });
      setDropoffCoords({ lat: 12.9916, lng: 77.6096 });
    }
  }, []);

  // Fetch ride types
  useEffect(() => {
    const fetchRideTypes = async () => {
      try {
        const response = await getRideTypes();
        if (response.data?.length > 0) {
          const types = response.data.map(v => ({
            id: v.name,
            name: v.name,
            desc: v.description,
            price: v.baseFare + (v.pricePerKm * estimatedDistance),
            time: `${Math.floor(Math.random() * 5) + 2} min away`,
            capacity: v.capacity,
            icon: getVehicleIcon(v.name),
            pricePerKm: v.pricePerKm,
            baseFare: v.baseFare
          }));
          setRideOptions(types);
          setSelectedRide(types[0]);
        } else {
          setDefaultRideOptions();
        }
      } catch (err) {
        setDefaultRideOptions();
      }
    };
    fetchRideTypes();
  }, [estimatedDistance]);

  const getVehicleIcon = (name) => {
    const icons = {
      'UberGo': '🚗',
      'Premier': '🚘',
      'UberXL': '🚐',
      'Uber Auto': '🛺',
      'Uber Moto': '🏍️',
      'Sedan': '🚗',
      'SUV': '🚙',
      'Bike': '🏍️',
      'Auto': '🛺'
    };
    return icons[name] || '🚗';
  };

  const setDefaultRideOptions = () => {
    const options = [
      { id: 'UberGo', name: 'UberGo', desc: 'Affordable, everyday rides', price: 149, time: '2 min away', capacity: 4, icon: '🚗', pricePerKm: 12, baseFare: 50 },
      { id: 'Premier', name: 'Premier', desc: 'Comfortable sedans, top drivers', price: 199, time: '4 min away', capacity: 4, icon: '🚘', pricePerKm: 15, baseFare: 70 },
      { id: 'UberXL', name: 'UberXL', desc: 'Affordable rides for groups up to 6', price: 279, time: '5 min away', capacity: 6, icon: '🚐', pricePerKm: 18, baseFare: 100 },
      { id: 'Auto', name: 'Uber Auto', desc: 'No bargaining, doorstep pick-up', price: 89, time: '1 min away', capacity: 3, icon: '🛺', pricePerKm: 8, baseFare: 25 },
      { id: 'Moto', name: 'Uber Moto', desc: 'Affordable motorcycle rides', price: 49, time: '2 min away', capacity: 1, icon: '🏍️', pricePerKm: 5, baseFare: 15 }
    ];
    setRideOptions(options);
    setSelectedRide(options[0]);
  };

  // Calculate distance
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const R = 6371;
      const dLat = (dropoffCoords.lat - pickupCoords.lat) * Math.PI / 180;
      const dLon = (dropoffCoords.lng - pickupCoords.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(pickupCoords.lat * Math.PI / 180) * Math.cos(dropoffCoords.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      setEstimatedDistance(Math.max(1, Math.round(R * c * 10) / 10));
    }
  }, [pickupCoords, dropoffCoords]);

  const handleConfirmRide = async () => {
    if (!selectedRide) return;
    
    setLoading(true);
    try {
      const response = await requestRide({
        pickupLocation: { 
          address: pickup || 'Current Location',
          latitude: pickupCoords?.lat,
          longitude: pickupCoords?.lng
        },
        dropoffLocation: { 
          address: dropoff || 'Destination',
          latitude: dropoffCoords?.lat,
          longitude: dropoffCoords?.lng
        },
        vehicleType: selectedRide.name,
        estimatedDistance,
        estimatedDuration: Math.round(estimatedDistance * 3),
        paymentMethod,
        isScheduled,
        scheduledDate,
        scheduledTime
      });
      
      if (response.data.success) {
        localStorage.setItem('activeBooking', JSON.stringify({
          ...response.data.booking,
          pickupCoords,
          dropoffCoords
        }));
        navigate('/active');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to book ride');
    } finally {
      setLoading(false);
    }
  };

  // Mini GPS Locate button inside BookRide page
  const handleDetectCurrentGPS = (e) => {
    if (e) e.stopPropagation();
    if (!navigator.geolocation) {
      setLocationAlert('⚠️ Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupCoords({ lat, lng });
        const realName = await reverseGeocode(lat, lng);
        setPickup(realName);
        setActiveEditingField(null);
      },
      (err) => {
        console.warn('GPS error in BookRide:', err);
        setLocationAlert('⚠️ Location Access Required: Please turn on device location services and allow location permission in your browser to auto-detect your pickup point.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Select a suggestion on BookRide page
  const handleSelectSuggestion = (place) => {
    if (activeEditingField === 'pickup') {
      setPickup(place.name);
      if (place.coords) setPickupCoords(place.coords);
      setActiveEditingField('dropoff');
    } else {
      setDropoff(place.name);
      if (place.coords) setDropoffCoords(place.coords);
      if (place.distanceKm) {
        setEstimatedDistance(place.distanceKm);
      }
      setActiveEditingField(null);
    }
  };

  const editingQuery = activeEditingField === 'pickup' ? pickup : dropoff;
  const filteredSuggestions = PLACES_DATABASE.filter(place => {
    if (!editingQuery || !editingQuery.trim()) return true;
    return (
      place.name.toLowerCase().includes(editingQuery.toLowerCase()) ||
      place.address.toLowerCase().includes(editingQuery.toLowerCase()) ||
      place.category.toLowerCase().includes(editingQuery.toLowerCase())
    );
  });

  const getPaymentIcon = () => {
    switch(paymentMethod) {
      case 'cash': return '💵';
      case 'upi': return '📱';
      case 'card': return '💳';
      default: return '💵';
    }
  };

  const calculateFare = (ride) => {
    return Math.round(ride.baseFare + (ride.pricePerKm * estimatedDistance));
  };

  return (
    <div className="book-ride-app">
      {/* Map Section */}
      <div className="ride-map-section">
        <RideMap
          pickup={pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : null}
          dropoff={dropoffCoords ? [dropoffCoords.lat, dropoffCoords.lng] : null}
          showRoute={true}
          height="100%"
        />
        
        {/* Floating Universal Back Button */}
        <BackButton to="/" label="Back" className="floating" />

        {/* Route Info Overlay with editable inputs and floating suggestions */}
        <div className="route-info-card">
          <div className="route-point">
            <div className="point-marker green"></div>
            <input
              type="text"
              className="route-input"
              value={pickup}
              placeholder="Enter pickup location"
              onChange={(e) => {
                setPickup(e.target.value);
                setActiveEditingField('pickup');
              }}
              onFocus={() => setActiveEditingField('pickup')}
            />
            <button
              type="button"
              className="btn-locate-mini"
              onClick={handleDetectCurrentGPS}
              title="Detect GPS Current Location"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="7"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <line x1="12" y1="2" x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="5" y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
              </svg>
            </button>
          </div>
          <div className="route-divider"></div>
          <div className="route-point">
            <div className="point-marker black"></div>
            <input
              type="text"
              className="route-input"
              value={dropoff}
              placeholder="Where to? (Destination)"
              onChange={(e) => {
                setDropoff(e.target.value);
                setActiveEditingField('dropoff');
              }}
              onFocus={() => setActiveEditingField('dropoff')}
            />
          </div>

          {/* Interactive Floating Suggestion Bar */}
          {activeEditingField && (
            <div className="route-suggestions-dropdown">
              <div className="dropdown-header">
                <span>Suggestions for {activeEditingField === 'pickup' ? 'Pickup' : 'Destination'}</span>
                <button type="button" className="close-dropdown-btn" onClick={() => setActiveEditingField(null)}>✕</button>
              </div>
              <div className="dropdown-list">
                {filteredSuggestions.slice(0, 8).map(place => (
                  <div 
                    key={place.id} 
                    className="dropdown-item" 
                    onMouseDown={() => handleSelectSuggestion(place)}
                  >
                    <span className="dropdown-icon">{place.icon}</span>
                    <div className="dropdown-info">
                      <div className="dropdown-title-row">
                        <span className="dropdown-name">{place.name}</span>
                        {place.isLongDistance ? (
                          <span className="dropdown-badge outstation">Outstation • {place.distanceKm} km</span>
                        ) : (
                          <span className="dropdown-badge nearby">{place.distanceKm} km</span>
                        )}
                      </div>
                      <span className="dropdown-address">{place.address}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Location Service Alert Modal */}
      {locationAlert && (
        <div className="modal-overlay" style={{ zIndex: 9999999 }}>
          <div className="location-permission-modal">
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📡</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>Location Access Required</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
              {locationAlert}
            </p>
            <button 
              className="btn-enable-location"
              onClick={() => {
                setLocationAlert('');
                handleDetectCurrentGPS();
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

      {/* Bottom Sheet - Vehicle Selection */}
      <div className="vehicle-sheet">
        <div className="sheet-header">
          <div className="drag-indicator"></div>
          {isScheduled && (
            <div style={{
              background: '#eff6ff',
              border: '1.5px solid #93c5fd',
              color: '#1d4ed8',
              borderRadius: '20px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '8px'
            }}>
              <span>🕒</span>
              <span>Scheduled for {scheduledDate || 'Today'} at {scheduledTime || '10:00'}</span>
            </div>
          )}
          <div className="trip-info">
            <span className="distance">{estimatedDistance} km</span>
            <span className="separator">•</span>
            <span className="duration">{Math.round(estimatedDistance * 3)} min</span>
          </div>
        </div>

        {/* Ride Options */}
        <div className="ride-options-list">
          {rideOptions.map(ride => (
            <div 
              key={ride.id}
              className={`ride-option ${selectedRide?.id === ride.id ? 'selected' : ''}`}
              onClick={() => setSelectedRide(ride)}
            >
              <div className="ride-icon-wrapper">
                <span className="ride-icon">{ride.icon}</span>
              </div>
              <div className="ride-info">
                <div className="ride-main">
                  <h4>{ride.name}</h4>
                  <span className="ride-time">{ride.time}</span>
                </div>
                <p className="ride-desc">{ride.desc}</p>
              </div>
              <div className="ride-price">
                <span className="price">₹{calculateFare(ride)}</span>
              </div>
              {selectedRide?.id === ride.id && (
                <div className="selected-indicator">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Promo Code */}
        <div className="promo-section" onClick={() => {}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
          <span>{promoCode || 'Add promo code'}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>

        {/* Payment Method */}
        <div className="payment-section" onClick={() => setShowPaymentSheet(true)}>
          <span className="payment-icon">{getPaymentIcon()}</span>
          <span className="payment-label">
            {paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'upi' ? 'UPI' : 'Card'}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>

        {/* Confirm / Schedule Button */}
        <button 
          className="confirm-ride-btn"
          onClick={handleConfirmRide}
          disabled={!selectedRide || loading}
          style={isScheduled ? { background: '#2563eb' } : {}}
        >
          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <span>{isScheduled ? `Schedule ${selectedRide?.name || 'Ride'}` : `Confirm ${selectedRide?.name || 'Ride'}`}</span>
              <span className="btn-price">₹{selectedRide ? calculateFare(selectedRide) : 0}</span>
            </>
          )}
        </button>
      </div>

      {/* Payment Sheet */}
      {showPaymentSheet && (
        <div className="payment-sheet-overlay" onClick={() => setShowPaymentSheet(false)}>
          <div className="payment-sheet" onClick={e => e.stopPropagation()}>
            <div className="payment-sheet-header">
              <h3>Payment Method</h3>
              <button onClick={() => setShowPaymentSheet(false)}>✕</button>
            </div>
            <div className="payment-options">
              <div 
                className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('cash'); setShowPaymentSheet(false); }}
              >
                <span className="option-icon">💵</span>
                <span className="option-label">Cash</span>
                {paymentMethod === 'cash' && <span className="check">✓</span>}
              </div>
              <div 
                className={`payment-option ${paymentMethod === 'upi' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('upi'); setShowPaymentSheet(false); }}
              >
                <span className="option-icon">📱</span>
                <span className="option-label">UPI</span>
                {paymentMethod === 'upi' && <span className="check">✓</span>}
              </div>
              <div 
                className={`payment-option ${paymentMethod === 'card' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('card'); setShowPaymentSheet(false); }}
              >
                <span className="option-icon">💳</span>
                <span className="option-label">Card</span>
                {paymentMethod === 'card' && <span className="check">✓</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookRide;
