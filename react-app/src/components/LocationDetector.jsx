import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from '../context/LocationContext';
import { geocodeCity } from '../context/LocationContext';

/**
 * LocationDetector – shows the user's detected location and allows manual override
 * via city name search or raw lat/lng.
 */
export default function LocationDetector() {
  const { location, locationError, locationLoading, detectLocation, setManualLocation } = useLocation();
  const [showManual, setShowManual] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manualError, setManualError] = useState('');
  const debounceRef = useRef(null);

  // Debounced city search
  useEffect(() => {
    if (!cityQuery.trim() || cityQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const hits = await geocodeCity(cityQuery.trim());
      setSearchResults(hits || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [cityQuery]);

  const handleSelectPlace = (place) => {
    setManualLocation({ lat: place.lat, lng: place.lng, city: place.city });
    setShowManual(false);
    setCityQuery('');
    setSearchResults([]);
    setManualError('');
  };

  if (locationLoading) {
    return (
      <div className="location-detector location-detector--loading">
        <span className="location-dot location-dot--pulse">📍</span>
        <span>Detecting your location…</span>
      </div>
    );
  }

  if (locationError && !location) {
    return (
      <div className="location-detector location-detector--error">
        <span>⚠️ {locationError}</span>
        <div className="location-detector-actions">
          <button className="btn-link" onClick={detectLocation}>Try again</button>
          <button className="btn-link" onClick={() => setShowManual(true)}>Enter location manually</button>
        </div>
        {showManual && (
          <div className="location-manual-form">
            <input
              type="text"
              placeholder="Search city or area…"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              style={{ width: '220px' }}
            />
            {searching && <span style={{ fontSize: '12px', color: '#6B7280' }}>Searching…</span>}
            {!searching && searchResults.length > 0 && (
              <div className="location-search-results">
                {searchResults.map((place) => (
                  <button key={`${place.lat}-${place.lng}`} className="location-search-item" onClick={() => handleSelectPlace(place)}>
                    📍 {place.displayName}
                  </button>
                ))}
              </div>
            )}
            {manualError && <p className="location-manual-error">{manualError}</p>}
          </div>
        )}
      </div>
    );
  }

  if (location) {
    const sourceLabel = {
      gps: '📍 GPS',
      geoip: '🌐 Estimated',
      manual: '✏️ Manual',
    }[location.source] || '📍';

    return (
      <div className="location-detector location-detector--active">
        <span className="location-source-label">{sourceLabel}</span>
        <span className="location-coords">
          {location.city ? location.city : `${location.lat.toFixed(3)}, ${location.lng.toFixed(3)}`}
        </span>
        <button className="btn-link" onClick={() => setShowManual(!showManual)}>Change</button>
        {showManual && (
          <div className="location-manual-form">
            <input
              type="text"
              placeholder="Search city or area…"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              style={{ width: '220px' }}
            />
            <button className="btn-primary-sm" onClick={detectLocation}>📍 Auto-detect</button>
            {searching && <span style={{ fontSize: '12px', color: '#6B7280' }}>Searching…</span>}
            {!searching && searchResults.length > 0 && (
              <div className="location-search-results">
                {searchResults.map((place) => (
                  <button key={`${place.lat}-${place.lng}`} className="location-search-item" onClick={() => handleSelectPlace(place)}>
                    📍 {place.displayName}
                  </button>
                ))}
              </div>
            )}
            {manualError && <p className="location-manual-error">{manualError}</p>}
          </div>
        )}
      </div>
    );
  }

  return null;
}
