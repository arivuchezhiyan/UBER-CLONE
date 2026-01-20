import React, { useState, useEffect, useRef } from 'react';
import './LocationSearch.css';

// Using Nominatim (OpenStreetMap) for free geocoding
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function LocationSearch({ 
  placeholder, 
  value, 
  onChange, 
  onLocationSelect,
  icon,
  autoFocus = false 
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Saved/recent places
  const savedPlaces = [
    { id: 'home', name: 'Home', address: 'Add home address', icon: '🏠', saved: false },
    { id: 'work', name: 'Work', address: 'Add work address', icon: '💼', saved: false },
  ];

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const searchLocations = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&countrycodes=in`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      const data = await response.json();
      
      const formattedSuggestions = data.map((item) => ({
        id: item.place_id,
        name: item.display_name.split(',')[0],
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type
      }));
      
      setSuggestions(formattedSuggestions);
    } catch (error) {
      console.error('Search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    onChange && onChange(newQuery);
    setShowSuggestions(true);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchLocations(newQuery);
    }, 300);
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.address);
    onChange && onChange(suggestion.address);
    onLocationSelect && onLocationSelect({
      address: suggestion.address,
      name: suggestion.name,
      lat: suggestion.lat,
      lng: suggestion.lng
    });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await response.json();
            
            const location = {
              address: data.display_name,
              name: 'Current Location',
              lat: latitude,
              lng: longitude
            };
            
            setQuery(data.display_name);
            onChange && onChange(data.display_name);
            onLocationSelect && onLocationSelect(location);
          } catch (error) {
            console.error('Reverse geocode error:', error);
            setQuery('Current Location');
            onChange && onChange('Current Location');
            onLocationSelect && onLocationSelect({
              address: 'Current Location',
              name: 'Current Location',
              lat: latitude,
              lng: longitude
            });
          } finally {
            setIsLoading(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLoading(false);
          alert('Unable to get your location. Please enable location services.');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  return (
    <div className="location-search">
      <div className="search-input-wrapper">
        {icon && <span className="search-icon">{icon}</span>}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className="search-input"
        />
        {isLoading && <div className="search-spinner"></div>}
      </div>

      {showSuggestions && (
        <div className="suggestions-container">
          {/* Current Location Option */}
          <div className="suggestion-item current-location" onClick={handleCurrentLocation}>
            <span className="suggestion-icon">📍</span>
            <div className="suggestion-text">
              <span className="suggestion-name">Use current location</span>
              <span className="suggestion-address">Enable GPS for accurate pickup</span>
            </div>
          </div>

          {/* Saved Places */}
          {!query && savedPlaces.map((place) => (
            <div 
              key={place.id} 
              className="suggestion-item saved-place"
              onClick={() => place.saved && handleSuggestionClick(place)}
            >
              <span className="suggestion-icon">{place.icon}</span>
              <div className="suggestion-text">
                <span className="suggestion-name">{place.name}</span>
                <span className="suggestion-address">{place.address}</span>
              </div>
            </div>
          ))}

          {/* Search Results */}
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <span className="suggestion-icon">📍</span>
              <div className="suggestion-text">
                <span className="suggestion-name">{suggestion.name}</span>
                <span className="suggestion-address">{suggestion.address}</span>
              </div>
            </div>
          ))}

          {/* No Results */}
          {query.length >= 3 && !isLoading && suggestions.length === 0 && (
            <div className="no-results">
              <span>No locations found</span>
              <span className="no-results-hint">Try a different search term</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationSearch;
