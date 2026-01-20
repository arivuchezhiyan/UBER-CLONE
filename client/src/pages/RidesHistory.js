import React, { useEffect, useState } from 'react';
import { getUserBookings } from '../services/api';
import '../styles/RidesHistory.css';

function RidesHistory({ token }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRides();
  }, []);

  const fetchRides = async () => {
    try {
      const response = await getUserBookings(token);
      setRides(response.data);
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rides-history">
      <h1>Your Ride History</h1>
      
      {loading ? (
        <p>Loading...</p>
      ) : rides.length === 0 ? (
        <p>No rides yet. Start by booking your first ride!</p>
      ) : (
        <div className="rides-list">
          {rides.map((ride) => (
            <div key={ride._id} className="ride-card">
              <div className="ride-info">
                <p><strong>From:</strong> {ride.pickupLocation?.address}</p>
                <p><strong>To:</strong> {ride.dropoffLocation?.address}</p>
                <p><strong>Status:</strong> <span className={`status ${ride.status}`}>{ride.status}</span></p>
                {ride.fare && <p><strong>Fare:</strong> ${ride.fare}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RidesHistory;
