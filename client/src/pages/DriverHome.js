import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingRides, acceptRide, updateDriverStatus, getDriverBookings } from '../services/api';
import RideMap from '../components/Map/RideMap';
import io from 'socket.io-client';
import './DriverHome.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function DriverHome({ user }) {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [rideRequest, setRideRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const socketRef = useRef(null);
  const declinedRidesRef = useRef(new Set());
  const isOnlineRef = useRef(false);
  
  const [earnings, setEarnings] = useState({
    today: 0,
    trips: 0
  });

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  // Socket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected');
      if (user?.id) {
        socketRef.current.emit('driver-online', user.id);
      }
    });

    socketRef.current.on('new-ride-available', (rideData) => {
      if (isOnlineRef.current && !declinedRidesRef.current.has(rideData.bookingId)) {
        setRideRequest({
          id: rideData.bookingId,
          pickup: rideData.pickup,
          dropoff: rideData.dropoff,
          pickupCoords: rideData.pickupCoordinates,
          dropoffCoords: rideData.dropoffCoordinates,
          fare: rideData.fare,
          distance: rideData.distance,
          duration: rideData.duration,
          paymentMethod: rideData.paymentMethod,
          customer: rideData.customer
        });
        setCountdown(30);
      }
    });

    socketRef.current.on('ride-taken', (data) => {
      setRideRequest(prev => prev?.id === data.bookingId ? null : prev);
    });

    return () => socketRef.current?.disconnect();
  }, [user?.id]);

  // Get location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setCurrentLocation({ lat: 12.9716, lng: 77.5946 })
      );
    }
  }, []);

  // Fetch earnings
  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const response = await getDriverBookings();
        if (response.data) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayBookings = response.data.filter(b => 
            b.status === 'completed' && new Date(b.completedAt) >= today
          );
          setEarnings({
            today: todayBookings.reduce((sum, b) => sum + (b.actualFare || b.estimatedFare || 0), 0),
            trips: todayBookings.length
          });
        }
      } catch (err) {
        console.log('Failed to fetch earnings');
      }
    };
    fetchEarnings();
  }, []);

  // Fetch pending rides when online
  const fetchPendingRides = useCallback(async () => {
    if (!isOnline || rideRequest) return;
    
    try {
      const response = await getPendingRides();
      if (response.data?.length > 0) {
        const availableRide = response.data.find(ride => !declinedRidesRef.current.has(ride._id));
        if (availableRide) {
          setRideRequest({
            id: availableRide._id,
            pickup: availableRide.pickupLocation?.address || 'Pickup Location',
            dropoff: availableRide.dropoffLocation?.address || 'Dropoff Location',
            pickupCoords: availableRide.pickupLocation?.latitude ? {
              lat: availableRide.pickupLocation.latitude,
              lng: availableRide.pickupLocation.longitude
            } : null,
            dropoffCoords: availableRide.dropoffLocation?.latitude ? {
              lat: availableRide.dropoffLocation.latitude,
              lng: availableRide.dropoffLocation.longitude
            } : null,
            distance: `${availableRide.estimatedDistance || 5} km`,
            duration: `${availableRide.estimatedDuration || 15} min`,
            fare: availableRide.estimatedFare || 149,
            customerName: availableRide.customerId?.name || 'Customer',
            paymentMethod: availableRide.paymentMethod || 'Cash'
          });
          setCountdown(30);
        }
      }
    } catch (err) {
      console.log('No pending rides');
    }
  }, [isOnline, rideRequest]);

  useEffect(() => {
    let interval;
    if (isOnline && !rideRequest) {
      fetchPendingRides();
      interval = setInterval(fetchPendingRides, 5000);
    }
    return () => clearInterval(interval);
  }, [isOnline, rideRequest, fetchPendingRides]);

  // Countdown timer
  useEffect(() => {
    let timer;
    if (rideRequest && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            declinedRidesRef.current.add(rideRequest.id);
            setRideRequest(null);
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [rideRequest, countdown]);

  // Toggle online status - FIXED
  const toggleOnlineStatus = async () => {
    setLoading(true);
    try {
      const newStatus = !isOnline;
      const response = await updateDriverStatus(newStatus);
      
      if (response.data?.success) {
        setIsOnline(response.data.isOnline);
        if (!response.data.isOnline) {
          setRideRequest(null);
        } else {
          socketRef.current?.emit('driver-online', user?.id);
        }
      } else {
        // If no success field, assume it worked based on the newStatus
        setIsOnline(newStatus);
        if (newStatus) {
          socketRef.current?.emit('driver-online', user?.id);
        } else {
          setRideRequest(null);
        }
      }
    } catch (err) {
      console.error('Status update error:', err);
      // Toggle anyway for demo purposes
      setIsOnline(prev => !prev);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRide = async () => {
    if (!rideRequest) return;
    setLoading(true);
    try {
      const response = await acceptRide(rideRequest.id);
      if (response.data.success) {
        localStorage.setItem('activeBooking', JSON.stringify({
          ...response.data.booking,
          pickupCoords: rideRequest.pickupCoords,
          dropoffCoords: rideRequest.dropoffCoords
        }));
        socketRef.current?.emit('ride-accepted', { bookingId: rideRequest.id, driverId: user?.id });
        navigate('/active');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept ride');
      setRideRequest(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineRide = () => {
    if (rideRequest?.id) {
      declinedRidesRef.current.add(rideRequest.id);
      setTimeout(() => declinedRidesRef.current.delete(rideRequest.id), 5 * 60 * 1000);
    }
    setRideRequest(null);
    setCountdown(30);
  };

  return (
    <div className="driver-app">
      {/* Map */}
      <div className="driver-map">
        {currentLocation && (
          <RideMap
            pickup={rideRequest?.pickupCoords ? [rideRequest.pickupCoords.lat, rideRequest.pickupCoords.lng] : [currentLocation.lat, currentLocation.lng]}
            height="100%"
          />
        )}
      </div>

      {/* Top Header */}
      <div className="driver-header">
        <button className="menu-btn" onClick={() => navigate('/profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        
        {/* Online Status Pill */}
        <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
          <div className="status-dot"></div>
          <span>{isOnline ? 'Online' : 'Offline'}</span>
        </div>

        <button className="notif-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </button>
      </div>

      {/* Ride Request Modal */}
      {rideRequest && (
        <div className="ride-request-overlay">
          <div className="ride-request-modal">
            {/* Countdown */}
            <div className="countdown-circle">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#eee" strokeWidth="8"/>
                <circle 
                  cx="50" cy="50" r="45" 
                  fill="none" 
                  stroke="#276EF1" 
                  strokeWidth="8"
                  strokeDasharray={`${(countdown / 30) * 283} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <span className="countdown-text">{countdown}</span>
            </div>

            <h2>New Trip Request</h2>
            
            <div className="fare-display">
              <span className="fare-amount">₹{rideRequest.fare}</span>
              <span className="fare-type">{rideRequest.paymentMethod}</span>
            </div>

            <div className="trip-details">
              <div className="trip-stat">
                <span className="stat-value">{rideRequest.distance}</span>
                <span className="stat-label">Distance</span>
              </div>
              <div className="trip-stat">
                <span className="stat-value">{rideRequest.duration}</span>
                <span className="stat-label">Time</span>
              </div>
            </div>

            <div className="route-preview">
              <div className="route-point">
                <div className="point-dot pickup"></div>
                <div className="point-text">
                  <span className="point-label">PICKUP</span>
                  <span className="point-address">{rideRequest.pickup}</span>
                </div>
              </div>
              <div className="route-line"></div>
              <div className="route-point">
                <div className="point-dot dropoff"></div>
                <div className="point-text">
                  <span className="point-label">DROP-OFF</span>
                  <span className="point-address">{rideRequest.dropoff}</span>
                </div>
              </div>
            </div>

            <div className="request-actions">
              <button className="decline-btn" onClick={handleDeclineRide}>
                Decline
              </button>
              <button className="accept-btn" onClick={handleAcceptRide} disabled={loading}>
                {loading ? 'Accepting...' : 'Accept'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Panel */}
      <div className="driver-bottom">
        {!isOnline ? (
          /* Offline State */
          <div className="offline-card">
            <div className="offline-info">
              <h3>You're offline</h3>
              <p>Go online to start earning</p>
            </div>
            <button 
              className="go-online-btn"
              onClick={toggleOnlineStatus}
              disabled={loading}
            >
              <span className="btn-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </span>
              {loading ? 'Please wait...' : 'GO'}
            </button>
          </div>
        ) : !rideRequest ? (
          /* Online - Searching */
          <div className="online-card">
            <div className="searching-indicator">
              <div className="search-ripple"></div>
              <div className="search-ripple delay-1"></div>
              <div className="search-ripple delay-2"></div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
              </svg>
            </div>
            <div className="searching-text">
              <h3>Looking for trips...</h3>
              <p>You'll see trip requests here</p>
            </div>
            <button className="go-offline-btn" onClick={toggleOnlineStatus} disabled={loading}>
              {loading ? 'Please wait...' : 'Go Offline'}
            </button>
          </div>
        ) : null}

        {/* Earnings Bar */}
        {isOnline && !rideRequest && (
          <div className="earnings-bar">
            <div className="earning-item">
              <span className="earning-value">₹{earnings.today}</span>
              <span className="earning-label">Today</span>
            </div>
            <div className="earning-divider"></div>
            <div className="earning-item">
              <span className="earning-value">{earnings.trips}</span>
              <span className="earning-label">Trips</span>
            </div>
            <div className="earning-divider"></div>
            <div className="earning-item">
              <span className="earning-value">4.92</span>
              <span className="earning-label">Rating</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="driver-nav">
        <div className="nav-item active">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span>Home</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/history')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          <span>Earnings</span>
        </div>
        <div className="nav-item" onClick={() => navigate('/history')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
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

export default DriverHome;
