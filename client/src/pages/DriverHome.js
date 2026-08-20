import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPendingRides, acceptRide, rejectRide, updateDriverStatus, getDriverBookings, getDriverDocuments } from '../services/api';
import RideMap from '../components/Map/RideMap';
import {
  UserIcon,
  StarIcon,
  ShieldIcon,
  ShieldAlertIcon,
  WalletIcon,
  DocumentIcon,
  SettingsIcon,
  GpsCrosshairIcon,
  FlameIcon,
  MapPinIcon,
  CoffeeIcon,
  CarIcon,
  ZapIcon,
  PowerIcon,
  ClockIcon,
  RouteIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  PhoneCallIcon,
  ShareIcon,
  MicIcon,
  LogOutIcon
} from '../components/Icons';
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

  // Captain UI Feature States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showHotspots, setShowHotspots] = useState(false);
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [destinationMode, setDestinationMode] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [navigationApp, setNavigationApp] = useState('google');
  const [dailyGoal] = useState(2500);
  const [onlineHours] = useState('4.2h');

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
      if (isOnlineRef.current && !isBreakMode && !declinedRidesRef.current.has(rideData.bookingId)) {
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
          vehicleType: rideData.vehicleType,
          surgeMultiplier: rideData.surgeMultiplier || 1.2
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
  }, [user?.id, isBreakMode]);

  // Auto-accept trigger
  useEffect(() => {
    if (rideRequest && autoAccept) {
      const timer = setTimeout(() => {
        handleAcceptRide();
      }, 2000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideRequest, autoAccept]);

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
    if (isOnline && currentLocation && !isBreakMode) {
      hbInterval = setInterval(() => {
        socketRef.current?.emit('driver-heartbeat', {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng
        });
      }, 30000);
    }
    return () => clearInterval(hbInterval);
  }, [isOnline, currentLocation, isBreakMode]);

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
    if (!isOnline || isBreakMode || rideRequest) return;
    
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
            vehicleType: availableRide.vehicleType,
            surgeMultiplier: availableRide.surgeMultiplier || 1.2
          });
          setCountdown(30);
        }
      }
    } catch (err) {
      console.log('No pending rides');
    }
  }, [isOnline, isBreakMode, rideRequest]);

  useEffect(() => {
    let interval;
    if (isOnline && !isBreakMode && !rideRequest) {
      fetchPendingRides();
      interval = setInterval(fetchPendingRides, 5000);
    }
    return () => clearInterval(interval);
  }, [isOnline, isBreakMode, rideRequest, fetchPendingRides]);

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

  // Toggle online status
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

  const handleRecenter = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const goalPercent = Math.min(100, Math.round((earnings.today / dailyGoal) * 100));

  return (
    <div className="driver-app">
      {/* Live Map */}
      <div className="driver-map">
        {currentLocation && (
          <RideMap
            pickup={rideRequest?.pickupCoords ? [rideRequest.pickupCoords.lat, rideRequest.pickupCoords.lng] : [currentLocation.lat, currentLocation.lng]}
            height="100%"
          />
        )}
      </div>

      {/* ============================================================ */}
      {/* 1. TOP FLOATING VECTOR GLASS ISLAND HEADER                   */}
      {/* ============================================================ */}
      <header className="driver-top-island">
        {/* Left: Captain Profile Vector Capsule */}
        <button 
          className="captain-glass-profile" 
          onClick={() => navigate('/profile')} 
          title="Captain Profile & Ratings"
        >
          <div className="captain-avatar-ring">
            <UserIcon size={18} color="#ffffff" />
            <span className={`live-glow-dot ${isOnline ? 'online' : 'offline'}`}></span>
          </div>
          <div className="captain-info-col">
            <span className="captain-name">{user?.name || 'Captain'}</span>
            <div className="captain-rating-row">
              <StarIcon size={11} />
              <span className="rating-val">4.92</span>
              <span className="level-tag">DIAMOND</span>
            </div>
          </div>
        </button>

        {/* Center: Online/Offline Liquid Beacon Toggle */}
        <button 
          className={`driver-liquid-toggle ${isOnline ? 'online' : 'offline'} ${isBreakMode ? 'break' : ''}`}
          onClick={toggleOnlineStatus}
          disabled={loading}
          title={isOnline ? 'Tap to go Offline' : 'Tap to go Online'}
        >
          <div className="toggle-liquid-sheen"></div>
          <span className="toggle-beacon-dot"></span>
          <span className="toggle-label-text">
            {loading ? 'SYNCING...' : isBreakMode ? 'ON BREAK' : isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </button>

        {/* Right: Quick Action Controls */}
        <div className="top-actions-cluster">
          <button 
            className="liquid-action-pill earnings-pill"
            onClick={() => navigate('/history')} 
            title="Earnings & Trip Ledger"
          >
            <WalletIcon size={15} color="#38bdf8" />
            <span className="pill-label">₹{earnings.today}</span>
          </button>

          <button 
            className="liquid-action-pill kyc-pill"
            onClick={() => navigate('/driver/documents')} 
            title="KYC & Vehicle Docs"
          >
            <DocumentIcon size={15} color="#b5c4ff" />
            <span className="pill-label">KYC</span>
          </button>

          <button 
            className="liquid-icon-btn settings-btn"
            onClick={() => setShowSettingsModal(true)}
            title="Captain Settings & Preferences"
          >
            <SettingsIcon size={17} color="#dfe1f5" />
          </button>
        </div>
      </header>

      {/* KYC Alert Floating Banner if unverified */}
      {approvalStatus !== 'APPROVED' && (
        <div className="driver-kyc-liquid-alert" onClick={() => navigate('/driver/documents')}>
          <div className="alert-left">
            <AlertCircleIcon size={22} color="#f59e0b" />
            <div className="alert-text-col">
              <span className="alert-title">Account Verification Required</span>
              <span className="alert-subtitle">Upload vehicle photo & documents to activate trip dispatch</span>
            </div>
          </div>
          <button className="btn-alert-action">Upload Docs →</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. MAP FLOATING HUD CONTROLS (Right Precision Glass Island)   */}
      {/* ============================================================ */}
      <div className="map-floating-hud">
        {/* Primary: Recenter GPS */}
        <button 
          className="hud-glass-btn primary" 
          onClick={handleRecenter}
          title="Recenter Map to Current GPS"
        >
          <GpsCrosshairIcon size={19} color="#61d4fb" />
          <span className="hud-tooltip">Recenter</span>
        </button>

        {/* Secondary: Surge Heatmaps */}
        <button 
          className={`hud-glass-btn secondary ${showHotspots ? 'active' : ''}`}
          onClick={() => setShowHotspots(!showHotspots)}
          title="Toggle Surge Hotspots"
        >
          <FlameIcon size={19} color={showHotspots ? '#fbbf24' : '#94a3b8'} />
          <span className="hud-tooltip">Surge Zones</span>
        </button>

        {/* Secondary: Destination Mode */}
        <button 
          className={`hud-glass-btn secondary ${destinationMode ? 'active' : ''}`}
          onClick={() => setDestinationMode(!destinationMode)}
          title="Set Destination Route"
        >
          <MapPinIcon size={19} color={destinationMode ? '#38bdf8' : '#94a3b8'} />
          <span className="hud-tooltip">My Route</span>
        </button>

        {/* Tertiary: Coffee / Break Mode */}
        <button 
          className={`hud-glass-btn tertiary ${isBreakMode ? 'active' : ''}`}
          onClick={() => setIsBreakMode(!isBreakMode)}
          title="Pause Dispatches (Break Mode)"
        >
          <CoffeeIcon size={19} color={isBreakMode ? '#f59e0b' : '#94a3b8'} />
          <span className="hud-tooltip">Break</span>
        </button>

        {/* Tertiary: Safety & SOS */}
        <button 
          className="hud-glass-btn safety"
          onClick={() => setShowSafetyModal(true)}
          title="Captain Safety Toolkit & SOS"
        >
          <ShieldAlertIcon size={19} color="#f43f5e" />
          <span className="hud-tooltip">Safety SOS</span>
        </button>
      </div>

      {/* Surge Hotspots Floating Banner */}
      {showHotspots && (
        <div className="hotspots-liquid-banner">
          <div className="hotspot-chip high">
            <ZapIcon size={14} color="#fbbf24" />
            <span>Airport Corridor: <strong>1.8x Surge</strong></span>
          </div>
          <div className="hotspot-chip med">
            <ZapIcon size={14} color="#60a5fa" />
            <span>Tech Boulevard: <strong>1.4x Surge</strong></span>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. INCOMING RIDE REQUEST LIQUID GLASS DIALOG                */}
      {/* ============================================================ */}
      {rideRequest && (
        <div className="ride-request-overlay">
          <div className="ride-request-liquid-card">
            <div className="liquid-refraction-edge"></div>

            {/* Top Bar with Countdown */}
            <div className="request-card-header">
              <div className="countdown-liquid-circle">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7"/>
                  <circle 
                    cx="50" cy="50" r="44" 
                    fill="none" 
                    stroke="#61d4fb" 
                    strokeWidth="7"
                    strokeDasharray={`${(countdown / 30) * 276} 276`}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="countdown-number">{countdown}</span>
              </div>

              <div className="request-title-meta">
                <div className="vehicle-badge-pill">
                  <CarIcon size={14} color="#61d4fb" />
                  <span>{rideRequest.vehicleType || driverVehicle?.vehicleType || 'UberGo'}</span>
                </div>
                <h3>Incoming Trip Request</h3>
              </div>

              {rideRequest.surgeMultiplier > 1 && (
                <div className="surge-liquid-pill">
                  <ZapIcon size={12} color="#ffffff" />
                  <span>{rideRequest.surgeMultiplier}x Surge</span>
                </div>
              )}
            </div>

            {/* Fare & Payment Type */}
            <div className="fare-liquid-display">
              <div className="fare-amount-block">
                <span className="currency-symbol">₹</span>
                <span className="fare-digits">{rideRequest.fare}</span>
              </div>
              <span className="payment-tag-pill">{rideRequest.paymentMethod?.toUpperCase()}</span>
            </div>

            {/* Trip Metrics */}
            <div className="trip-metrics-grid">
              <div className="metric-glass-pill">
                <RouteIcon size={18} color="#61d4fb" />
                <div className="metric-text-group">
                  <span className="metric-val">{rideRequest.distance}</span>
                  <span className="metric-lbl">Total Distance</span>
                </div>
              </div>
              <div className="metric-glass-pill">
                <ClockIcon size={18} color="#38bdf8" />
                <div className="metric-text-group">
                  <span className="metric-val">{rideRequest.duration}</span>
                  <span className="metric-lbl">Est. Duration</span>
                </div>
              </div>
            </div>

            {/* Pickup & Dropoff Route Map Item */}
            <div className="liquid-route-container">
              <div className="route-stop">
                <div className="stop-marker pickup-glow"></div>
                <div className="stop-details">
                  <span className="stop-tag">PICKUP LOCATION</span>
                  <span className="stop-name">{rideRequest.pickup}</span>
                </div>
              </div>
              <div className="route-flow-line"></div>
              <div className="route-stop">
                <div className="stop-marker dropoff-glow"></div>
                <div className="stop-details">
                  <span className="stop-tag">DROPOFF DESTINATION</span>
                  <span className="stop-name">{rideRequest.dropoff}</span>
                </div>
              </div>
            </div>

            {/* Accept / Decline Action Bar */}
            <div className="request-liquid-actions">
              <button 
                className="liquid-btn-decline"
                onClick={handleDeclineRide}
              >
                Decline
              </button>
              <button 
                className="liquid-btn-accept"
                onClick={handleAcceptRide}
                disabled={loading}
              >
                <div className="btn-sheen-sweep"></div>
                <ZapIcon size={16} color="#090d16" />
                <span>{loading ? 'ACCEPTING...' : 'ACCEPT TRIP'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. BOTTOM FLOATING LIQUID GLASS COCKPIT                      */}
      {/* ============================================================ */}
      <footer className="driver-cockpit-island">
        <div className="cockpit-specular-light"></div>

        {/* Daily Goal & Metrics Row */}
        <div className="cockpit-stats-row">
          <div className="stat-glass-cell">
            <span className="cell-lbl">Today's Earnings</span>
            <span className="cell-val gradient-currency">₹{earnings.today}</span>
          </div>

          <div className="stat-glass-cell">
            <span className="cell-lbl">Completed</span>
            <span className="cell-val">{earnings.trips} <small>trips</small></span>
          </div>

          <div className="stat-glass-cell">
            <span className="cell-lbl">Active Hours</span>
            <span className="cell-val">{onlineHours}</span>
          </div>

          <div className="stat-glass-cell">
            <span className="cell-lbl">Vehicle</span>
            <span className="cell-val category-pill-sm">{driverVehicle?.vehicleType || 'UberGo'}</span>
          </div>
        </div>

        {/* Daily Target Progress Bar */}
        <div className="daily-goal-bar-wrap">
          <div className="goal-header-row">
            <span className="goal-label">Daily Shift Goal: ₹{dailyGoal}</span>
            <span className="goal-percent">{goalPercent}% Achieved</span>
          </div>
          <div className="goal-progress-track">
            <div className="goal-progress-fill" style={{ width: `${goalPercent}%` }}></div>
          </div>
        </div>

        {/* Prominent Liquid Aurora GO ONLINE / GO OFFLINE Button */}
        <button 
          className={`liquid-master-go-btn ${isOnline ? 'is-online' : 'is-offline'}`}
          onClick={toggleOnlineStatus}
          disabled={loading}
        >
          <div className="liquid-sheen-highlight"></div>
          <div className="btn-content-inner">
            <PowerIcon size={18} color="currentColor" />
            <span className="btn-main-text">
              {loading ? 'CONNECTING DISPATCH...' : isOnline ? 'GO OFFLINE (END SHIFT)' : 'GO ONLINE — ACCEPT TRIPS'}
            </span>
          </div>
        </button>

        {/* Quick Drawer Action Links */}
        <div className="cockpit-quick-drawer">
          <button className="drawer-chip-btn" onClick={() => navigate('/history')}>
            <TrendingUpIcon size={13} color="#38bdf8" />
            <span>Shift Ledger</span>
          </button>
          <button className="drawer-chip-btn" onClick={() => navigate('/driver/documents')}>
            <DocumentIcon size={13} color="#b5c4ff" />
            <span>Vehicle KYC</span>
          </button>
          <button className="drawer-chip-btn" onClick={() => setShowSafetyModal(true)}>
            <ShieldIcon size={13} color="#f43f5e" />
            <span>24/7 Safety</span>
          </button>
          <button className="drawer-chip-btn" onClick={() => setShowSettingsModal(true)}>
            <SettingsIcon size={13} color="#61d4fb" />
            <span>Preferences</span>
          </button>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* 5. CAPTAIN SETTINGS LIQUID GLASS MODAL                       */}
      {/* ============================================================ */}
      {showSettingsModal && (
        <div className="captain-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="captain-liquid-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-title-wrap">
                <SettingsIcon size={20} color="#61d4fb" />
                <h3>Captain Preferences & Settings</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>

            <div className="modal-settings-list">
              {/* Auto-Accept Trips Toggle */}
              <div className="setting-toggle-row">
                <div className="setting-info">
                  <span className="setting-title">Auto-Accept Incoming Trips</span>
                  <span className="setting-desc">Instantly confirm nearest ride requests within 2 seconds</span>
                </div>
                <button 
                  className={`liquid-switch ${autoAccept ? 'active' : ''}`}
                  onClick={() => setAutoAccept(!autoAccept)}
                >
                  <div className="switch-thumb"></div>
                </button>
              </div>

              {/* Sound Alerts */}
              <div className="setting-toggle-row">
                <div className="setting-info">
                  <span className="setting-title">Audio & Sound Alerts</span>
                  <span className="setting-desc">Play high-priority chime on incoming trip requests</span>
                </div>
                <button 
                  className={`liquid-switch ${soundAlerts ? 'active' : ''}`}
                  onClick={() => setSoundAlerts(!soundAlerts)}
                >
                  <div className="switch-thumb"></div>
                </button>
              </div>

              {/* Navigation Provider */}
              <div className="setting-group-box">
                <span className="setting-title">Default Navigation Engine</span>
                <div className="nav-options-selector">
                  <button 
                    className={`nav-opt-btn ${navigationApp === 'google' ? 'selected' : ''}`}
                    onClick={() => setNavigationApp('google')}
                  >
                    <MapPinIcon size={14} color="currentColor" />
                    <span>Google Maps</span>
                  </button>
                  <button 
                    className={`nav-opt-btn ${navigationApp === 'inapp' ? 'selected' : ''}`}
                    onClick={() => setNavigationApp('inapp')}
                  >
                    <GpsCrosshairIcon size={14} color="currentColor" />
                    <span>In-App GPS</span>
                  </button>
                </div>
              </div>

              {/* Vehicle & Account Section */}
              <div className="setting-group-box">
                <span className="setting-title">Active Vehicle Category</span>
                <div className="vehicle-info-pill">
                  <div className="veh-detail-row">
                    <CarIcon size={16} color="#61d4fb" />
                    <span>{driverVehicle?.vehicleType || 'UberGo'} • {driverVehicle?.model || 'Maruti Dzire'} ({driverVehicle?.licensePlate || 'TN 07 CB 4567'})</span>
                  </div>
                  <button className="btn-change-vehicle" onClick={() => navigate('/driver/documents')}>Edit →</button>
                </div>
              </div>

              {/* Logout Button */}
              <div className="modal-actions-footer">
                <button className="btn-captain-logout" onClick={handleLogout}>
                  <LogOutIcon size={16} color="#fda4af" />
                  <span>Sign Out of Captain Portal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. CAPTAIN 24/7 SAFETY & SOS MODAL                          */}
      {/* ============================================================ */}
      {showSafetyModal && (
        <div className="captain-modal-overlay" onClick={() => setShowSafetyModal(false)}>
          <div className="captain-liquid-modal safety" onClick={e => e.stopPropagation()}>
            <div className="modal-top-bar">
              <div className="modal-title-wrap">
                <ShieldAlertIcon size={20} color="#f43f5e" />
                <h3>24/7 Captain Safety Toolkit</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setShowSafetyModal(false)}>✕</button>
            </div>

            <div className="safety-action-list">
              <button className="safety-btn-emergency" onClick={() => alert('🚨 Emergency SOS Dispatched: Police (112) & Emergency contacts alerted.')}>
                <ShieldAlertIcon size={26} color="#ffffff" />
                <div className="sos-text">
                  <strong>EMERGENCY SOS DISPATCH (112)</strong>
                  <span>Instantly share live GPS location with Police & Emergency Support</span>
                </div>
              </button>

              <button className="safety-btn-item" onClick={() => alert('📍 Live location link copied to clipboard to share with family.')}>
                <ShareIcon size={18} color="#38bdf8" />
                <span>Share Live Trip Location with Family</span>
              </button>

              <button className="safety-btn-item" onClick={() => alert('🎙️ In-cabin audio recording activated for trip safety.')}>
                <MicIcon size={18} color="#61d4fb" />
                <span>Activate Safety Audio Recording</span>
              </button>

              <button className="safety-btn-item" onClick={() => alert('📞 Connecting to 24/7 Captain Dedicated Helpline...')}>
                <PhoneCallIcon size={18} color="#34d399" />
                <span>Call 24/7 Dedicated Captain Helpline</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverHome;
