import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './RideMap.css';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Uber-style pickup icon (green dot)
const pickupIcon = L.divIcon({
  className: 'uber-marker',
  html: `<div class="uber-pickup-marker">
    <div class="uber-pickup-dot"></div>
    <div class="uber-pickup-pulse"></div>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Uber-style dropoff icon (black square)
const dropoffIcon = L.divIcon({
  className: 'uber-marker',
  html: `<div class="uber-dropoff-marker"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Car icon is created dynamically in AnimatedCar for rotation

// User location icon (blue dot like Google Maps)
const userLocationIcon = L.divIcon({
  className: 'uber-marker',
  html: `<div class="uber-user-location">
    <div class="uber-user-dot"></div>
    <div class="uber-user-accuracy"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to fit bounds when positions change
function FitBounds({ pickup, dropoff }) {
  const map = useMap();
  
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([pickup, dropoff]);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    } else if (pickup) {
      map.setView(pickup, 16);
    }
  }, [map, pickup, dropoff]);
  
  return null;
}

// Map controls component
function MapControls({ onLocateUser }) {
  const map = useMap();
  
  const handleZoomIn = () => map.zoomIn();
  const handleZoomOut = () => map.zoomOut();
  
  return (
    <div className="uber-map-controls">
      <button className="uber-map-btn" onClick={handleZoomIn}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button className="uber-map-btn" onClick={handleZoomOut}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <button className="uber-map-btn locate" onClick={onLocateUser}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path>
        </svg>
      </button>
    </div>
  );
}

// Animated car marker
function AnimatedCar({ from, to, progress }) {
  const [position, setPosition] = useState(from);
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    if (from && to) {
      const lat = from[0] + (to[0] - from[0]) * progress;
      const lng = from[1] + (to[1] - from[1]) * progress;
      setPosition([lat, lng]);
      
      // Calculate rotation angle
      const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * (180 / Math.PI);
      setRotation(angle);
    }
  }, [from, to, progress]);
  
  if (!position) return null;
  
  const rotatedCarIcon = L.divIcon({
    className: 'uber-marker',
    html: `<div class="uber-car-marker" style="transform: rotate(${rotation}deg)">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.29 5.42 5.08 6.01L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H18V20C18 20.55 18.45 21 19 21H20C20.55 21 21 20.55 21 20V12L18.92 6.01ZM6.5 16C5.67 16 5 15.33 5 14.5S5.67 13 6.5 13 8 13.67 8 14.5 7.33 16 6.5 16ZM17.5 16C16.67 16 16 15.33 16 14.5S16.67 13 17.5 13 19 13.67 19 14.5 18.33 16 17.5 16ZM5 11L6.5 6.5H17.5L19 11H5Z" fill="black"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
  
  return <Marker position={position} icon={rotatedCarIcon} />;
}

function RideMap({ 
  pickup, 
  dropoff, 
  showRoute = false, 
  showCar = false,
  carProgress = 0,
  height = '100%',
  onMapClick,
  interactive = true
}) {
  const mapRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  
  // Default center (Bangalore)
  const defaultCenter = [12.9716, 77.5946];
  
  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.log('Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    }
  }, []);
  
  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = [position.coords.latitude, position.coords.longitude];
          setUserLocation(loc);
          if (mapRef.current) {
            mapRef.current.setView(loc, 16);
          }
        },
        (error) => console.log('Location error:', error),
        { enableHighAccuracy: true }
      );
    }
  };
  
  const center = pickup || userLocation || defaultCenter;
  
  // Generate curved route path for more realistic look
  const generateCurvedRoute = (start, end) => {
    if (!start || !end) return [];
    
    const points = [];
    const numPoints = 20;
    
    // Add slight curve offset
    const midLat = (start[0] + end[0]) / 2;
    const midLng = (start[1] + end[1]) / 2;
    const offset = 0.002; // Small offset for curve
    
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Quadratic bezier curve
      const lat = (1-t)*(1-t)*start[0] + 2*(1-t)*t*(midLat + offset) + t*t*end[0];
      const lng = (1-t)*(1-t)*start[1] + 2*(1-t)*t*(midLng + offset) + t*t*end[1];
      points.push([lat, lng]);
    }
    return points;
  };
  
  const routePath = pickup && dropoff ? generateCurvedRoute(pickup, dropoff) : [];
  
  return (
    <div className="uber-map-container" style={{ height }}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        scrollWheelZoom={interactive}
        attributionControl={false}
      >
        {/* OpenStreetMap with labels - like Google Maps */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        
        <FitBounds pickup={pickup} dropoff={dropoff} />
        <MapControls onLocateUser={handleLocateUser} />
        
        {/* Route Line - Uber style black line */}
        {showRoute && routePath.length > 0 && (
          <>
            {/* Shadow/outline */}
            <Polyline
              positions={routePath}
              color="#000"
              weight={6}
              opacity={0.3}
              lineCap="round"
              lineJoin="round"
            />
            {/* Main route line */}
            <Polyline
              positions={routePath}
              color="#000"
              weight={4}
              opacity={1}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}
        
        {/* Pickup Marker */}
        {pickup && (
          <Marker position={pickup} icon={pickupIcon} />
        )}
        
        {/* Dropoff Marker */}
        {dropoff && (
          <Marker position={dropoff} icon={dropoffIcon} />
        )}
        
        {/* Animated Car */}
        {showCar && pickup && dropoff && (
          <AnimatedCar from={pickup} to={dropoff} progress={carProgress} />
        )}
        
        {/* User Location - blue dot */}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon} />
        )}
      </MapContainer>
    </div>
  );
}

export default RideMap;
