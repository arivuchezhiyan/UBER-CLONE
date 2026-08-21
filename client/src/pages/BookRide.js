import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { requestRide, getRideTypes } from '../services/api';
import RideMap from '../components/Map/RideMap';
import BackButton from '../components/BackButton/BackButton';
import { PLACES_DATABASE, reverseGeocode, geocodeAddress, renderCategorySvgIcon } from './CustomerHome';
import './BookRide.css';

// Industrial SVG Vector Icon Renderer for Vehicles
export const renderVehicleSvg = (idOrName) => {
  const key = (idOrName || '').toLowerCase();
  if (key.includes('premier') || key.includes('sedan')) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H7.5a1 1 0 0 0-.8.4L4 11l-5.16.86a1 1 0 0 0-.84.99V16h3" />
        <circle cx="6.5" cy="16.5" r="2.5" />
        <circle cx="16.5" cy="16.5" r="2.5" />
      </svg>
    );
  }
  if (key.includes('ev') || key.includes('electric')) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
        <path d="M13 3l-2 4h3l-2 4" stroke="#fbbf24" strokeWidth="2.2" />
      </svg>
    );
  }
  if (key.includes('xl') || key.includes('suv')) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="10" rx="3" />
        <path d="M6 7l2-4h8l2 4" />
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    );
  }
  if (key.includes('auto') || key.includes('tuk')) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17h16M7 17v-6l4-6h4l2 6v6" />
        <circle cx="7.5" cy="17.5" r="2" />
        <circle cx="16.5" cy="17.5" r="2" />
        <path d="M11 5v6" />
      </svg>
    );
  }
  if (key.includes('moto') || key.includes('bike')) {
    return (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18.5" cy="17.5" r="3.5" />
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="15" cy="5" r="1" />
        <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
      </svg>
    );
  }
  // Default PickMe Go / Hatchback
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11l2-4h10l2 4v6H5v-6z" />
      <circle cx="7.5" cy="17.5" r="2" />
      <circle cx="16.5" cy="17.5" r="2" />
      <path d="M9 11h6" />
    </svg>
  );
};

// Industrial SVG Vector Icon Renderer for Payment Options
export const renderPaymentSvg = (method) => {
  switch (method) {
    case 'upi':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      );
    case 'card':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      );
    case 'wallet':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
          <circle cx="18" cy="14" r="1.5" />
        </svg>
      );
    case 'cash':
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
  }
};

const PROMO_COUPONS = [
  { code: 'ROYAL50', discount: 50, type: 'flat', title: 'Royal First Ride', desc: 'Flat ₹50 off on luxury rides' },
  { code: 'COMMUTE20', discount: 20, type: 'percent', max: 80, title: 'Daily Commute Saver', desc: '20% off on daily office & college trips' },
  { code: 'VIPAIRPORT', discount: 150, type: 'flat', minFare: 300, title: 'Airport Express Pass', desc: 'Flat ₹150 off on Airport / Outstation routes' },
];

function BookRide({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pickup, setPickup] = useState(location.state?.pickup || '');
  const [dropoff, setDropoff] = useState(location.state?.dropoff || '');
  const isScheduled = location.state?.isScheduled || false;
  const scheduledDate = location.state?.scheduledDate || '';
  const scheduledTime = location.state?.scheduledTime || '';
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rideOptions, setRideOptions] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [estimatedDistance, setEstimatedDistance] = useState(location.state?.estimatedDistance || 5);
  
  // Promo code system
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [typedCoupon, setTypedCoupon] = useState('');
  const [promoError, setPromoError] = useState('');
  
  // Fare breakdown modal
  const [showFareModal, setShowFareModal] = useState(false);
  
  // Location editing and autocomplete state
  const [activeEditingField, setActiveEditingField] = useState(null); // 'pickup' | 'dropoff' | null
  const [selectedTransitFilter, setSelectedTransitFilter] = useState('ALL');
  const [locationAlert, setLocationAlert] = useState('');

  // 1. Initialize and resolve coordinates on mount without overriding user's typed pickup
  useEffect(() => {
    let isMounted = true;

    const initCoordinates = async () => {
      let resolvedPickupCoords = location.state?.pickupCoords || null;
      let resolvedDropoffCoords = location.state?.dropoffCoords || null;

      // Resolve Pickup Coordinates
      if (!resolvedPickupCoords) {
        if (pickup && pickup !== 'Current location' && !pickup.includes('GPS')) {
          resolvedPickupCoords = await geocodeAddress(pickup);
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              if (!isMounted) return;
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              setPickupCoords({ lat, lng });
              if (!pickup || pickup === 'Current location' || pickup.includes('GPS')) {
                const realName = await reverseGeocode(lat, lng);
                setPickup(realName);
              }
            },
            () => {
              if (!isMounted) return;
              setPickupCoords({ lat: 12.7871, lng: 80.2185 });
            },
            { enableHighAccuracy: true, timeout: 8000 }
          );
        }
      }

      if (isMounted && resolvedPickupCoords) {
        setPickupCoords(resolvedPickupCoords);
      }

      // Resolve Dropoff Coordinates
      if (!resolvedDropoffCoords && dropoff && dropoff.trim()) {
        const baseLat = resolvedPickupCoords?.lat || 12.7871;
        const baseLng = resolvedPickupCoords?.lng || 80.2185;
        resolvedDropoffCoords = await geocodeAddress(dropoff, baseLat, baseLng);
      }

      if (isMounted && resolvedDropoffCoords) {
        setDropoffCoords(resolvedDropoffCoords);
      }
    };

    initCoordinates();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Dynamic geocoding when pickup is edited directly in BookRide
  useEffect(() => {
    if (!pickup || pickup === 'Current location' || pickup.includes('GPS')) return;
    
    const matchedPlace = PLACES_DATABASE.find(p => p.name.toLowerCase() === pickup.toLowerCase());
    if (matchedPlace && matchedPlace.coords) {
      setPickupCoords(matchedPlace.coords);
      return;
    }

    const timer = setTimeout(async () => {
      const coords = await geocodeAddress(pickup);
      if (coords) {
        setPickupCoords(coords);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [pickup]);

  // 3. Dynamic geocoding when dropoff is edited directly in BookRide
  useEffect(() => {
    if (!dropoff || !dropoff.trim()) return;
    const baseLat = pickupCoords?.lat || 12.7871;
    const baseLng = pickupCoords?.lng || 80.2185;
    
    const matchedPlace = PLACES_DATABASE.find(p => p.name.toLowerCase() === dropoff.toLowerCase());
    if (matchedPlace && matchedPlace.coords) {
      setDropoffCoords(matchedPlace.coords);
      return;
    }

    const timer = setTimeout(async () => {
      const coords = await geocodeAddress(dropoff, baseLat, baseLng);
      if (coords) {
        setDropoffCoords(coords);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [dropoff, pickupCoords?.lat, pickupCoords?.lng]);

  const setDefaultRideOptions = () => {
    const options = [
      { id: 'Premier', name: 'Royal Premier', desc: 'Executive comfort sedan, top captains', price: 199, time: '3 min away', capacity: 4, luggage: '2 Bags', pricePerKm: 15, baseFare: 70 },
      { id: 'UberGo', name: 'PickMe Go', desc: 'Everyday comfortable ride', price: 149, time: '2 min away', capacity: 4, luggage: '1 Bag', pricePerKm: 12, baseFare: 50 },
      { id: 'RoyalEV', name: 'Royal VIP EV', desc: 'Silent luxury electric, climate aroma', price: 239, time: '4 min away', capacity: 4, luggage: '2 Bags', pricePerKm: 16, baseFare: 80 },
      { id: 'UberXL', name: 'Royal XL SUV', desc: 'Spacious 6-seater for family & luggage', price: 289, time: '5 min away', capacity: 6, luggage: '4 Bags', pricePerKm: 18, baseFare: 100 },
      { id: 'Auto', name: 'Auto Express', desc: 'Quick doorstep auto ride', price: 89, time: '1 min away', capacity: 3, luggage: '1 Bag', pricePerKm: 8, baseFare: 25 },
      { id: 'Moto', name: 'Moto Fast', desc: 'Fast single-rider motorcycle', price: 49, time: '2 min away', capacity: 1, luggage: 'Backpack', pricePerKm: 5, baseFare: 15 }
    ];
    setRideOptions(options);
    setSelectedRide(options[0]);
  };

  // Fetch ride types
  useEffect(() => {
    const fetchRideTypes = async () => {
      try {
        const response = await getRideTypes();
        if (response.data?.length > 0) {
          const types = response.data.map(v => ({
            id: v.name,
            name: v.name,
            desc: v.description,
            price: v.baseFare + (v.pricePerKm * estimatedDistance),
            time: `${Math.floor(Math.random() * 4) + 2} min away`,
            capacity: v.capacity || 4,
            luggage: v.capacity > 4 ? '4 Bags' : '2 Bags',
            pricePerKm: v.pricePerKm,
            baseFare: v.baseFare
          }));
          setRideOptions(types);
          setSelectedRide(types[0]);
        } else {
          setDefaultRideOptions();
        }
      } catch (err) {
        setDefaultRideOptions();
      }
    };
    fetchRideTypes();
  }, [estimatedDistance]);

  // Calculate distance
  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      const R = 6371;
      const dLat = (dropoffCoords.lat - pickupCoords.lat) * Math.PI / 180;
      const dLon = (dropoffCoords.lng - pickupCoords.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(pickupCoords.lat * Math.PI / 180) * Math.cos(dropoffCoords.lat * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      setEstimatedDistance(Math.max(1, Math.round(R * c * 10) / 10));
    }
  }, [pickupCoords, dropoffCoords]);

  // Fare Calculator with Discount
  const calculateGrossFare = (ride) => {
    if (!ride) return 0;
    return Math.round(ride.baseFare + (ride.pricePerKm * estimatedDistance));
  };

  const calculateDiscount = (grossFare) => {
    if (!appliedPromo) return 0;
    if (appliedPromo.type === 'flat') {
      return Math.min(grossFare, appliedPromo.discount);
    }
    if (appliedPromo.type === 'percent') {
      const disc = Math.round((grossFare * appliedPromo.discount) / 100);
      return appliedPromo.max ? Math.min(disc, appliedPromo.max) : disc;
    }
    return 0;
  };

  const calculateFare = (ride) => {
    const gross = calculateGrossFare(ride);
    const disc = calculateDiscount(gross);
    return Math.max(20, gross - disc);
  };

  const handleApplyTypedCoupon = (e) => {
    if (e) e.preventDefault();
    const code = typedCoupon.trim().toUpperCase();
    const found = PROMO_COUPONS.find(c => c.code === code);
    if (found) {
      setAppliedPromo(found);
      setPromoError('');
      setShowPromoModal(false);
    } else {
      setPromoError('Invalid coupon code. Try ROYAL50 or COMMUTE20');
    }
  };

  const handleConfirmRide = async () => {
    if (!selectedRide) return;
    
    setLoading(true);
    try {
      const response = await requestRide({
        pickupLocation: { 
          address: pickup || 'Current Location',
          latitude: pickupCoords?.lat,
          longitude: pickupCoords?.lng
        },
        dropoffLocation: { 
          address: dropoff || 'Destination',
          latitude: dropoffCoords?.lat,
          longitude: dropoffCoords?.lng
        },
        vehicleType: selectedRide.name,
        estimatedDistance,
        estimatedDuration: Math.round(estimatedDistance * 3),
        paymentMethod,
        isScheduled,
        scheduledDate,
        scheduledTime,
        promoCode: appliedPromo?.code || ''
      });
      
      if (response.data.success) {
        localStorage.setItem('activeBooking', JSON.stringify({
          ...response.data.booking,
          pickupCoords,
          dropoffCoords
        }));
        navigate('/active');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to book ride');
    } finally {
      setLoading(false);
    }
  };

  // Mini GPS Locate button inside BookRide page
  const handleDetectCurrentGPS = (e) => {
    if (e) e.stopPropagation();
    if (!navigator.geolocation) {
      setLocationAlert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupCoords({ lat, lng });
        const realName = await reverseGeocode(lat, lng);
        setPickup(realName);
        setActiveEditingField(null);
      },
      (err) => {
        console.warn('GPS error in BookRide:', err);
        setLocationAlert('Location Access Required: Please turn on device location services and allow permission.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Select a suggestion on BookRide page
  const handleSelectSuggestion = async (place) => {
    if (activeEditingField === 'pickup') {
      setPickup(place.name);
      if (place.coords) {
        setPickupCoords(place.coords);
      } else {
        const coords = await geocodeAddress(place.name);
        if (coords) setPickupCoords(coords);
      }
      setActiveEditingField('dropoff');
    } else {
      setDropoff(place.name);
      if (place.coords) {
        setDropoffCoords(place.coords);
      } else {
        const baseLat = pickupCoords?.lat || 12.7871;
        const baseLng = pickupCoords?.lng || 80.2185;
        const coords = await geocodeAddress(place.name, baseLat, baseLng);
        if (coords) setDropoffCoords(coords);
      }
      if (place.distanceKm) {
        setEstimatedDistance(place.distanceKm);
      }
      setActiveEditingField(null);
    }
  };

  const editingQuery = (activeEditingField === 'pickup' ? pickup : dropoff) || '';
  const cleanQuery = editingQuery.trim().toLowerCase();

  // Filter places matching transit category and typed query
  const matchedPlaces = PLACES_DATABASE.filter(place => {
    let matchesCategory = true;
    if (selectedTransitFilter === 'METRO') matchesCategory = place.type === 'metro';
    else if (selectedTransitFilter === 'RAILWAY') matchesCategory = place.type === 'railway';
    else if (selectedTransitFilter === 'AIRPORT') matchesCategory = place.type === 'airport';
    else if (selectedTransitFilter === 'BUS') matchesCategory = place.type === 'bus';
    else if (selectedTransitFilter === 'HOSPITAL') matchesCategory = place.type === 'hospital';
    else if (selectedTransitFilter === 'TECH') matchesCategory = place.type === 'tech_park';
    else if (selectedTransitFilter === 'OUTSTATION') matchesCategory = place.isLongDistance || place.type === 'outstation';

    if (!cleanQuery) return matchesCategory;

    const nameMatch = place.name.toLowerCase().includes(cleanQuery);
    const addrMatch = place.address.toLowerCase().includes(cleanQuery);
    const catMatch = place.category.toLowerCase().includes(cleanQuery);
    const typeMatch = place.type && place.type.toLowerCase().includes(cleanQuery);
    const words = cleanQuery.split(/[\s,]+/);
    const anyWordMatch = words.some(w => w.length >= 2 && (place.name.toLowerCase().includes(w) || place.address.toLowerCase().includes(w)));
    
    return matchesCategory && (nameMatch || addrMatch || catMatch || typeMatch || anyWordMatch);
  });

  const showCustomOption = cleanQuery.length > 0 && !matchedPlaces.some(p => p.name.toLowerCase() === cleanQuery);
  const customPlace = showCustomOption ? {
    id: 'custom-' + cleanQuery,
    name: editingQuery,
    address: 'Tap to select this exact location',
    type: 'custom',
    category: 'Selected',
    distanceKm: Math.floor(Math.random() * 8) + 4,
    isLongDistance: false
  } : null;

  const suggestionsToDisplay = [
    ...(customPlace ? [customPlace] : []),
    ...(matchedPlaces.length > 0 ? matchedPlaces : PLACES_DATABASE)
  ].slice(0, 10);

  return (
    <div className="book-ride-app">
      {/* Map Section */}
      <div className="ride-map-section">
        <RideMap
          pickup={pickupCoords ? [pickupCoords.lat, pickupCoords.lng] : null}
          dropoff={dropoffCoords ? [dropoffCoords.lat, dropoffCoords.lng] : null}
          showRoute={true}
          height="100%"
          onRouteCalculated={({ distanceKm }) => {
            if (distanceKm && distanceKm > 0) {
              setEstimatedDistance(distanceKm);
            }
          }}
        />
        
        {/* Floating Universal Back Button */}
        <BackButton to="/" label="" className="floating icon-only" />

        {/* Route Info Overlay */}
        <div className="route-info-card">
          <div className="route-point">
            <div className="point-marker green"></div>
            <input
              type="text"
              className="route-input"
              value={pickup}
              placeholder="Enter pickup location"
              onChange={(e) => {
                setPickup(e.target.value);
                setActiveEditingField('pickup');
              }}
              onFocus={() => setActiveEditingField('pickup')}
            />
            <button
              type="button"
              className="btn-locate-mini"
              onClick={handleDetectCurrentGPS}
              title="Detect GPS Current Location"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="7"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <line x1="12" y1="2" x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="5" y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
              </svg>
            </button>
          </div>
          <div className="route-divider"></div>
          <div className="route-point">
            <div className="point-marker black"></div>
            <input
              type="text"
              className="route-input"
              value={dropoff}
              placeholder="Where to? (Destination)"
              onChange={(e) => {
                setDropoff(e.target.value);
                setActiveEditingField('dropoff');
              }}
              onFocus={() => setActiveEditingField('dropoff')}
            />
          </div>

          {/* Interactive Floating Suggestion Bar */}
          {activeEditingField && (
            <div className="route-suggestions-dropdown">
              <div className="dropdown-header">
                <span>Select {activeEditingField === 'pickup' ? 'Pickup' : 'Destination'}</span>
                <button type="button" className="close-dropdown-btn" onClick={() => setActiveEditingField(null)}>✕</button>
              </div>

              {/* Transit Category Filter Chips with SVGs */}
              <div className="dropdown-filter-chips">
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'ALL' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('ALL'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  All
                </button>
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'METRO' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('METRO'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="4" y="3" width="16" height="16" rx="2"/>
                    <path d="M4 11h16M12 3v8"/>
                  </svg>
                  Metro
                </button>
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'AIRPORT' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('AIRPORT'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-1.9.9-.4.9-.1 1.9.6 2.4l5.3 4-2.8 2.8-2.6-.4c-.4-.1-.8.1-1.1.4l-.8.8 3.5 1.5 1.5 3.5.8-.8c.3-.3.5-.7.4-1.1l-.4-2.6 2.8-2.8 4 5.3c.5.7 1.5 1 2.4.6.7-.3 1.1-1.1.9-1.9z"/>
                  </svg>
                  Airport
                </button>
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'RAILWAY' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('RAILWAY'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="4" y="3" width="16" height="14" rx="2"/>
                    <circle cx="8.5" cy="13.5" r="1.5" fill="currentColor"/>
                    <circle cx="15.5" cy="13.5" r="1.5" fill="currentColor"/>
                  </svg>
                  Railway
                </button>
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'BUS' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('BUS'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="18" height="16" rx="2"/>
                    <path d="M3 10h18"/>
                  </svg>
                  Bus
                </button>
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'TECH' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('TECH'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M9 3v18M15 3v18"/>
                  </svg>
                  IT Park
                </button>
                <button 
                  type="button"
                  className={`chip-btn ${selectedTransitFilter === 'OUTSTATION' ? 'active' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); setSelectedTransitFilter('OUTSTATION'); }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polygon points="12 2 2 22 22 22"/>
                  </svg>
                  Outstation
                </button>
              </div>

              <div className="dropdown-list">
                {suggestionsToDisplay.map(place => (
                  <div 
                    key={place.id} 
                    className="dropdown-item" 
                    onMouseDown={() => handleSelectSuggestion(place)}
                  >
                    <div className="dropdown-icon-box">
                      {renderCategorySvgIcon(place.type)}
                    </div>
                    <div className="dropdown-info">
                      <div className="dropdown-title-row">
                        <span className="dropdown-name">{place.name}</span>
                        {place.isLongDistance ? (
                          <span className="dropdown-badge outstation">Outstation • {place.distanceKm} km</span>
                        ) : (
                          <span className="dropdown-badge nearby">{place.distanceKm} km</span>
                        )}
                      </div>
                      <span className="dropdown-address">{place.address}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Location Service Alert Modal */}
      {locationAlert && (
        <div className="modal-overlay" style={{ zIndex: 9999999 }}>
          <div className="location-permission-modal">
            <div className="alert-icon-ring">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3>Location Access Required</h3>
            <p>{locationAlert}</p>
            <button 
              className="btn-enable-location"
              onClick={() => {
                setLocationAlert('');
                handleDetectCurrentGPS();
              }}
            >
              Try Again
            </button>
            <button 
              className="btn-dismiss-location"
              onClick={() => setLocationAlert('')}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Bottom Sheet - Vehicle Selection */}
      <div className="vehicle-sheet">
        <div className="sheet-header">
          <div className="drag-indicator"></div>
          {isScheduled && (
            <div className="scheduled-trip-banner">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>VIP Pickup Reserved for {scheduledDate || 'Today'} at {scheduledTime || '10:00 AM'}</span>
            </div>
          )}
          <div className="trip-info">
            <span className="distance">{estimatedDistance} km</span>
            <span className="separator">•</span>
            <span className="duration">{Math.round(estimatedDistance * 3)} min</span>
            <button 
              type="button" 
              className="btn-fare-info-pill"
              onClick={() => setShowFareModal(true)}
              title="View Fare Calculation"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>Fare Breakdown</span>
            </button>
          </div>
        </div>

        {/* Ride Options with Crisp SVG Badges */}
        <div className="ride-options-list">
          {rideOptions.map(ride => {
            const isSelected = selectedRide?.id === ride.id;
            const gross = calculateGrossFare(ride);
            const finalPrice = calculateFare(ride);
            const hasDiscount = appliedPromo && finalPrice < gross;

            return (
              <div 
                key={ride.id}
                className={`ride-option ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedRide(ride)}
              >
                <div className="ride-icon-wrapper">
                  {renderVehicleSvg(ride.id || ride.name)}
                </div>
                <div className="ride-info">
                  <div className="ride-main">
                    <h4>{ride.name}</h4>
                    <div className="capacity-badge">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span>{ride.capacity}</span>
                    </div>
                    <span className="ride-time">{ride.time}</span>
                  </div>
                  <p className="ride-desc">{ride.desc}</p>
                </div>
                <div className="ride-price">
                  {hasDiscount && (
                    <span className="original-price">₹{gross}</span>
                  )}
                  <span className="price">₹{finalPrice}</span>
                </div>
                {isSelected && (
                  <div className="selected-indicator">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Promo Code & Discount Pill */}
        <div className="promo-section" onClick={() => setShowPromoModal(true)}>
          <div className="promo-left-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff5c8a" strokeWidth="2.2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
            <div className="promo-text-column">
              <span className="promo-main-text">
                {appliedPromo ? `Coupon: ${appliedPromo.code}` : 'Apply Promo Code'}
              </span>
              {appliedPromo && (
                <span className="promo-discount-badge">{appliedPromo.title} • Active</span>
              )}
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>

        {/* Payment Method Selector */}
        <div className="payment-section" onClick={() => setShowPaymentSheet(true)}>
          <div className="payment-left-box">
            <span className="payment-icon">{renderPaymentSvg(paymentMethod)}</span>
            <span className="payment-label">
              {paymentMethod === 'cash' ? 'Cash on Arrival' : paymentMethod === 'upi' ? 'Instant UPI (GPay/PhonePe)' : paymentMethod === 'wallet' ? 'PickMe Cash Wallet' : 'Credit / Debit Card'}
            </span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </div>

        {/* Confirm / Schedule Primary Button */}
        <button 
          className="confirm-ride-btn"
          onClick={handleConfirmRide}
          disabled={!selectedRide || loading}
        >
          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <span>{isScheduled ? `Schedule ${selectedRide?.name || 'Ride'}` : `Request ${selectedRide?.name || 'Ride'}`}</span>
              <span className="btn-price">₹{selectedRide ? calculateFare(selectedRide) : 0}</span>
            </>
          )}
        </button>
      </div>

      {/* PROMO CODES MODAL */}
      {showPromoModal && (
        <div className="modal-overlay" onClick={() => setShowPromoModal(false)} style={{ zIndex: 99999 }}>
          <div className="promo-sheet-modal" onClick={e => e.stopPropagation()}>
            <div className="sheet-modal-header">
              <h3>Offers & Promo Codes</h3>
              <button onClick={() => setShowPromoModal(false)}>✕</button>
            </div>

            {/* Custom Input */}
            <form onSubmit={handleApplyTypedCoupon} className="coupon-input-form">
              <input
                type="text"
                placeholder="ENTER COUPON (e.g. ROYAL50)"
                value={typedCoupon}
                onChange={e => {
                  setTypedCoupon(e.target.value.toUpperCase());
                  setPromoError('');
                }}
              />
              <button type="submit">Apply</button>
            </form>
            {promoError && <p className="promo-error-msg">{promoError}</p>}

            {/* Active Coupon Banner */}
            {appliedPromo && (
              <div className="active-applied-banner">
                <div>
                  <span className="active-code-tag">ACTIVE: {appliedPromo.code}</span>
                  <p>{appliedPromo.desc}</p>
                </div>
                <button type="button" onClick={() => setAppliedPromo(null)} className="btn-remove-coupon">
                  Remove
                </button>
              </div>
            )}

            {/* Available Coupons List */}
            <div className="coupons-available-list">
              <span className="coupons-subhead">AVAILABLE COUPONS</span>
              {PROMO_COUPONS.map(c => (
                <div 
                  key={c.code} 
                  className={`coupon-card ${appliedPromo?.code === c.code ? 'applied' : ''}`}
                  onClick={() => {
                    setAppliedPromo(c);
                    setShowPromoModal(false);
                  }}
                >
                  <div className="coupon-left">
                    <span className="coupon-code-pill">{c.code}</span>
                    <h4 className="coupon-title">{c.title}</h4>
                    <p className="coupon-desc">{c.desc}</p>
                  </div>
                  <button type="button" className="btn-apply-coupon">
                    {appliedPromo?.code === c.code ? 'Applied' : 'Apply'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FARE BREAKDOWN POPUP MODAL */}
      {showFareModal && selectedRide && (
        <div className="modal-overlay" onClick={() => setShowFareModal(false)} style={{ zIndex: 99999 }}>
          <div className="fare-breakdown-modal" onClick={e => e.stopPropagation()}>
            <div className="sheet-modal-header">
              <h3>Fare Breakdown</h3>
              <button onClick={() => setShowFareModal(false)}>✕</button>
            </div>

            <div className="fare-items-list">
              <div className="fare-row">
                <span>Base Fare</span>
                <span>₹{selectedRide.baseFare}</span>
              </div>
              <div className="fare-row">
                <span>Distance Fare ({estimatedDistance} km @ ₹{selectedRide.pricePerKm}/km)</span>
                <span>₹{Math.round(selectedRide.pricePerKm * estimatedDistance)}</span>
              </div>
              <div className="fare-row">
                <span>Estimated Duration</span>
                <span>{Math.round(estimatedDistance * 3)} mins</span>
              </div>
              <div className="fare-row">
                <span>Fuel & Road Surcharges</span>
                <span className="free-tag">Included</span>
              </div>
              {appliedPromo && (
                <div className="fare-row discount-row">
                  <span>Coupon Discount ({appliedPromo.code})</span>
                  <span>-₹{calculateDiscount(calculateGrossFare(selectedRide))}</span>
                </div>
              )}
              <div className="fare-divider"></div>
              <div className="fare-row total-row">
                <span>Estimated Total</span>
                <span className="total-val">₹{calculateFare(selectedRide)}</span>
              </div>
            </div>

            <button className="btn-close-breakdown" onClick={() => setShowFareModal(false)}>
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Payment Sheet */}
      {showPaymentSheet && (
        <div className="payment-sheet-overlay" onClick={() => setShowPaymentSheet(false)}>
          <div className="payment-sheet" onClick={e => e.stopPropagation()}>
            <div className="payment-sheet-header">
              <h3>Payment Method</h3>
              <button onClick={() => setShowPaymentSheet(false)}>✕</button>
            </div>
            <div className="payment-options">
              <div 
                className={`payment-option ${paymentMethod === 'cash' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('cash'); setShowPaymentSheet(false); }}
              >
                <div className="option-icon-box">{renderPaymentSvg('cash')}</div>
                <div className="option-meta">
                  <span className="option-label">Cash on Arrival</span>
                  <span className="option-sub">Pay driver directly in cash</span>
                </div>
                {paymentMethod === 'cash' && <span className="check">✓</span>}
              </div>
              <div 
                className={`payment-option ${paymentMethod === 'upi' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('upi'); setShowPaymentSheet(false); }}
              >
                <div className="option-icon-box">{renderPaymentSvg('upi')}</div>
                <div className="option-meta">
                  <span className="option-label">Instant UPI (GPay / PhonePe / Paytm)</span>
                  <span className="option-sub">Scan QR or Pay directly on arrival</span>
                </div>
                {paymentMethod === 'upi' && <span className="check">✓</span>}
              </div>
              <div 
                className={`payment-option ${paymentMethod === 'wallet' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('wallet'); setShowPaymentSheet(false); }}
              >
                <div className="option-icon-box">{renderPaymentSvg('wallet')}</div>
                <div className="option-meta">
                  <span className="option-label">PickMe Cash Wallet</span>
                  <span className="option-sub">Balance: ₹450 • Instant 1-tap checkout</span>
                </div>
                {paymentMethod === 'wallet' && <span className="check">✓</span>}
              </div>
              <div 
                className={`payment-option ${paymentMethod === 'card' ? 'selected' : ''}`}
                onClick={() => { setPaymentMethod('card'); setShowPaymentSheet(false); }}
              >
                <div className="option-icon-box">{renderPaymentSvg('card')}</div>
                <div className="option-meta">
                  <span className="option-label">Credit or Debit Card</span>
                  <span className="option-sub">Visa, Mastercard, RuPay & Amex</span>
                </div>
                {paymentMethod === 'card' && <span className="check">✓</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookRide;
