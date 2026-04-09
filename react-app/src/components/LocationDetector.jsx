import React, { useState } from 'react';
import { useLocation } from '../context/LocationContext';

/**
 * LocationDetector – shows the user's detected location and allows manual override.
 */
export default function LocationDetector() {
  const { location, locationError, locationLoading, detectLocation, setManualLocation } = useLocation();
  const [showManual, setShowManual] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [manualError, setManualError] = useState('');

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      setManualError('Please enter valid latitude and longitude values.');
      return;
    }
    setManualLocation({ lat: latNum, lng: lngNum });
    setShowManual(false);
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
          <form className="location-manual-form" onSubmit={handleManualSubmit}>
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
            {manualError && <p className="location-manual-error">{manualError}</p>}
            <button type="submit" className="btn-primary-sm">Set Location</button>
          </form>
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
          <form className="location-manual-form" onSubmit={handleManualSubmit}>
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              required
            />
            {manualError && <p className="location-manual-error">{manualError}</p>}
            <button type="submit" className="btn-primary-sm">Update</button>
          </form>
        )}
      </div>
    );
  }

  return null;
}
