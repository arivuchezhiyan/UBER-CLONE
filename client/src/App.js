import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomerHome from './pages/CustomerHome';
import DriverHome from './pages/DriverHome';
import BookRide from './pages/BookRide';
import ActiveRide from './pages/ActiveRide';
import RideHistory from './pages/RideHistory';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import DriverDocuments from './pages/DriverDocuments';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [hasActiveRide, setHasActiveRide] = useState(false);

  // Check if there's an active ride on app load
  useEffect(() => {
    const activeBooking = localStorage.getItem('activeBooking');
    if (activeBooking) {
      try {
        const booking = JSON.parse(activeBooking);
        // Check if booking is in an active state
        const activeStatuses = [
          'REQUESTED',
          'SEARCHING_DRIVER',
          'DRIVER_ASSIGNED',
          'DRIVER_ARRIVING',
          'DRIVER_ARRIVED',
          'TRIP_STARTED',
          'searching',
          'accepted',
          'waiting',
          'arriving',
          'arrived',
          'started'
        ];
        if (activeStatuses.includes(booking.status)) {
          setHasActiveRide(true);
        } else {
          // Clean up completed/cancelled bookings
          localStorage.removeItem('activeBooking');
        }
      } catch (e) {
        localStorage.removeItem('activeBooking');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('activeBooking');
    setHasActiveRide(false);
  };

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/register" element={<RegisterPage onLogin={handleLogin} />} />
          <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Admin & Documents Route */}
        <Route path="/admin" element={<AdminDashboard user={user} />} />
        <Route path="/driver/documents" element={<DriverDocuments user={user} />} />
        <Route path="/documents" element={<DriverDocuments user={user} />} />

        {user.userType === 'driver' ? (
          <>
            <Route path="/" element={
              hasActiveRide ? <Navigate to="/active" /> : <DriverHome user={user} onLogout={handleLogout} />
            } />
            <Route path="/active" element={<ActiveRide user={user} userType="driver" />} />
            <Route path="/history" element={<RideHistory user={user} />} />
            <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} />} />
          </>
        ) : (
          <>
            <Route path="/" element={
              hasActiveRide ? <Navigate to="/active" /> : <CustomerHome user={user} onLogout={handleLogout} />
            } />
            <Route path="/book" element={<BookRide user={user} />} />
            <Route path="/active" element={<ActiveRide user={user} userType="customer" />} />
            <Route path="/history" element={<RideHistory user={user} />} />
            <Route path="/profile" element={<Profile user={user} onLogout={handleLogout} />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
