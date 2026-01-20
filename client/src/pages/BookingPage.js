import React, { useState } from 'react';
import { requestRide } from '../services/api';
import '../styles/BookingPage.css';

function BookingPage({ token }) {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleBookRide = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await requestRide(token, {
        pickupLocation: {
          address: pickup,
          latitude: 0,
          longitude: 0
        },
        dropoffLocation: {
          address: dropoff,
          latitude: 0,
          longitude: 0
        },
        startTime: new Date(),
        specialRequests
      });
      setSuccess(true);
      setPickup('');
      setDropoff('');
      setSpecialRequests('');
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="booking-page">
      <div className="booking-container">
        <h1>Book a Ride</h1>
        
        {success && <div className="success-message">Ride requested successfully! A driver will accept shortly.</div>}
        
        <form onSubmit={handleBookRide}>
          <div className="form-group">
            <label>Pickup Location</label>
            <input
              type="text"
              placeholder="Enter pickup address"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Dropoff Location</label>
            <input
              type="text"
              placeholder="Enter dropoff address"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Special Requests</label>
            <textarea
              placeholder="Any special requests? (optional)"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows="3"
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? 'Booking...' : 'Request Ride'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default BookingPage;
