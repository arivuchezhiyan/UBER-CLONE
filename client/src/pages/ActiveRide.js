import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  getActiveRide,
  cancelRide,
  completeRide,
  startRide,
  markDriverArrived,
  rateRide,
  getDriverUpiId,
  confirmOnlinePayment
} from '../services/api';
import RideMap from '../components/Map/RideMap';
import SlideButton from '../components/SlideButton/SlideButton';
import { processRazorpayPayment } from '../services/razorpay';
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

  // Settlement & QR Payment State
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('UPI_QR'); // 'UPI_QR', 'RAZORPAY', 'CASH'
  const [driverUpiId, setDriverUpiId] = useState('uberclone.driver@upi');
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

  // Rating & Review State (Customer)
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [feedbackTags, setFeedbackTags] = useState([]);
  const [feedbackText, setFeedbackText] = useState('');

  // Fetch driver UPI ID on load
  useEffect(() => {
    if (isDriver) {
      getDriverUpiId()
        .then(res => {
          if (res.data?.upiId) setDriverUpiId(res.data.upiId);
        })
        .catch(() => {});
    }
  }, [isDriver]);

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
        } else if (['TRIP_COMPLETED', 'completed'].includes(newStatus) && !isDriver) {
          setRideStatus('TRIP_COMPLETED');
          setShowRatingModal(true);
        } else if (['SETTLED'].includes(newStatus)) {
          if (!isDriver) {
            setShowRatingModal(true);
          }
        } else if (newStatus !== rideStatus) {
          setRideStatus(newStatus);
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, [booking?._id, isDriver, navigate, rideStatus]);

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
        setRideStatus('TRIP_COMPLETED');
        if (!isDriver) {
          setShowRatingModal(true);
        }
      }
    });

    socket.on('payment-completed', (data) => {
      if (booking?._id === data.bookingId) {
        setIsPaymentConfirmed(true);
        setRideStatus('SETTLED');
        if (!isDriver) {
          setShowRatingModal(true);
        }
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

  // Driver Slides to End Ride
  const handleSlideEndRide = async () => {
    setLoading(true);
    try {
      const response = await completeRide(
        booking._id,
        booking.estimatedDistance || 5,
        booking.estimatedDuration || 15
      );
      if (response.data.success) {
        setBooking(prev => ({
          ...prev,
          actualFare: response.data.fare,
          fareBreakdown: response.data.fareBreakdown,
          status: 'TRIP_COMPLETED'
        }));
        setRideStatus('TRIP_COMPLETED');
        setShowSettlementModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete trip');
    } finally {
      setLoading(false);
    }
  };

  // Driver Marks Payment Confirmed
  const handleDriverConfirmPayment = async () => {
    setLoading(true);
    try {
      await confirmOnlinePayment(booking._id, booking.actualFare || booking.estimatedFare);
      setIsPaymentConfirmed(true);
      alert('🎉 Payment Confirmed & Driver Wallet Credited!');
      localStorage.removeItem('activeBooking');
      navigate('/history');
    } catch (err) {
      alert('Failed to settle payment');
    } finally {
      setLoading(false);
    }
  };

  // Customer Pays via Razorpay
  const handlePayWithRazorpay = async () => {
    setLoading(true);
    try {
      await processRazorpayPayment({
        bookingId: booking._id,
        amount: rideDetails.fare,
        purpose: 'RIDE_PAYMENT',
        customer: {
          name: user?.name,
          phone: user?.phone,
          email: user?.email
        },
        onSuccess: (paymentInfo) => {
          alert(`✅ Payment of ₹${paymentInfo.amount} successful via Razorpay! Payment ID: ${paymentInfo.paymentId}`);
          setBooking(prev => ({ ...prev, paymentStatus: 'completed', paymentMethod: 'online', status: 'SETTLED' }));
          setIsPaymentConfirmed(true);
          setShowRatingModal(true);
          setLoading(false);
        },
        onFailure: (err) => {
          alert(`Payment: ${err.message}`);
          setLoading(false);
        }
      });
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  // Customer Submit Rating
  const handleSubmitRating = async () => {
    setLoading(true);
    try {
      const fullFeedback = [feedbackTags.join(', '), feedbackText].filter(Boolean).join(' - ');
      await rateRide(booking._id, selectedRating, fullFeedback, 'driver');
      alert('⭐ Thank you for your feedback!');
      localStorage.removeItem('activeBooking');
      navigate('/history');
    } catch (err) {
      alert('Failed to submit rating');
    } finally {
      setLoading(false);
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
      case 'searching': return 'Finding Captain (30s sequential matching)...';
      case 'DRIVER_ASSIGNED':
      case 'accepted': return 'Captain assigned & accepted!';
      case 'DRIVER_ARRIVING':
      case 'waiting':
      case 'arriving': return `Captain arriving in ~${eta} min`;
      case 'DRIVER_ARRIVED':
      case 'arrived': return 'Captain has arrived at pickup point!';
      case 'TRIP_STARTED':
      case 'started': return 'Trip in progress — GPS tracked';
      case 'TRIP_COMPLETED': return 'Trip Completed — Payment Pending';
      case 'SETTLED': return 'Payment Complete & Settled';
      default: return 'Ride In Progress';
    }
  };

  const driver = booking?.driverId || {};
  const fareAmount = booking?.actualFare || booking?.estimatedFare || 149;
  const rideDetails = {
    pickup: booking?.pickupLocation?.address || 'Pickup Location',
    dropoff: booking?.dropoffLocation?.address || 'Dropoff Location',
    fare: fareAmount,
    otp: booking?.rideOTP,
    breakdown: booking?.fareBreakdown
  };

  const isTripActive = ['TRIP_STARTED', 'started'].includes(rideStatus);
  const upiQrString = `upi://pay?pa=${driverUpiId || 'driver@upi'}&pn=${encodeURIComponent(driver.name || 'Uber Driver')}&am=${fareAmount}&cu=INR&tn=Ride-${booking?.rideNumber || booking?._id || 'Payment'}`;

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
        {!isTripActive && rideStatus !== 'TRIP_COMPLETED' && (
          <button className="close-btn" onClick={() => setShowCancelSheet(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        )}

        {/* Status Pill */}
        <div className={`status-pill ${rideStatus}`}>
          {['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(rideStatus) && (
            <div className="searching-dots"><span></span><span></span><span></span></div>
          )}
          <span>{getStatusMessage()}</span>
        </div>
      </div>

      {/* OTP Banner for Customer */}
      {!isDriver && rideDetails.otp && !isTripActive && !['SEARCHING_DRIVER', 'searching', 'REQUESTED', 'TRIP_COMPLETED', 'SETTLED'].includes(rideStatus) && (
        <div className="otp-display">
          <span className="otp-label">Share 4-Digit Ride OTP with Captain:</span>
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
                  <h3>{driver.name || 'Captain'}</h3>
                  <div className="driver-meta">
                    <span className="rating">⭐ {driver.rating || 5.0}</span>
                    <span className="vehicle">{driver.vehicleDetails?.model || booking?.vehicleType || 'Sedan'}</span>
                  </div>
                  <span className="plate">{driver.vehicleDetails?.licensePlate || 'KA 01 AB 1234'}</span>
                </div>
                <div className="contact-btns">
                  <button className="contact-btn" onClick={() => alert(`Calling Captain at ${driver.phone || '+91 9876543210'}`)}>
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

            {/* Pay with Razorpay Online Button for Customer */}
            {booking?.paymentStatus !== 'completed' && !['SEARCHING_DRIVER', 'searching', 'REQUESTED'].includes(rideStatus) && (
              <button 
                className="action-btn primary" 
                onClick={handlePayWithRazorpay}
                disabled={loading}
                style={{ 
                  marginTop: '12px', 
                  background: 'linear-gradient(135deg, #02042b 0%, #0c2340 100%)', 
                  border: '1px solid #3399cc',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px' 
                }}
              >
                <span>💳 Pay ₹{rideDetails.fare} Online (UPI / Card / NetBanking)</span>
              </button>
            )}
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
                <span>Your Net Earnings</span>
                <span className="fare-amount text-success">
                  ₹{booking?.fareBreakdown?.driverEarnings || Math.round(rideDetails.fare * 0.8)}
                </span>
              </div>
              <div className="payment-method">
                <span>Trip Fare: ₹{rideDetails.fare} ({booking?.paymentMethod?.toUpperCase() || 'CASH'})</span>
              </div>
            </div>

            {/* Driver Actions */}
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

              {/* SLIDE BUTTON TO COMPLETE RIDE */}
              {isTripActive && (
                <SlideButton
                  onSlideComplete={handleSlideEndRide}
                  text="👉 Slide to End Trip"
                  disabled={loading}
                />
              )}

              {rideStatus === 'TRIP_COMPLETED' && (
                <button 
                  className="action-btn primary" 
                  onClick={() => setShowSettlementModal(true)}
                  style={{ background: '#10b981' }}
                >
                  ⚡ Open Payment QR & Settle (₹{rideDetails.fare})
                </button>
              )}
            </div>
          </>
        )}

        {/* Cancel Button */}
        {!isTripActive && rideStatus !== 'TRIP_COMPLETED' && rideStatus !== 'SETTLED' && (
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

      {/* DRIVER / CAPTAIN SETTLEMENT & QR CODE MODAL */}
      {showSettlementModal && (
        <div className="modal-overlay">
          <div className="settlement-modal">
            <div className="settlement-header">
              <h2>Trip Ended</h2>
              <span className="fare-badge">Collect ₹{rideDetails.fare}</span>
            </div>

            {/* Payment Mode Selector */}
            <div className="payment-mode-tabs">
              <button 
                className={`tab-btn ${paymentMode === 'UPI_QR' ? 'active' : ''}`}
                onClick={() => setPaymentMode('UPI_QR')}
              >
                ⚡ UPI QR Code
              </button>
              <button 
                className={`tab-btn ${paymentMode === 'RAZORPAY' ? 'active' : ''}`}
                onClick={() => setPaymentMode('RAZORPAY')}
              >
                💳 Cards / Online
              </button>
              <button 
                className={`tab-btn ${paymentMode === 'CASH' ? 'active' : ''}`}
                onClick={() => setPaymentMode('CASH')}
              >
                💵 Cash
              </button>
            </div>

            {/* TAB 1: DYNAMIC UPI QR CODE */}
            {paymentMode === 'UPI_QR' && (
              <div className="qr-container">
                <p className="qr-instruction">Scan with any UPI app (GPay / PhonePe / Paytm):</p>
                <div className="qr-code-wrapper">
                  <QRCodeSVG 
                    value={upiQrString}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <span className="upi-id-label">UPI ID: {driverUpiId}</span>
                <div className="supported-apps">
                  <span>🟢 PhonePe</span>
                  <span>🔵 Google Pay</span>
                  <span>🟦 Paytm</span>
                  <span>🟠 BHIM</span>
                </div>
              </div>
            )}

            {/* TAB 2: RAZORPAY ONLINE CHECKOUT */}
            {paymentMode === 'RAZORPAY' && (
              <div className="razorpay-online-pane">
                <p>Accept Cards (Debit / Credit), NetBanking, and Wallets via Razorpay Gateway:</p>
                <button className="btn-razorpay-checkout" onClick={handlePayWithRazorpay} disabled={loading}>
                  💳 Launch Razorpay Checkout (₹{rideDetails.fare})
                </button>
              </div>
            )}

            {/* TAB 3: CASH COLLECTION */}
            {paymentMode === 'CASH' && (
              <div className="cash-pane">
                <div className="cash-icon">💵</div>
                <h3>Collect Cash from Customer</h3>
                <div className="cash-amount-box">
                  <span className="label">Amount to Collect:</span>
                  <span className="value">₹{rideDetails.fare}</span>
                </div>
              </div>
            )}

            {/* Confirmation & Completion Button */}
            {isPaymentConfirmed && (
              <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontWeight: 'bold' }}>
                🎉 Payment Settled Online!
              </div>
            )}
            <button 
              className="btn-confirm-settlement" 
              onClick={handleDriverConfirmPayment}
              disabled={loading}
            >
              {isPaymentConfirmed ? 'Finish & Return Home' : '✅ Payment Received (Finish Ride)'}
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMER RATING & REVIEW MODAL */}
      {showRatingModal && (
        <div className="modal-overlay">
          <div className="rating-modal">
            <div className="rating-header">
              <h2>🎉 Trip Completed!</h2>
              <p>How was your ride with {driver.name || 'your Captain'}?</p>
            </div>

            {/* Star Rating */}
            <div className="stars-row">
              {[1, 2, 3, 4, 5].map((star) => (
                <span 
                  key={star} 
                  className={`star-btn ${star <= selectedRating ? 'filled' : ''}`}
                  onClick={() => setSelectedRating(star)}
                >
                  ★
                </span>
              ))}
            </div>

            {/* Compliment Chips */}
            <div className="compliments-list">
              {['Polite Captain', 'Smooth Driving', 'Clean Vehicle', 'Great Route', 'On-Time'].map((tag) => (
                <button
                  key={tag}
                  className={`compliment-chip ${feedbackTags.includes(tag) ? 'selected' : ''}`}
                  onClick={() => {
                    if (feedbackTags.includes(tag)) {
                      setFeedbackTags(feedbackTags.filter(t => t !== tag));
                    } else {
                      setFeedbackTags([...feedbackTags, tag]);
                    }
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Feedback textarea */}
            <textarea
              className="feedback-input"
              placeholder="Leave an optional compliment or note..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={3}
            />

            <button className="btn-submit-rating" onClick={handleSubmitRating} disabled={loading}>
              Submit Rating & Finish
            </button>
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
    </div>
  );
}

export default ActiveRide;
