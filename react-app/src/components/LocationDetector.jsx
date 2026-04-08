import React, { useState } from 'react';
import { useLocation } from '../context/LocationContext';

/**
 * Renders a small banner showing the user's current location detection status.
 * If location is unavailable, shows an address input so the user can enter
 * their location manually.
 */
export default function LocationDetector() {
  const { location, locationError, locationLoading, setManualLocation } = useLocation();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [inputError, setInputError] = useState('');

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setInputError('Please enter valid latitude and longitude values.');
      return;
    }
    setInputError('');
    setManualLocation(parsedLat, parsedLng);
  };

  if (locationLoading) {
    return (
      <div className="location-banner location-loading">
        📍 Detecting your location…
      </div>
    );
  }

  if (location) {
    const sourceLabel = {
      browser: 'GPS',
      geoip: 'IP address',
      manual: 'manual input',
    }[location.source] || location.source;

    return (
      <div className="location-banner location-found">
        📍 Location detected via {sourceLabel} — showing jobs within 20 km
      </div>
    );
  }

  // No location and no loading — show manual fallback
  return (
    <div className="location-banner location-error">
      <p>⚠️ {locationError || 'Could not detect your location.'}</p>
      <p>Enter your coordinates to see nearby jobs:</p>
      <form className="location-form" onSubmit={handleManualSubmit}>
        <input
          type="number"
          step="any"
          placeholder="Latitude (e.g. 14.9090)"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          aria-label="Latitude"
        />
        <input
          type="number"
          step="any"
          placeholder="Longitude (e.g. 79.9868)"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          aria-label="Longitude"
        />
        <button type="submit" className="primary-btn">Set Location</button>
      </form>
      {inputError && <p className="location-input-error">{inputError}</p>}
    </div>
  );
}
