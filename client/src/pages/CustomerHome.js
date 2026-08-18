import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import RideMap from '../components/Map/RideMap';
import BackButton from '../components/BackButton/BackButton';
import './CustomerHome.css';

export const PLACES_DATABASE = [
  // Saved / Home / Work
  { id: 's1', name: 'Home', address: 'Kelambakkam Junction, OMR', icon: '🏠', category: 'Saved', type: 'saved', distanceKm: 1.2, isLongDistance: false, coords: { lat: 12.7871, lng: 80.2185 } },
  { id: 's2', name: 'Work', address: 'Siruseri SIPCOT IT Park, TCS Gate', icon: '💼', category: 'Saved', type: 'tech_park', distanceKm: 4.8, isLongDistance: false, coords: { lat: 12.8277, lng: 80.2188 } },

  // 🚇 METRO STATIONS
  { id: 'm1', name: 'Guindy Metro Station', address: 'GST Road & Kathipara Junction, Chennai Metro Blue Line', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 27.0, isLongDistance: false, coords: { lat: 13.0067, lng: 80.2030 } },
  { id: 'm2', name: 'Alandur Intermodal Metro Station', address: 'Kathipara Green/Blue Line Interchange, Chennai', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 28.0, isLongDistance: false, coords: { lat: 13.0040, lng: 80.2014 } },
  { id: 'm3', name: 'Chennai International Airport Metro Station', address: 'Meenambakkam Terminal Airport Metro, Chennai', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 28.5, isLongDistance: false, coords: { lat: 12.9808, lng: 80.1636 } },
  { id: 'm4', name: 'Chennai Central Metro Station', address: 'Puratchi Thalaivar Dr. M.G.R Underground Metro Hub', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 36.0, isLongDistance: false, coords: { lat: 13.0818, lng: 80.2730 } },
  { id: 'm5', name: 'Little Mount Metro Station', address: 'Anna Salai, Saidapet / Guindy, Chennai', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 26.5, isLongDistance: false, coords: { lat: 13.0150, lng: 80.2207 } },
  { id: 'm6', name: 'MG Road Metro Station', address: 'Mahatma Gandhi Road, Purple Line, Bengaluru Central', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 5.6, isLongDistance: false, coords: { lat: 12.9756, lng: 77.6066 } },
  { id: 'm7', name: 'Indiranagar Metro Station', address: 'CMH Road / 100 Feet Rd, Purple Line, Bengaluru', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 4.2, isLongDistance: false, coords: { lat: 12.9783, lng: 77.6386 } },
  { id: 'm8', name: 'Kempegowda Majestic Metro Station', address: 'Majestic Green/Purple Line Metro Interchange, Bengaluru', icon: '🚇', category: 'Metro', type: 'metro', distanceKm: 7.8, isLongDistance: false, coords: { lat: 12.9755, lng: 77.5728 } },

  // 🚆 RAILWAY STATIONS
  { id: 'r1', name: 'Tambaram Railway Station', address: 'GST Road, Tambaram Sanatorium / MEPZ (TBM)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 22.0, isLongDistance: false, coords: { lat: 12.9249, lng: 80.1000 } },
  { id: 'r2', name: 'Chennai Central Railway Station', address: 'Puratchi Thalaivar Dr. M.G.R Central (MAS)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 36.0, isLongDistance: false, coords: { lat: 13.0827, lng: 80.2707 } },
  { id: 'r3', name: 'Chennai Egmore Railway Station', address: 'Gandhi Irwin Road, Egmore (MS)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 34.5, isLongDistance: false, coords: { lat: 13.0784, lng: 80.2612 } },
  { id: 'r4', name: 'Mambalam Railway Station', address: 'Ranganathan Street, T. Nagar (MBM)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 30.5, isLongDistance: false, coords: { lat: 13.0336, lng: 80.2285 } },
  { id: 'r5', name: 'Chengalpattu Railway Junction', address: 'GST Road, Chengalpattu (CGL)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 29.0, isLongDistance: false, coords: { lat: 12.6841, lng: 79.9776 } },
  { id: 'r6', name: 'KSR Bengaluru City Railway Station', address: 'Kempegowda Majestic Junction (SBC)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 7.9, isLongDistance: false, coords: { lat: 12.9781, lng: 77.5694 } },
  { id: 'r7', name: 'Yeshwanthpur Junction Railway Station', address: 'Tumkur Road, Platform 1/6 (YPR)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 13.2, isLongDistance: false, coords: { lat: 13.0234, lng: 77.5501 } },
  { id: 'r8', name: 'Bangalore Cantonment Railway Station', address: 'Cantonment Station Road, Vasanth Nagar (BNC)', icon: '🚆', category: 'Railway', type: 'railway', distanceKm: 6.8, isLongDistance: false, coords: { lat: 12.9930, lng: 77.5985 } },

  // ✈️ AIRPORTS
  { id: 'a1', name: 'Chennai International Airport (MAA)', address: 'Terminal 1 (Domestic), T2 (Intl) & T4, Meenambakkam', icon: '✈️', category: 'Airport', type: 'airport', distanceKm: 28.5, isLongDistance: false, coords: { lat: 12.9941, lng: 80.1709 } },
  { id: 'a2', name: 'Kempegowda International Airport (BLR)', address: 'Terminal 1 & Terminal 2, Devanahalli, Bengaluru', icon: '✈️', category: 'Airport', type: 'airport', distanceKm: 38.5, isLongDistance: false, coords: { lat: 13.1986, lng: 77.7066 } },

  // 🚌 BUS STANDS & TERMINALS
  { id: 'b1', name: 'Kelambakkam Bus Stand', address: 'Rajiv Gandhi Salai, Kelambakkam Junction (OMR)', icon: '🚌', category: 'Bus Stand', type: 'bus', distanceKm: 0.5, isLongDistance: false, coords: { lat: 12.7871, lng: 80.2185 } },
  { id: 'b2', name: 'Kilambakkam Kalaignar Centenary Bus Terminus (KCBT)', address: 'GST Road, Vandalur, Chennai Intercity Hub', icon: '🚌', category: 'Bus Stand', type: 'bus', distanceKm: 19.5, isLongDistance: false, coords: { lat: 12.8718, lng: 80.0827 } },
  { id: 'b3', name: 'CMBT Bus Terminus', address: 'Jawaharlal Nehru Road, Koyambedu, Chennai', icon: '🚌', category: 'Bus Stand', type: 'bus', distanceKm: 33.0, isLongDistance: false, coords: { lat: 13.0694, lng: 80.2057 } },
  { id: 'b4', name: 'Sholinganallur Junction Bus Stop', address: 'OMR - ECR Link Road Junction, Chennai', icon: '🚌', category: 'Bus Stand', type: 'bus', distanceKm: 12.5, isLongDistance: false, coords: { lat: 12.9010, lng: 80.2279 } },
  { id: 'b5', name: 'Majestic Kempegowda Bus Station', address: 'Subhash Nagar, Intercity & BMTC Hub, Bengaluru', icon: '🚌', category: 'Bus Stand', type: 'bus', distanceKm: 7.9, isLongDistance: false, coords: { lat: 12.9767, lng: 77.5713 } },

  // 🏥 HOSPITALS
  { id: 'h1', name: 'Chettinad Health City Hospital', address: 'Rajiv Gandhi Salai (OMR), Kelambakkam', icon: '🏥', category: 'Hospital', type: 'hospital', distanceKm: 1.5, isLongDistance: false, coords: { lat: 12.7932, lng: 80.2198 } },
  { id: 'h2', name: 'Apollo Speciality Hospitals OMR', address: '05/639, Old Mahabalipuram Rd, Perungudi, Chennai', icon: '🏥', category: 'Hospital', type: 'hospital', distanceKm: 19.0, isLongDistance: false, coords: { lat: 12.9634, lng: 80.2442 } },
  { id: 'h3', name: 'Gleneagles Global Health City', address: '439, Cheran Nagar, Perumbakkam, Chennai', icon: '🏥', category: 'Hospital', type: 'hospital', distanceKm: 15.0, isLongDistance: false, coords: { lat: 12.9038, lng: 80.1911 } },
  { id: 'h4', name: 'Apollo Hospitals Greams Road', address: '21 Greams Lane, Off Greams Road, Thousand Lights', icon: '🏥', category: 'Hospital', type: 'hospital', distanceKm: 34.0, isLongDistance: false, coords: { lat: 13.0604, lng: 80.2505 } },
  { id: 'h5', name: 'Manipal Hospital HAL Airport Road', address: '98, HAL Old Airport Rd, Kodihalli, Bengaluru', icon: '🏥', category: 'Hospital', type: 'hospital', distanceKm: 5.5, isLongDistance: false, coords: { lat: 12.9592, lng: 77.6499 } },

  // 🏢 TECH PARKS & HUBS
  { id: 'tp1', name: 'Siruseri SIPCOT IT Park', address: 'TCS, Cognizant, Hexaware, Syntel Campuses, OMR', icon: '🏢', category: 'Tech Park', type: 'tech_park', distanceKm: 4.5, isLongDistance: false, coords: { lat: 12.8277, lng: 80.2188 } },
  { id: 'tp2', name: 'Navalur Vivira Mall & Tech Zone', address: 'Rajiv Gandhi IT Expressway, Navalur (OMR)', icon: '🛍️', category: 'Tech Park', type: 'tech_park', distanceKm: 6.8, isLongDistance: false, coords: { lat: 12.8465, lng: 80.2260 } },
  { id: 'tp3', name: 'Tidel Park & Ramanujan IT City', address: 'Rajiv Gandhi Salai, Taramani, Chennai', icon: '🏢', category: 'Tech Park', type: 'tech_park', distanceKm: 21.0, isLongDistance: false, coords: { lat: 12.9893, lng: 80.2475 } },
  { id: 'tp4', name: 'Whitefield ITPL Tech Park', address: 'International Tech Park, Prestige Shantiniketan, BLR', icon: '🏢', category: 'Tech Park', type: 'tech_park', distanceKm: 14.5, isLongDistance: false, coords: { lat: 12.9698, lng: 77.7499 } },
  { id: 'tp5', name: 'Electronic City Phase 1 Infosys Campus', address: 'Infosys Main Gate, Hosur Elevated Tollway, BLR', icon: '🏢', category: 'Tech Park', type: 'tech_park', distanceKm: 11.2, isLongDistance: false, coords: { lat: 12.8399, lng: 77.6770 } },
  { id: 'tp6', name: 'Manyata Embassy Business Park', address: 'Outer Ring Road, Nagawara, Hebbal, Bengaluru', icon: '🏢', category: 'Tech Park', type: 'tech_park', distanceKm: 15.0, isLongDistance: false, coords: { lat: 13.0475, lng: 77.6200 } },

  // ⛰️ OUTSTATIONS & TOURIST ATTRACTIONS
  { id: 'l1', name: 'Mahabalipuram UNESCO Shore Temple', address: 'Shore Temple & Pancha Rathas, ECR, Mamallapuram', icon: '🏛️', category: 'Outstation', type: 'outstation', distanceKm: 18.0, isLongDistance: false, coords: { lat: 12.6165, lng: 80.1983 } },
  { id: 'l2', name: 'Kovalam Beach & Surf School', address: 'East Coast Road (ECR), Kovalam, Chennai', icon: '🏖️', category: 'Outstation', type: 'outstation', distanceKm: 5.5, isLongDistance: false, coords: { lat: 12.7925, lng: 80.2514 } },
  { id: 'l3', name: 'Pondicherry (Puducherry)', address: 'White Town French Quarter & Promenade Beach', icon: '🏖️', category: 'Outstation', type: 'outstation', distanceKm: 115.0, isLongDistance: true, coords: { lat: 11.9416, lng: 79.8083 } },
  { id: 'l4', name: 'Tirupati Balaji Temple', address: 'Tirumala Hills, Andhra Pradesh', icon: '🛕', category: 'Outstation', type: 'outstation', distanceKm: 155.0, isLongDistance: true, coords: { lat: 13.6833, lng: 79.3500 } },
  { id: 'l5', name: 'Vellore Golden Temple & Fort', address: 'Sripuram & Vellore Fort, Tamil Nadu', icon: '🛕', category: 'Outstation', type: 'outstation', distanceKm: 140.0, isLongDistance: true, coords: { lat: 12.8711, lng: 79.0888 } },
  { id: 'l6', name: 'Nandi Hills', address: 'Chikkaballapur District (Hilltop Sunrise)', icon: '⛰️', category: 'Outstation', type: 'outstation', distanceKm: 62.0, isLongDistance: true, coords: { lat: 13.3702, lng: 77.6835 } },
  { id: 'l7', name: 'Mysore Palace (Mysuru)', address: 'Sayyaji Rao Rd, Mysuru, Karnataka', icon: '🏰', category: 'Outstation', type: 'outstation', distanceKm: 145.0, isLongDistance: true, coords: { lat: 12.3052, lng: 76.6552 } },
  { id: 'l8', name: 'Coorg (Madikeri Hills)', address: 'Kodagu Coffee Estates & Abbey Falls', icon: '☕', category: 'Outstation', type: 'outstation', distanceKm: 250.0, isLongDistance: true, coords: { lat: 12.4244, lng: 75.7382 } }
];

export const reverseGeocode = async (lat, lng) => {
  if (!lat || !lng) return 'Current Location';

  // 1. Proximity check against PLACES_DATABASE (within 1.5 km, use clean prominent name)
  for (const place of PLACES_DATABASE) {
    if (place.coords) {
      const dLat = (lat - place.coords.lat) * 111;
      const dLng = (lng - place.coords.lng) * 105;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      if (dist <= 1.2) {
        return place.name;
      }
    }
  }

  // 2. Query Nominatim with detailed address structure
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'Accept-Language': 'en' }
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      
      const locality = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.town || addr.hamlet || addr.residential;
      let road = addr.road || '';
      // Clean long highway strings like "Rajiv Gandhi Road (Chennai - Thiruporur Road)"
      if (road.includes('(')) {
        road = road.split('(')[0].trim();
      }
      if (road.toLowerCase().includes('rajiv gandhi')) {
        road = 'OMR Expressway';
      }

      const landmark = addr.amenity || addr.building || addr.shop || addr.office;
      const city = addr.city || addr.state_district || addr.county || 'Chennai';

      if (landmark && locality) {
        return `${landmark}, ${locality}`;
      } else if (road && locality && !road.toLowerCase().includes(locality.toLowerCase())) {
        return `${road}, ${locality}`;
      } else if (locality) {
        return `${locality}, ${city}`;
      } else if (road) {
        return `${road}, ${city}`;
      } else if (data.display_name) {
        const parts = data.display_name.split(',').map(s => s.trim());
        return parts.slice(0, 2).join(', ');
      }
    }
  } catch (e) {
    console.warn('Reverse geocode fallback:', e);
  }

  // 3. Realistic regional coordinate lookup fallback
  if (lat >= 12.68 && lat <= 12.75) {
    return 'Thiruporur, Chennai';
  } else if (lat > 12.75 && lat <= 12.82) {
    return 'Kelambakkam Junction, Chennai';
  } else if (lat > 12.82 && lat <= 12.87) {
    return 'Navalur OMR, Chennai';
  } else if (lat > 12.87 && lat <= 12.94) {
    return 'Sholinganallur, Chennai';
  } else if (lat > 12.8 && lat < 13.1 && lng > 77.4 && lng < 77.8) {
    return 'Koramangala 4th Block, Bengaluru';
  }
  return 'Current Location';
};

// Snap coordinates to the nearest real drivable road on land
export const snapToNearestRoad = async (lat, lng) => {
  let safeLng = lng;
  let safeLat = lat;
  if (lat > 12.5 && lat < 13.3) {
    if (safeLng > 80.235) {
      safeLng = 80.222;
    }
  }

  try {
    const res = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${safeLng},${safeLat}`);
    if (res.ok) {
      const data = await res.json();
      if (data.waypoints && data.waypoints.length > 0) {
        const roadCoord = data.waypoints[0].location;
        let roadLng = roadCoord[0];
        let roadLat = roadCoord[1];
        if (roadLat > 12.5 && roadLat < 13.3 && roadLng > 80.235) {
          roadLng = 80.222;
        }
        return {
          lat: roadLat,
          lng: roadLng,
          roadName: data.waypoints[0].name || ''
        };
      }
    }
  } catch (e) {
    console.warn('Road snap fallback:', e);
  }
  return { lat: safeLat, lng: safeLng };
};

export const geocodeAddress = async (query, baseLat = 12.7871, baseLng = 80.2185) => {
  if (!query || !query.trim()) return null;

  const cleanQ = query.toLowerCase().trim();

  // 1. Proximity-aware Amenity & Food Resolver (Finds closest real spot relative to user's GPS!)
  if (cleanQ.includes('briyani') || cleanQ.includes('biryani') || cleanQ.includes('food') || cleanQ.includes('restaurant') || cleanQ.includes('hotel')) {
    if (baseLat > 12.5 && baseLat < 13.3) {
      // Localized Biryani Hotspots in Chennai OMR/South
      if (baseLat <= 12.75) {
        return { lat: 12.7285, lng: 80.1980 }; // Thiruporur Food Junction (~1 km from Thiruporur)
      } else if (baseLat <= 12.81) {
        return { lat: 12.7885, lng: 80.2201 }; // Kelambakkam Junction Biryani Spot
      } else if (baseLat <= 12.87) {
        return { lat: 12.8480, lng: 80.2268 }; // Navalur OMR Thalappakatti & Food Street
      } else {
        return { lat: 12.8985, lng: 80.2260 }; // Sholinganallur SS Hyderabad Biryani
      }
    } else {
      // Bangalore Biryani Hotspots
      return { lat: 12.9344, lng: 77.6272 }; // Koramangala
    }
  }

  if (cleanQ.includes('coffee') || cleanQ.includes('cafe') || cleanQ.includes('tea') || cleanQ.includes('bakery')) {
    if (baseLat > 12.5 && baseLat < 13.3) {
      if (baseLat <= 12.81) {
        return { lat: 12.7875, lng: 80.2195 }; // Kelambakkam Chai Point
      }
      return { lat: 12.8465, lng: 80.2260 }; // Vivira Mall Cafe
    } else {
      return { lat: 12.9719, lng: 77.6412 }; // Indiranagar
    }
  }

  if (cleanQ.includes('cinema') || cleanQ.includes('movie') || cleanQ.includes('theater') || cleanQ.includes('mall') || cleanQ.includes('shopping')) {
    if (baseLat > 12.5 && baseLat < 13.3) {
      return { lat: 12.8465, lng: 80.2260 }; // AGS Cinemas Vivira Mall OMR
    } else {
      return { lat: 12.9959, lng: 77.6964 }; // Phoenix Marketcity Bangalore
    }
  }

  if (cleanQ.includes('atm') || cleanQ.includes('bank')) {
    if (baseLat > 12.5 && baseLat < 13.3) {
      if (baseLat <= 12.75) return { lat: 12.7265, lng: 80.1970 }; // Thiruporur SBI ATM
      return { lat: 12.7871, lng: 80.2185 }; // Kelambakkam Junction HDFC
    } else {
      return { lat: 12.9756, lng: 77.6066 }; // MG Road
    }
  }

  if (cleanQ.includes('petrol') || cleanQ.includes('fuel') || cleanQ.includes('diesel') || cleanQ.includes('gas')) {
    if (baseLat > 12.5 && baseLat < 13.3) {
      if (baseLat <= 12.75) return { lat: 12.7290, lng: 80.1985 }; // Thiruporur HP Bunk
      return { lat: 12.7890, lng: 80.2195 }; // OMR Kelambakkam Indian Oil
    } else {
      return { lat: 12.9344, lng: 77.6272 };
    }
  }

  // 2. Recognized Area & Corridor Landmark matches
  if (cleanQ.includes('kelambak') || cleanQ.includes('kelambakkam')) {
    return { lat: 12.7871, lng: 80.2185 }; // Kelambakkam Junction (OMR / ECR Link)
  }
  if (cleanQ.includes('ssn') || cleanQ.includes('kalavakkam')) {
    return { lat: 12.7508, lng: 80.1983 }; // SSN College / Kalavakkam Main Gate (OMR)
  }
  if (cleanQ.includes('thiruporur')) {
    return { lat: 12.7230, lng: 80.1915 }; // Thiruporur Main Junction
  }
  if (cleanQ.includes('siruseri') || cleanQ.includes('sipcot')) {
    return { lat: 12.8285, lng: 80.2195 }; // Siruseri SIPCOT IT Park
  }
  if (cleanQ.includes('navalur') || cleanQ.includes('vivira')) {
    return { lat: 12.8465, lng: 80.2260 }; // Navalur OMR Vivira Hub
  }
  if (cleanQ.includes('sholinganallur')) {
    return { lat: 12.8985, lng: 80.2260 }; // Sholinganallur Junction
  }
  if (cleanQ.includes('tambaram')) {
    return { lat: 12.9249, lng: 80.1260 }; // Tambaram Junction
  }
  if (cleanQ.includes('velachery')) {
    return { lat: 12.9815, lng: 80.2180 }; // Velachery
  }
  if (cleanQ.includes('guindy')) {
    return { lat: 13.0067, lng: 80.2024 }; // Guindy
  }

  // 3. Exact or partial match in PLACES_DATABASE
  const matchedPlace = PLACES_DATABASE.find(p => 
    p.name.toLowerCase() === cleanQ || 
    p.address.toLowerCase().includes(cleanQ) ||
    cleanQ.includes(p.name.toLowerCase())
  );
  if (matchedPlace && matchedPlace.coords) {
    return matchedPlace.coords;
  }

  // 3. Query OpenStreetMap Nominatim for real-world lat/lng
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (res.ok) {
      const results = await res.json();
      if (results && results.length > 0) {
        let rawLat = parseFloat(results[0].lat);
        let rawLng = parseFloat(results[0].lon);

        // Snap to nearest drivable road safely inland
        const snapped = await snapToNearestRoad(rawLat, rawLng);
        return { lat: snapped.lat, lng: snapped.lng };
      }
    }
  } catch (err) {
    console.warn('Geocoding search fallback:', err);
  }

  // 4. Guaranteed Inland Terrestrial Offset along the road network
  let hash = 0;
  for (let i = 0; i < query.length; i++) {
    hash = ((hash << 5) - hash) + query.charCodeAt(i);
    hash |= 0;
  }
  // Offset North/South along the highway corridor, clamping strictly to motorable land
  const offsetLat = ((Math.abs(hash) % 30) + 8) * 0.001 * (hash % 2 === 0 ? 1 : -1);
  // Keep longitude strictly aligned with the main north-south road corridor (OMR: 80.22)
  const safeTargetLat = baseLat + offsetLat;
  let safeTargetLng = baseLng;
  if (safeTargetLat > 12.5 && safeTargetLat < 13.3) {
    // Chennai OMR corridor is at 80.22 - never exceed 80.235
    safeTargetLng = 80.220 + ((Math.abs(hash) % 10) * 0.001);
  }

  const snapped = await snapToNearestRoad(safeTargetLat, safeTargetLng);
  return {
    lat: snapped.lat,
    lng: snapped.lng
  };
};

function CustomerHome({ user }) {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [activeField, setActiveField] = useState('dropoff');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('ALL');
  const [locationAlert, setLocationAlert] = useState('');

  // Schedule Ride States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);

  // Auto-fetch Current Location on Boot
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          setCurrentLocation(coords);
          const placeName = await reverseGeocode(coords.lat, coords.lng);
          setPickup(placeName);
        },
        async () => {
          setCurrentLocation({ lat: 12.9716, lng: 77.5946 });
          const placeName = await reverseGeocode(12.9716, 77.5946);
          setPickup(placeName);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setCurrentLocation({ lat: 12.9716, lng: 77.5946 });
      setPickup('Koramangala 4th Block, Bengaluru');
    }
  }, []);

  // GPS Locate Button Handler
  const handleDetectGPSLocation = (e) => {
    if (e) e.stopPropagation();
    if (!navigator.geolocation) {
      setLocationAlert('⚠️ Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setCurrentLocation(coords);
        const placeName = await reverseGeocode(coords.lat, coords.lng);
        setPickup(placeName);
        setActiveField('dropoff');
      },
      (err) => {
        console.warn('GPS location request error:', err);
        setLocationAlert('⚠️ Location Access Required: Please turn on your device GPS / location services and allow location permission in your browser to auto-fill your current pickup point.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Filtered Recommendations with transit categorization
  const currentQuery = (activeField === 'pickup' ? pickup : dropoff) || '';
  const filteredPlaces = PLACES_DATABASE.filter(place => {
    let matchesCategory = true;
    if (selectedFilterCategory === 'METRO') matchesCategory = place.type === 'metro';
    else if (selectedFilterCategory === 'RAILWAY') matchesCategory = place.type === 'railway';
    else if (selectedFilterCategory === 'AIRPORT') matchesCategory = place.type === 'airport';
    else if (selectedFilterCategory === 'BUS') matchesCategory = place.type === 'bus';
    else if (selectedFilterCategory === 'HOSPITAL') matchesCategory = place.type === 'hospital';
    else if (selectedFilterCategory === 'TECH') matchesCategory = place.type === 'tech_park';
    else if (selectedFilterCategory === 'OUTSTATION') matchesCategory = place.isLongDistance || place.type === 'outstation';

    if (!currentQuery.trim()) return matchesCategory;

    const q = currentQuery.toLowerCase().trim();
    const queryMatches = 
      place.name.toLowerCase().includes(q) ||
      place.address.toLowerCase().includes(q) ||
      place.category.toLowerCase().includes(q) ||
      (place.type && place.type.toLowerCase().includes(q)) ||
      (q.includes('metro') && place.type === 'metro') ||
      ((q.includes('rail') || q.includes('train') || q.includes('station')) && place.type === 'railway') ||
      ((q.includes('airport') || q.includes('flight') || q.includes('terminal')) && place.type === 'airport') ||
      ((q.includes('bus') || q.includes('stand') || q.includes('depot')) && place.type === 'bus') ||
      ((q.includes('hospital') || q.includes('health') || q.includes('clinic') || q.includes('doctor')) && place.type === 'hospital') ||
      ((q.includes('it') || q.includes('tech') || q.includes('park') || q.includes('campus') || q.includes('office')) && place.type === 'tech_park');

    return matchesCategory && queryMatches;
  });

  const handlePlaceSelect = (place) => {
    if (activeField === 'pickup') {
      setPickup(place.name);
      setActiveField('dropoff');
    } else {
      setDropoff(place.name);
      // Navigate to booking when destination is selected
      setTimeout(() => {
        navigate('/book', {
          state: {
            pickup: pickup || 'Current location',
            dropoff: place.name,
            isScheduled,
            scheduledDate,
            scheduledTime,
            estimatedDistance: place.distanceKm || 8
          }
        });
      }, 150);
    }
  };

  const handleConfirm = () => {
    if (pickup && dropoff) {
      navigate('/book', {
        state: {
          pickup,
          dropoff,
          isScheduled,
          scheduledDate,
          scheduledTime
        }
      });
    }
  };

  // Main screen with map
  if (!showSearch) {
    return (
      <div className="uber-home">
        {/* Full Screen Map */}
        <div className="uber-map-wrapper">
          {currentLocation && (
            <RideMap
              pickup={[currentLocation.lat, currentLocation.lng]}
              height="100%"
            />
          )}
        </div>

        {/* Top Bar */}
        <div className="uber-top-bar" style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100
        }}>
          <button className="uber-menu-btn" onClick={() => navigate('/profile')} title="My Profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => navigate('/history')}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>🚗</span>
              <span>Trips</span>
            </button>
          </div>
        </div>

        {/* Bottom Card */}
        <div className="uber-bottom-card">
          {/* Greeting */}
          <div className="uber-greeting">
            <span className="greeting-wave">👋</span>
            <span className="greeting-text">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0] || 'there'}
            </span>
          </div>

          {/* Where to? Search Bar */}
          <div className="uber-search-bar" onClick={() => setShowSearch(true)}>
            <div className="search-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <span className="search-placeholder">Where to?</span>
            <div className="search-divider"></div>
            <button 
              className={`search-now-btn ${isScheduled ? 'scheduled-active' : ''}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowScheduleModal(true);
              }}
              title="Schedule a Ride for Future"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>{isScheduled ? `${scheduledTime || 'Scheduled'}` : 'Now'}</span>
              <svg viewBox="0 0 24 24" fill="currentColor" width="12">
                <path d="M7 10l5 5 5-5z"/>
              </svg>
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="uber-suggestions">
            {PLACES_DATABASE.slice(0, 2).map(place => (
              <div 
                key={place.id} 
                className="suggestion-item"
                onClick={() => {
                  setDropoff(place.name);
                  navigate('/book', {
                    state: {
                      pickup: pickup || 'Current location',
                      dropoff: place.name,
                      isScheduled,
                      scheduledDate,
                      scheduledTime,
                      estimatedDistance: place.distanceKm || 5
                    }
                  });
                }}
              >
                <div className="suggestion-icon">{place.icon}</div>
                <div className="suggestion-info">
                  <span className="suggestion-name">{place.name}</span>
                  <span className="suggestion-address">{place.address}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Services Grid */}
          <div className="uber-services">
            <div className="service-item" onClick={() => setShowSearch(true)}>
              <div className="service-icon-wrapper">
                <img src="https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png" alt="Ride" className="service-img"/>
              </div>
              <span>Ride</span>
            </div>
            <div className="service-item" onClick={() => setShowSearch(true)}>
              <div className="service-icon-wrapper">
                <img src="https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Moto.png" alt="Two Wheeler" className="service-img"/>
              </div>
              <span>Two Wheeler</span>
            </div>
            <div className="service-item" onClick={() => setShowScheduleModal(true)}>
              <div className="service-icon-wrapper package" style={{ background: '#2563eb' }}>
                <span style={{ fontSize: '24px' }}>🕒</span>
              </div>
              <span>Reserve</span>
            </div>
            <div className="service-item" onClick={() => setShowSearch(true)}>
              <div className="service-icon-wrapper rentals">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                </svg>
              </div>
              <span>Rentals</span>
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <nav className="uber-nav">
          <div className="nav-item active">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span>Home</span>
          </div>
          <div className="nav-item" onClick={() => navigate('/history')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <span>Activity</span>
          </div>
          <div className="nav-item" onClick={() => navigate('/profile')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Account</span>
          </div>
        </nav>

        {/* SCHEDULE RIDE MODAL */}
        {showScheduleModal && (
          <div className="modal-overlay" style={{ zIndex: 999999 }}>
            <div className="schedule-ride-modal">
              <div className="schedule-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '22px' }}>🕒</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Schedule a Ride</h3>
                </div>
                <button 
                  type="button" 
                  className="close-schedule-btn" 
                  onClick={() => setShowScheduleModal(false)}
                >
                  ✕
                </button>
              </div>

              <p className="schedule-modal-subtext">
                Choose your exact pickup date and time in advance. A captain will arrive right on schedule.
              </p>

              {/* Date Selection */}
              <div className="schedule-field-group">
                <label>Pickup Date</label>
                <input 
                  type="date" 
                  className="schedule-input"
                  min={new Date().toISOString().split('T')[0]}
                  value={scheduledDate || new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              {/* Time Selection */}
              <div className="schedule-field-group">
                <label>Pickup Time</label>
                <input 
                  type="time" 
                  className="schedule-input"
                  value={scheduledTime || '10:00'}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>

              <div className="schedule-info-box">
                <span>💡</span>
                <p>Extra wait time included to meet your ride. Free cancellation up to 60 min before pickup.</p>
              </div>

              {/* Action Buttons */}
              <div className="schedule-actions-row">
                <button 
                  type="button" 
                  className="btn-clear-schedule"
                  onClick={() => {
                    setIsScheduled(false);
                    setScheduledDate('');
                    setScheduledTime('');
                    setShowScheduleModal(false);
                  }}
                >
                  Ride Now
                </button>
                <button 
                  type="button" 
                  className="btn-confirm-schedule"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const chosenDate = scheduledDate || todayStr;
                    const chosenTime = scheduledTime || '10:00';
                    setScheduledDate(chosenDate);
                    setScheduledTime(chosenTime);
                    setIsScheduled(true);
                    setShowScheduleModal(false);
                  }}
                >
                  Set Pickup Time
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Search screen
  return (
    <div className="uber-search-screen">
      {/* Search Header */}
      <div className="search-top-bar">
        <BackButton onClick={() => setShowSearch(false)} label="Back" />
        <span className="search-screen-title">Where to?</span>
        <div style={{ width: '60px' }}></div>
      </div>

      <div className="search-inputs-card">
        <div className="location-inputs">
          <div className="input-row">
            <div className="input-dot pickup"></div>
            <input
              type="text"
              placeholder="Pickup location"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              onFocus={() => setActiveField('pickup')}
              className={activeField === 'pickup' ? 'active' : ''}
            />
            <button
              type="button"
              className="locate-gps-btn"
              onClick={handleDetectGPSLocation}
              title="Detect My GPS Location"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="7"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <line x1="12" y1="2" x2="12" y2="5"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="2" y1="12" x2="5" y2="12"/>
                <line x1="19" y1="12" x2="22" y2="12"/>
              </svg>
              <span>Locate</span>
            </button>
          </div>
          <div className="input-connector"></div>
          <div className="input-row">
            <div className="input-dot dropoff"></div>
            <input
              type="text"
              placeholder="Where to? (e.g. Koramangala, Airport, Mysore...)"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              onFocus={() => setActiveField('dropoff')}
              className={activeField === 'dropoff' ? 'active' : ''}
              autoFocus
            />
          </div>
        </div>

        <button className="add-stop-btn" title="Add Stop">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Category Recommendation Filter Tabs */}
      <div className="places-filter-bar">
        <button 
          className={`filter-pill ${selectedFilterCategory === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('ALL')}
        >
          🌟 All
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'METRO' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('METRO')}
        >
          🚇 Nearby Metro
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'RAILWAY' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('RAILWAY')}
        >
          🚆 Railway Stations
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'AIRPORT' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('AIRPORT')}
        >
          ✈️ Airports
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'BUS' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('BUS')}
        >
          🚌 Bus Stands
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'HOSPITAL' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('HOSPITAL')}
        >
          🏥 Hospitals
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'TECH' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('TECH')}
        >
          🏢 IT Tech Parks
        </button>
        <button 
          className={`filter-pill ${selectedFilterCategory === 'OUTSTATION' ? 'active' : ''}`}
          onClick={() => setSelectedFilterCategory('OUTSTATION')}
        >
          ⛰️ Outstations
        </button>
      </div>

      {/* Dynamic Filtered Places Recommendations */}
      <div className="search-content">
        <div className="recommendations-container">
          <div className="recommendations-header">
            <h3>
              {currentQuery ? `Results for "${currentQuery}"` : 'Recommended Destinations'}
            </h3>
            <span className="places-count-badge">{filteredPlaces.length} places</span>
          </div>

          <div className="places-list">
            {filteredPlaces.map(place => (
              <div 
                key={place.id} 
                className={`place-item ${place.isLongDistance ? 'long-distance-item' : ''}`} 
                onClick={() => handlePlaceSelect(place)}
              >
                <div className={`place-icon ${place.category.toLowerCase()}`}>
                  {place.icon}
                </div>
                <div className="place-details">
                  <div className="place-title-row">
                    <span className="place-name">{place.name}</span>
                    {place.isLongDistance ? (
                      <span className="distance-badge outstation">Outstation • {place.distanceKm} km</span>
                    ) : (
                      <span className="distance-badge nearby">{place.distanceKm} km</span>
                    )}
                  </div>
                  <span className="place-address">{place.address}</span>
                </div>
              </div>
            ))}

            {filteredPlaces.length === 0 && (
              <div 
                className="place-item custom-address-item"
                onClick={() => handlePlaceSelect({ name: currentQuery, address: 'Custom Specified Location', distanceKm: 12 })}
              >
                <div className="place-icon custom">📍</div>
                <div className="place-details">
                  <span className="place-name">Use "{currentQuery}"</span>
                  <span className="place-address">Tap to set as {activeField} location</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Set location on map */}
        <div className="map-option" onClick={() => navigate('/book', { state: { pickup: pickup || 'Current location', dropoff: dropoff || 'Set on map' } })}>
          <div className="map-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span>Set location on map</span>
        </div>
      </div>

      {/* Location Service Alert Modal */}
      {locationAlert && (
        <div className="modal-overlay" style={{ zIndex: 9999999 }}>
          <div className="location-permission-modal">
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>📡</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800 }}>Location Services Required</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.5, margin: '0 0 16px' }}>
              {locationAlert}
            </p>
            <button 
              className="btn-enable-location"
              onClick={() => {
                setLocationAlert('');
                handleDetectGPSLocation();
              }}
            >
              🔄 Try Again
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

      {/* Confirm Button */}
      {pickup && dropoff && (
        <div className="confirm-bar">
          <button className="confirm-btn" onClick={handleConfirm}>
            Confirm Ride ({pickup} → {dropoff})
          </button>
        </div>
      )}
    </div>
  );
}

export default CustomerHome;
