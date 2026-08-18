import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingRides, acceptRide, rejectRide, updateDriverStatus, getDriverBookings, getDriverDocuments } from '../services/api';
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
  const [approvalStatus, setApprovalStatus] = useState('APPROVED');
  const [driverVehicle, setDriverVehicle] = useState(null);

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

  // Load driver KYC & vehicle verification status
  useEffect(() => {
    getDriverDocuments()
      .then(res => {
        if (res.data?.success) {
          setApprovalStatus(res.data.approvalStatus || 'APPROVED');
          setDriverVehicle(res.data.vehicleDetails);
        }
      })
      .catch(() => {});
  }, []);

  // Socket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socketRef.current.on('connect', () => {
      if (user?.id) {
        socketRef.current.emit('driver-online', user.id);
      }
    });

    const handleNewRide = (rideData) => {
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
          customer: rideData.customer,
          vehicleType: rideData.vehicleType
        });
        setCountdown(rideData.timeoutSec || 30);
      }
    };

    socketRef.current.on('new-ride-available', handleNewRide);
    if (user?.id) {
      socketRef.current.on(`ride-request-driver-${user.id}`, handleNewRide);
    }

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

  // Periodic heartbeat
  useEffect(() => {
    let hbInterval;
    if (isOnline && currentLocation) {
      hbInterval = setInterval(() => {
        socketRef.current?.emit('driver-heartbeat', {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        });
      }, 30000);
    }
    return () => clearInterval(hbInterval);
  }, [isOnline, currentLocation]);

  // Fetch earnings
  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const response = await getDriverBookings();
        if (response.data) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayBookings = response.data.filter(b => 
            (b.status === 'completed' || b.status === 'SETTLED') && new Date(b.completedAt) >= today
          );
          setEarnings({
            today: todayBookings.reduce((sum, b) => sum + (b.fareBreakdown?.driverEarnings || b.actualFare || b.estimatedFare || 0), 0),
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
            paymentMethod: availableRide.paymentMethod || 'Cash',
            vehicleType: availableRide.vehicleType
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

  // Toggle online status with strict verification check
  const toggleOnlineStatus = async () => {
    if (approvalStatus !== 'APPROVED') {
      alert('⚠️ Verification Required: You must complete your KYC and vehicle verification before going online.');
      navigate('/driver/documents');
      return;
    }

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
      }
    } catch (err) {
      if (err.response?.data?.approvalStatus) {
        setApprovalStatus(err.response.data.approvalStatus);
      }
      alert(err.response?.data?.message || 'Verification required to go online.');
      navigate('/driver/documents');
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

  const handleDeclineRide = async () => {
    if (rideRequest?.id) {
      declinedRidesRef.current.add(rideRequest.id);
      socketRef.current?.emit('driver-reject-ride', {
        bookingId: rideRequest.id,
        reason: 'Driver declined request'
      });
      try {
        await rejectRide(rideRequest.id, 'Driver declined request');
      } catch (e) {}
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

      {/* Top Header Navigation */}
      <header className="driver-top-nav">
        <button className="nav-profile-btn" onClick={() => navigate('/profile')} title="My Profile & Settings">
          <span className="avatar-icon">👤</span>
          <span className="profile-text">Profile</span>
        </button>

        {/* Online Status Toggle Pill */}
        <button 
          className={`driver-status-toggle ${isOnline ? 'online' : 'offline'}`}
          onClick={toggleOnlineStatus}
          disabled={loading}
          title={isOnline ? 'Tap to go Offline' : 'Tap to go Online'}
        >
          <span className="status-live-dot"></span>
          <span className="status-label">{isOnline ? 'Online' : 'Offline'}</span>
        </button>

        {/* Shortcuts */}
        <div className="nav-actions-group">
          <button 
            className="nav-action-pill earnings"
            onClick={() => navigate('/history')} 
            title="Earnings & Trip History"
          >
            💰 Earnings
          </button>
          <button 
            className="nav-action-pill kyc"
            onClick={() => navigate('/driver/documents')} 
            title="Vehicle & KYC Documents"
          >
            📄 KYC
          </button>
        </div>
      </header>

      {/* KYC Alert Banner if not verified - Cleanly anchored below top nav */}
      {approvalStatus !== 'APPROVED' && (
        <div className="driver-kyc-floating-banner" onClick={() => navigate('/driver/documents')}>
          <div className="kyc-banner-left">
            <span className="banner-alert-icon">⚠️</span>
            <div className="banner-text-col">
              <span className="banner-heading">Verification Required to Go Online</span>
              <span className="banner-subtext">Register vehicle category, upload photos & documents</span>
            </div>
          </div>
          <button className="banner-btn-verify">Verify →</button>
        </div>
      )}

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
            {rideRequest.vehicleType && (
              <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>
                {rideRequest.vehicleType}
              </span>
            )}
            
            <div className="fare-display">
              <span className="fare-amount">₹{rideRequest.fare}</span>
              <span className="fare-type">{rideRequest.paymentMethod?.toUpperCase()}</span>
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

            <div className="route-details">
              <div className="route-item">
                <div className="route-dot pickup"></div>
                <div className="route-text">
                  <span className="route-label">PICKUP</span>
                  <span className="route-address">{rideRequest.pickup}</span>
                </div>
              </div>
              <div className="route-line"></div>
              <div className="route-item">
                <div className="route-dot dropoff"></div>
                <div className="route-text">
                  <span className="route-label">DROPOFF</span>
                  <span className="route-address">{rideRequest.dropoff}</span>
                </div>
              </div>
            </div>

            <div className="request-actions">
              <button 
                className="decline-btn"
                onClick={handleDeclineRide}
              >
                Decline
              </button>
              <button 
                className="accept-btn"
                onClick={handleAcceptRide}
                disabled={loading}
              >
                {loading ? 'Accepting...' : 'Accept Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Bar */}
      <div className="driver-bottom-bar">
        <div className="earnings-summary">
          <div className="earnings-item">
            <span className="earnings-label">Today's Earnings</span>
            <span className="earnings-value">₹{earnings.today}</span>
          </div>
          <div className="earnings-item">
            <span className="earnings-label">Trips</span>
            <span className="earnings-value">{earnings.trips}</span>
          </div>
          <div className="earnings-item">
            <span className="earnings-label">Vehicle</span>
            <span className="earnings-value" style={{ fontSize: '13px' }}>
              {driverVehicle?.vehicleType || 'UberGo'}
            </span>
          </div>
        </div>

        <button 
          className={`go-btn ${isOnline ? 'offline' : 'online'}`}
          onClick={toggleOnlineStatus}
          disabled={loading}
        >
          {loading ? '...' : isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
        </button>
      </div>
    </div>
  );
}

export default DriverHome;
