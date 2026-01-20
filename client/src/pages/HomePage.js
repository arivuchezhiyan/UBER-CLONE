import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/HomePage.css';

function HomePage({ token, onLogout }) {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDropoffDropdown, setShowDropoffDropdown] = useState(false);

  // Sample suggestions for demo
  const suggestions = [
    { name: 'Airport Terminal 2', address: 'International Airport, Main Road' },
    { name: 'City Center Mall', address: 'MG Road, Central Business District' },
    { name: 'Railway Station', address: 'Central Railway Station, Platform 1' },
    { name: 'Tech Park', address: 'IT Park Road, Electronic City' },
    { name: 'University Campus', address: 'University Main Gate, College Road' },
  ];

  const handleSeePrices = () => {
    if (pickup || dropoff) {
      navigate('/book', { state: { pickup, dropoff } });
    } else {
      navigate('/book');
    }
  };

  const handleSuggestionClick = (suggestion, type) => {
    if (type === 'pickup') {
      setPickup(suggestion.name);
      setShowPickupDropdown(false);
    } else {
      setDropoff(suggestion.name);
      setShowDropoffDropdown(false);
    }
  };

  const handleGetCurrentLocation = (type) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          if (type === 'pickup') {
            setPickup('Current Location');
            setShowPickupDropdown(false);
          }
        },
        () => {
          alert('Unable to get location');
        }
      );
    }
  };

  const services = [
    { id: 'ride', name: 'Ride', icon: '🚗', desc: 'Go anywhere with Uber. Request a ride, hop in, and go.' },
    { id: 'reserve', name: 'Reserve', icon: '📅', desc: 'Reserve your ride in advance so you can relax on the day of your trip.' },
    { id: 'rentals', name: 'Rental Cars', icon: '🚙', desc: 'Your perfect rental car is a few clicks away. Learn more about Uber Rent.' },
    { id: 'intercity', name: 'Intercity', icon: '🛣️', desc: 'Get convenient, affordable rides between cities.' },
    { id: 'food', name: 'Food', icon: '🍔', desc: 'Order delivery from local restaurants.' },
    { id: 'grocery', name: 'Grocery', icon: '🛒', desc: 'Get groceries delivered to your door.' },
  ];

  return (
    <div className="uber-home">
      {/* Navigation Bar */}
      <nav className="uber-nav">
        <div className="nav-left">
          <Link to="/" className="uber-logo">Uber</Link>
          <div className="nav-links">
            <a href="#ride" className="nav-link">Ride</a>
            <a href="#earn" className="nav-link">Earn</a>
            <a href="#business" className="nav-link">Business</a>
            <a href="#eats" className="nav-link">Uber Eats</a>
            <div className="nav-dropdown">
              <span className="nav-link">About ▾</span>
            </div>
          </div>
        </div>
        <div className="nav-right">
          <button className="lang-btn">🌐 EN</button>
          <button className="help-btn">Help</button>
          {token ? (
            <>
              <button className="nav-btn" onClick={() => navigate('/book')}>Book Ride</button>
              <button className="nav-btn signup" onClick={onLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className="nav-btn" onClick={() => navigate('/login')}>Log in</button>
              <button className="nav-btn signup" onClick={() => navigate('/register')}>Sign up</button>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="location-badge">
            <span>📍 Your City</span>
            <a href="#change">Change city</a>
          </div>
          
          <h1 className="hero-title">Go anywhere with Uber</h1>
          
          <div className="booking-card">
            <div className="pickup-toggle">
              <button className="toggle-btn active">
                <span>🕐</span> Pickup now
                <span className="arrow">▾</span>
              </button>
            </div>
            
            <div className="location-inputs">
              <div className="input-group">
                <div className="input-icon pickup-icon"></div>
                <input
                  type="text"
                  placeholder="Pickup location"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  onFocus={() => setShowPickupDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPickupDropdown(false), 200)}
                />
                <button className="location-btn" onClick={() => handleGetCurrentLocation('pickup')}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                  </svg>
                </button>
                
                {showPickupDropdown && (
                  <div className="suggestions-dropdown">
                    <div className="suggestion-item location-access" onClick={() => handleGetCurrentLocation('pickup')}>
                      <div className="suggestion-icon-wrapper target">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                        </svg>
                      </div>
                      <div className="suggestion-info">
                        <span className="suggestion-name">Allow location access</span>
                        <span className="suggestion-address">It provides your pickup address</span>
                      </div>
                    </div>
                    {suggestions.map((s, idx) => (
                      <div key={idx} className="suggestion-item" onClick={() => handleSuggestionClick(s, 'pickup')}>
                        <div className="suggestion-icon-wrapper">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                        </div>
                        <div className="suggestion-info">
                          <span className="suggestion-name">{s.name}</span>
                          <span className="suggestion-address">{s.address}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="input-divider">
                <div className="divider-line"></div>
              </div>
              
              <div className="input-group">
                <div className="input-icon dropoff-icon"></div>
                <input
                  type="text"
                  placeholder="Dropoff location"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  onFocus={() => setShowDropoffDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropoffDropdown(false), 200)}
                />
                
                {showDropoffDropdown && (
                  <div className="suggestions-dropdown">
                    {suggestions.map((s, idx) => (
                      <div key={idx} className="suggestion-item" onClick={() => handleSuggestionClick(s, 'dropoff')}>
                        <div className="suggestion-icon-wrapper">
                          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                        </div>
                        <div className="suggestion-info">
                          <span className="suggestion-name">{s.name}</span>
                          <span className="suggestion-address">{s.address}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <button className="see-prices-btn" onClick={handleSeePrices}>
              See prices
            </button>
            
            {!token && (
              <p className="login-prompt">
                <Link to="/login">Log in</Link> to see your recent activity
              </p>
            )}
          </div>
        </div>
        
        <div className="hero-image">
          <img src="https://www.uber-assets.com/image/upload/f_auto,q_auto:eco,c_fill,w_956,h_637/v1684852612/assets/ba/4947c1-b862-400e-9f00-668f4926a4a2/original/Ride-with-Uber.png" alt="Uber Ride" />
        </div>
      </section>

      {/* Suggestions Section */}
      <section className="suggestions-section">
        <h2>Suggestions</h2>
        <div className="services-grid">
          {services.map(service => (
            <div key={service.id} className="service-card" onClick={() => navigate('/book')}>
              <div className="service-content">
                <h3>{service.name}</h3>
                <p>{service.desc}</p>
                <button className="details-btn">Details</button>
              </div>
              <div className="service-icon">{service.icon}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="uber-footer">
        <div className="footer-content">
          <div className="footer-brand">Uber</div>
          <div className="footer-links">
            <a href="#company">Company</a>
            <a href="#products">Products</a>
            <a href="#safety">Safety</a>
            <a href="#help">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
