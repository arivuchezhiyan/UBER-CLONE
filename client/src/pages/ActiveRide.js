import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveRide, cancelRide, completeRide, startRide, getDriverUpiId, confirmOnlinePayment } from '../services/api';
import RideMap from '../components/Map/RideMap';
import io from 'socket.io-client';
import './ActiveRide.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function ActiveRide({ user }) {
  const navigate = useNavigate();
  const isDriver = user?.userType === 'driver';
  
  const [rideStatus, setRideStatus] = useState(isDriver ? 'arriving' : 'searching');
  const [eta, setEta] = useState(4);
  const [booking, setBooking] = useState(null);
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
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
        if (newStatus === 'cancelled') {
          alert('Ride has been cancelled');
          localStorage.removeItem('activeBooking');
          navigate('/');
        } else if (newStatus === 'completed') {
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
        alert(isDriver ? 'Customer cancelled' : 'Driver cancelled');
        localStorage.removeItem('activeBooking');
        navigate('/');
      }
    });
    
    socket.on('ride-started', (data) => {
      if (booking?._id === data.bookingId) setRideStatus('started');
    });
    
    socket.on('ride-completed', (data) => {
      if (booking?._id === data.bookingId) {
        localStorage.removeItem('activeBooking');
        navigate('/history');
      }
    });
    
    socket.on('driver-assigned', (data) => {
      if (booking?._id === data.bookingId && !isDriver) {
        setBooking(prev => ({ ...prev, driverId: data.driver }));
        setRideStatus('waiting');
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
        setRideStatus(parsed.status || (isDriver ? 'arriving' : 'searching'));
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
            setRideStatus(response.data.status || (isDriver ? 'arriving' : 'searching'));
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

  const handleStartRide = async () => {
    if (!otp) {
      setShowOtpInput(true);
      return;
    }
    setLoading(true);
    try {
      const response = await startRide(booking._id, otp);
      if (response.data.success) {
        setRideStatus('started');
        setShowOtpInput(false);
        localStorage.setItem('activeBooking', JSON.stringify({ ...booking, status: 'started' }));
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
      case 'searching': return 'Finding your driver...';
      case 'accepted': return 'Driver assigned!';
      case 'waiting': return `Driver arriving in ${eta} min`;
      case 'arriving': return 'Arriving at pickup';
      case 'arrived': return 'Driver has arrived';
      case 'started': return 'Trip in progress';
      default: return 'In progress';
    }
  };

  const driver = booking?.driverId || {};
  const rideDetails = {
    pickup: booking?.pickupLocation?.address || 'Pickup',
    dropoff: booking?.dropoffLocation?.address || 'Dropoff',
    fare: booking?.estimatedFare || 149,
    otp: booking?.rideOTP
  };

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
          {rideStatus === 'searching' && <div className="searching-dots"><span></span><span></span><span></span></div>}
          <span>{getStatusMessage()}</span>
        </div>
      </div>

      {/* OTP Banner for Customer */}
      {!isDriver && rideDetails.otp && rideStatus !== 'started' && rideStatus !== 'searching' && (
        <div className="otp-display">
          <span className="otp-label">OTP for driver</span>
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
            {(rideStatus !== 'searching') && (
              <div className="driver-card">
                <div className="driver-avatar">
                  {driver.name?.charAt(0) || '?'}
                </div>
                <div className="driver-info">
                  <h3>{driver.name || 'Finding driver...'}</h3>
                  <div className="driver-meta">
                    <span className="rating">⭐ {driver.rating || 4.8}</span>
                    <span className="vehicle">{driver.vehicleDetails?.model || 'Swift Dzire'}</span>
                  </div>
                  <span className="plate">{driver.vehicleDetails?.licensePlate || 'KA 01 XX 1234'}</span>
                </div>
                <div className="contact-btns">
                  <button className="contact-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.574 2.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                  </button>
                  <button className="contact-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
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

            {/* Fare Info */}
            <div className="fare-card">
              <div className="fare-row">
                <span>Trip fare</span>
                <span className="fare-amount">₹{rideDetails.fare}</span>
              </div>
              <div className="payment-method">
                <span>💵 {booking?.paymentMethod || 'Cash'}</span>
              </div>
            </div>
          </>
        )}

        {/* Driver View */}
        {isDriver && (
          <>
            {/* Customer Info */}
            <div className="customer-card">
              <div className="customer-avatar">
                {booking?.customerId?.name?.charAt(0) || 'C'}
              </div>
              <div className="customer-info">
                <h3>{booking?.customerId?.name || 'Customer'}</h3>
                <span className="rating">⭐ {booking?.customerId?.rating || 4.5}</span>
              </div>
              <div className="contact-btns">
                <button className="contact-btn">📞</button>
                <button className="contact-btn">💬</button>
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
                <span>Fare</span>
                <span className="fare-amount">₹{rideDetails.fare}</span>
              </div>
              <div className="payment-method">
                <span>💵 {booking?.paymentMethod || 'Cash'}</span>
              </div>
            </div>

            {/* Driver Actions */}
            <div className="driver-actions">
              {(rideStatus === 'arriving' || rideStatus === 'arrived' || rideStatus === 'waiting') && (
                <button className="action-btn primary" onClick={handleStartRide}>
                  Start Ride
                </button>
              )}
              {rideStatus === 'started' && (
                <button className="action-btn complete" onClick={handleEndRide} disabled={loading}>
                  {loading ? 'Completing...' : 'Complete Ride'}
                </button>
              )}
            </div>
          </>
        )}

        {/* Cancel Button */}
        {rideStatus !== 'started' && (
          <button className="cancel-ride-btn" onClick={() => setShowCancelSheet(true)}>
            Cancel Ride
          </button>
        )}
      </div>

      {/* OTP Input Modal */}
      {showOtpInput && (
        <div className="modal-overlay">
          <div className="otp-modal">
            <h3>Enter OTP</h3>
            <p>Ask customer for the 4-digit code</p>
            <input
              type="text"
              maxLength={4}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • •"
            />
            <button className="verify-btn" onClick={handleStartRide} disabled={loading || otp.length !== 4}>
              {loading ? 'Verifying...' : 'Start Ride'}
            </button>
            <button className="cancel-modal-btn" onClick={() => setShowOtpInput(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Sheet */}
      {showCancelSheet && (
        <div className="modal-overlay" onClick={() => setShowCancelSheet(false)}>
          <div className="cancel-sheet" onClick={e => e.stopPropagation()}>
            <h3>Cancel this ride?</h3>
            <p>You may be charged a cancellation fee.</p>
            <button className="cancel-confirm-btn" onClick={handleCancel} disabled={loading}>
              {loading ? 'Cancelling...' : 'Yes, Cancel Ride'}
            </button>
            <button className="keep-btn" onClick={() => setShowCancelSheet(false)}>Keep Ride</button>
          </div>
        </div>
      )}

      {/* UPI Payment Modal */}
      {showUpiPayment && (
        <div className="modal-overlay">
          <div className="upi-modal">
            <h3>Collect Payment</h3>
            <div className="upi-amount">₹{completedBooking?.actualFare || completedBooking?.estimatedFare}</div>
            {driverUpiId && (
              <div className="upi-info">
                <p>Your UPI: {driverUpiId}</p>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=${encodeURIComponent(driverUpiId)}&am=${completedBooking?.actualFare || completedBooking?.estimatedFare}`}
                  alt="QR"
                  className="qr-code"
                />
              </div>
            )}
            <button className="confirm-payment-btn" onClick={handlePaymentConfirmed}>Payment Received</button>
            <button className="cash-btn" onClick={() => { localStorage.removeItem('activeBooking'); navigate('/history'); }}>
              Paid in Cash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActiveRide;
