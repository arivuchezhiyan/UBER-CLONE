import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { requestRide, getRideTypes } from '../services/api';
import RideMap from '../components/Map/RideMap';
import './BookRide.css';

function BookRide({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pickup, setPickup] = useState(location.state?.pickup || '');
  const [dropoff, setDropoff] = useState(location.state?.dropoff || '');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rideOptions, setRideOptions] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState(5);
  const [promoCode, setPromoCode] = useState('');

  // Get coordinates on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setPickupCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // Simulate dropoff location
        setDropoffCoords({ 
          lat: pos.coords.latitude + 0.02, 
          lng: pos.coords.longitude + 0.015 
        });
      });
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
        paymentMethod
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
        
        {/* Back Button */}
        <button className="back-button" onClick={() => navigate('/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Route Info Overlay */}
        <div className="route-info-card">
          <div className="route-point">
            <div className="point-marker green"></div>
            <span>{pickup || 'Current Location'}</span>
          </div>
          <div className="route-divider"></div>
          <div className="route-point">
            <div className="point-marker black"></div>
            <span>{dropoff || 'Destination'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Sheet - Vehicle Selection */}
      <div className="vehicle-sheet">
        <div className="sheet-header">
          <div className="drag-indicator"></div>
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

        {/* Confirm Button */}
        <button 
          className="confirm-ride-btn"
          onClick={handleConfirmRide}
          disabled={!selectedRide || loading}
        >
          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <span>Confirm {selectedRide?.name || 'Ride'}</span>
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
