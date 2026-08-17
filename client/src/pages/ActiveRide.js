import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getActiveRide,
  cancelRide,
  completeRide,
  startRide,
  markDriverArrived,
  getDriverUpiId,
  confirmOnlinePayment
} from '../services/api';
import RideMap from '../components/Map/RideMap';
import io from 'socket.io-client';
import './ActiveRide.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function ActiveRide({ user }) {
  const navigate = useNavigate();
  const isDriver = user?.userType === 'driver';
  
  const [rideStatus, setRideStatus] = useState(isDriver ? 'DRIVER_ARRIVING' : 'SEARCHING_DRIVER');
  const [eta, setEta] = useState(4);
  const [booking, setBooking] = useState(null);
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showFareBreakdown, setShowFareBreakdown] = useState(false);
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [showUpiPayment, setShowUpiPayment] = useState(false);
  const [driverUpiId, setDriverUpiId] = useState('');
  const [completedBooking, setCompletedBooking] = useState(null);

  // Poll for ride status
  const pollRideStatus = useCallback(async () => {
    if (!booking?._id) return;
    try {
      const response = await getActiveRide();
      if (response.data) {
        setBooking(prev => ({ ...prev, ...response.data }));
        const newStatus = response.data.status;
        if (['CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'cancelled'].includes(newStatus)) {
          alert('Ride has been cancelled');
          localStorage.removeItem('activeBooking');
          navigate('/');
        } else if (['TRIP_COMPLETED', 'SETTLED', 'completed'].includes(newStatus)) {
          localStorage.removeItem('activeBooking');
          navigate('/history');
        } else if (newStatus !== rideStatus) {
          setRideStatus(newStatus);
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [booking?._id, navigate, rideStatus]);

  // Socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    
    socket.on('ride-cancelled', (data) => {
      if (booking?._id === data.bookingId) {
        alert(isDriver ? 'Customer cancelled the ride' : 'Ride was cancelled');
        localStorage.removeItem('activeBooking');
        navigate('/');
      }
    });
    
    socket.on('driver-arrived', (data) => {
      if (booking?._id === data.bookingId) {
        setRideStatus('DRIVER_ARRIVED');
      }
    });

    socket.on('ride-started', (data) => {
      if (booking?._id === data.bookingId) setRideStatus('TRIP_STARTED');
    });
    
    socket.on('ride-completed', (data) => {
      if (booking?._id === data.bookingId) {
        localStorage.removeItem('activeBooking');
        navigate('/history');
      }
    });
    
    socket.on('ride-taken', (data) => {
      if (booking?._id === data.bookingId && !isDriver) {
        setRideStatus('DRIVER_ASSIGNED');
      }
    });
    
    return () => socket.disconnect();
  }, [booking?._id, isDriver, navigate]);

  // Poll every 5s
  useEffect(() => {
    const interval = setInterval(pollRideStatus, 5000);
    return () => clearInterval(interval);
  }, [pollRideStatus]);

  // Load booking
  useEffect(() => {
    const loadBooking = async () => {
      const stored = localStorage.getItem('activeBooking');
      if (stored) {
        const parsed = JSON.parse(stored);
        setBooking(parsed);
        setRideStatus(parsed.status || (isDriver ? 'DRIVER_ARRIVING' : 'SEARCHING_DRIVER'));
        if (parsed.pickupCoords) setPickupCoords(parsed.pickupCoords);
        else if (parsed.pickupLocation?.latitude) {
          setPickupCoords({ lat: parsed.pickupLocation.latitude, lng: parsed.pickupLocation.longitude });
        }
        if (parsed.dropoffCoords) setDropoffCoords(parsed.dropoffCoords);
        else if (parsed.dropoffLocation?.latitude) {
          setDropoffCoords({ lat: parsed.dropoffLocation.latitude, lng: parsed.dropoffLocation.longitude });
        }
      } else {
        try {
          const response = await getActiveRide();
          if (response.data) {
            setBooking(response.data);
            setRideStatus(response.data.status || (isDriver ? 'DRIVER_ARRIVING' : 'SEARCHING_DRIVER'));
            localStorage.setItem('activeBooking', JSON.stringify(response.data));
          } else {
            navigate('/');
          }
        } catch (err) {
          navigate('/');
        }
      }
    };
    loadBooking();
  }, [isDriver, navigate]);

  // ETA countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setEta(prev => prev > 0 ? prev - 1 : 0);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleMarkArrived = async () => {
    setLoading(true);
    try {
      const response = await markDriverArrived(booking._id);
      if (response.data.success) {
        setRideStatus('DRIVER_ARRIVED');
        localStorage.setItem('activeBooking', JSON.stringify({ ...booking, status: 'DRIVER_ARRIVED' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to mark arrival');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRide = async () => {
    if (!otp) {
      setShowOtpInput(true);
      return;
    }
    setLoading(true);
    try {
      const response = await startRide(booking._id, otp);
      if (response.data.success) {
        setRideStatus('TRIP_STARTED');
        setShowOtpInput(false);
        localStorage.setItem('activeBooking', JSON.stringify({ ...booking, status: 'TRIP_STARTED' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleEndRide = async () => {
    setLoading(true);
    try {
      const response = await completeRide(booking._id, booking.estimatedDistance, booking.estimatedDuration);
      const paymentMethod = booking?.paymentMethod?.toLowerCase() || 'cash';
      
      if (isDriver && (paymentMethod === 'upi' || paymentMethod === 'online')) {
        try {
          const upiRes = await getDriverUpiId();
          setDriverUpiId(upiRes.data.upiId || '');
        } catch (e) {}
        setCompletedBooking({
          ...booking,
          actualFare: response.data.booking?.actualFare || booking.estimatedFare
        });
        setShowUpiPayment(true);
        setLoading(false);
      } else {
        localStorage.removeItem('activeBooking');
        navigate('/history');
      }
    } catch (err) {
      alert('Failed to complete ride');
      setLoading(false);
    }
  };

  const handlePaymentConfirmed = async () => {
    try {
      await confirmOnlinePayment(completedBooking._id, completedBooking.actualFare || completedBooking.estimatedFare);
      localStorage.removeItem('activeBooking');
      navigate('/history');
    } catch (err) {
      alert('Failed to confirm payment');
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await cancelRide(booking._id, isDriver ? 'Driver cancelled' : 'Customer cancelled', isDriver ? 'driver' : 'customer');
      localStorage.removeItem('activeBooking');
      navigate('/');
    } catch (err) {
      alert('Failed to cancel');
      setLoading(false);
    }
  };

  const getStatusMessage = () => {
    switch(rideStatus) {
      case 'REQUESTED':
      case 'SEARCHING_DRIVER':
      case 'searching': return 'Matching nearest driver (30s sequential dispatch)...';
      case 'DRIVER_ASSIGNED':
      case 'accepted': return 'Driver assigned & accepted!';
      case 'DRIVER_ARRIVING':
      case 'waiting':
      case 'arriving': return `Driver arriving at pickup in ~${eta} min`;
      case 'DRIVER_ARRIVED':
      case 'arrived': return 'Driver has arrived at pickup point!';
      case 'TRIP_STARTED':
      case 'started': return 'Trip in progress — GPS tracked';
      case 'TRIP_COMPLETED': return 'Trip completed';
      default: return 'Ride In Progress';
    }
  };

  const driver = booking?.driverId || {};
  const rideDetails = {
    pickup: booking?.pickupLocation?.address || 'Pickup',
    dropoff: booking?.dropoffLocation?.address || 'Dropoff',
    fare: booking?.actualFare || booking?.estimatedFare || 149,
    otp: booking?.rideOTP,
    breakdown: booking?.fareBreakdown
  };

  const isTripActive = ['TRIP_STARTED', 'started'].includes(rideStatus);

  return (
    <div className="active-ride-app">
      {/* Map Section */}
      <div className="active-map-container">
        <RideMap
          pickup={pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : null}
          dropoff={dropoffCoords ? [dropoffCoords.lat, dropoffCoords.lng] : null}
          showRoute={true}
          showCar={true}
          height="100%"
        />
        
        {/* Back/Close Button */}
        <button className="close-btn" onClick={() => setShowCancelSheet(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Status Pill */}
        <div className={`status-pill ${rideStatus}`}>
          {['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(rideStatus) && (
            <div className="searching-dots"><span></span><span></span><span></span></div>
          )}
          <span>{getStatusMessage()}</span>
        </div>
      </div>

      {/* OTP Banner for Customer */}
      {!isDriver && rideDetails.otp && !isTripActive && !['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(rideStatus) && (
        <div className="otp-display">
          <span className="otp-label">Share 4-Digit Ride OTP with Driver:</span>
          <span className="otp-code">{rideDetails.otp}</span>
        </div>
      )}

      {/* Bottom Panel */}
      <div className="ride-info-panel">
        <div className="panel-handle"><div className="handle-bar"></div></div>

        {/* Customer View */}
        {!isDriver && (
          <>
            {/* Driver Info */}
            {!['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(rideStatus) && (
              <div className="driver-card">
                <div className="driver-avatar">
                  {driver.name?.charAt(0) || '👨‍✈️'}
                </div>
                <div className="driver-info">
                  <h3>{driver.name || 'Assigned Driver'}</h3>
                  <div className="driver-meta">
                    <span className="rating">⭐ {driver.rating || 5.0}</span>
                    <span className="vehicle">{driver.vehicleDetails?.model || booking?.vehicleType || 'Sedan'}</span>
                  </div>
                  <span className="plate">{driver.vehicleDetails?.licensePlate || 'KA 01 AB 1234'}</span>
                </div>
                <div className="contact-btns">
                  <button className="contact-btn" onClick={() => alert(`Calling driver at ${driver.phone || '+91 9876543210'}`)}>
                    📞
                  </button>
                </div>
              </div>
            )}

            {/* Route Info */}
            <div className="route-card">
              <div className="route-point">
                <div className="point-dot green"></div>
                <span>{rideDetails.pickup}</span>
              </div>
              <div className="route-point">
                <div className="point-dot black"></div>
                <span>{rideDetails.dropoff}</span>
              </div>
            </div>

            {/* Fare Info & Itemized Breakdown */}
            <div className="fare-card" onClick={() => setShowFareBreakdown(!showFareBreakdown)} style={{ cursor: 'pointer' }}>
              <div className="fare-row">
                <span>Trip Fare {showFareBreakdown ? '▲' : '▼'}</span>
                <span className="fare-amount">₹{rideDetails.fare}</span>
              </div>
              <div className="payment-method">
                <span>💵 {booking?.paymentMethod?.toUpperCase() || 'CASH'}</span>
                {booking?.fareBreakdown?.surgeMultiplier > 1 && (
                  <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>
                    ⚡ {booking.fareBreakdown.surgeMultiplier}x Surge
                  </span>
                )}
              </div>

              {/* Collapsible Itemized Fare Receipt */}
              {showFareBreakdown && booking?.fareBreakdown && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Base Fare</span>
                    <span>₹{booking.fareBreakdown.baseFare}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Distance Fare ({booking.estimatedDistance || 5} km)</span>
                    <span>₹{booking.fareBreakdown.distanceFare}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Time Fare ({booking.estimatedDuration || 15} min)</span>
                    <span>₹{booking.fareBreakdown.timeFare}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>GST (5%)</span>
                    <span>₹{booking.fareBreakdown.taxAmount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '6px' }}>
                    <span>Total Amount</span>
                    <span>₹{booking.fareBreakdown.totalFare}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Driver View */}
        {isDriver && (
          <>
            {/* Customer Info */}
            <div className="customer-card">
              <div className="customer-avatar">
                {booking?.customerId?.name?.charAt(0) || '👤'}
              </div>
              <div className="customer-info">
                <h3>{booking?.customerId?.name || 'Customer'}</h3>
                <span className="rating">⭐ {booking?.customerId?.rating || 5.0}</span>
              </div>
              <div className="contact-btns">
                <button className="contact-btn" onClick={() => alert(`Calling customer at ${booking?.customerId?.phone || '+91 9000000001'}`)}>
                  📞
                </button>
              </div>
            </div>

            {/* Route Info */}
            <div className="route-card">
              <div className="route-point">
                <div className="point-dot green"></div>
                <span>{rideDetails.pickup}</span>
              </div>
              <div className="route-point">
                <div className="point-dot black"></div>
                <span>{rideDetails.dropoff}</span>
              </div>
            </div>

            {/* Fare & Payment */}
            <div className="fare-card">
              <div className="fare-row">
                <span>Estimated Earnings</span>
                <span className="fare-amount text-success">
                  ₹{booking?.fareBreakdown?.driverEarnings || Math.round(rideDetails.fare * 0.8)}
                </span>
              </div>
              <div className="payment-method">
                <span>Payment: 💵 {booking?.paymentMethod?.toUpperCase() || 'CASH'}</span>
              </div>
            </div>

            {/* Driver Actions: Arrived -> Start with OTP -> Complete */}
            <div className="driver-actions">
              {['DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'accepted', 'arriving'].includes(rideStatus) && (
                <button className="action-btn secondary" onClick={handleMarkArrived} disabled={loading} style={{ background: '#3b82f6' }}>
                  Mark Arrived at Pickup
                </button>
              )}

              {['DRIVER_ARRIVED', 'arrived'].includes(rideStatus) && (
                <button className="action-btn primary" onClick={handleStartRide} disabled={loading}>
                  Verify OTP & Start Trip
                </button>
              )}

              {isTripActive && (
                <button className="action-btn complete" onClick={handleEndRide} disabled={loading}>
                  {loading ? 'Completing...' : 'Complete Trip'}
                </button>
              )}
            </div>
          </>
        )}

        {/* Cancel Button */}
        {!isTripActive && (
          <button className="cancel-ride-btn" onClick={() => setShowCancelSheet(true)}>
            Cancel Ride
          </button>
        )}
      </div>

      {/* OTP Input Modal */}
      {showOtpInput && (
        <div className="modal-overlay">
          <div className="otp-modal">
            <h3>Enter Rider OTP</h3>
            <p>Ask customer for their 4-digit verification code</p>
            <input
              type="text"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • •"
              style={{ fontSize: '28px', textAlign: 'center', letterSpacing: '8px' }}
            />
            <button className="verify-btn" onClick={handleStartRide} disabled={loading || otp.length !== 4}>
              {loading ? 'Verifying...' : 'Verify & Start Trip'}
            </button>
            <button className="cancel-modal-btn" onClick={() => setShowOtpInput(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Sheet */}
      {showCancelSheet && (
        <div className="modal-overlay">
          <div className="cancel-sheet">
            <h3>Cancel this ride?</h3>
            <p>Are you sure you want to cancel? Cancellation fees may apply if driver is already en route.</p>
            <button className="confirm-cancel-btn" onClick={handleCancel} disabled={loading}>
              {loading ? 'Cancelling...' : 'Yes, Cancel Ride'}
            </button>
            <button className="keep-ride-btn" onClick={() => setShowCancelSheet(false)}>Keep Ride</button>
          </div>
        </div>
      )}

      {/* UPI Payment Modal for Driver */}
      {showUpiPayment && (
        <div className="modal-overlay">
          <div className="upi-modal">
            <h3>Collect Payment</h3>
            <p>Show this QR / UPI ID to customer</p>
            <div className="upi-details">
              <strong>₹{completedBooking?.actualFare || completedBooking?.estimatedFare}</strong>
              <span>UPI: {driverUpiId || 'driver@upi'}</span>
            </div>
            <button className="verify-btn" onClick={handlePaymentConfirmed}>
              Payment Received
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveRide;
