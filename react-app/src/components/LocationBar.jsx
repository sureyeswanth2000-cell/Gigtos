import React from 'react';
import { useLocation } from '../context/LocationContext';

/**
 * LocationBar – persistent bar below the header showing the user's city
 * with a detect-location button. No lat/lng displayed.
 * Location editing is done via the Profile page.
 */
export default function LocationBar() {
  const { location, locationLoading, locationError, detectLocation } = useLocation();

  const cityLabel = location?.city || null;

  return (
    <div className="location-bar">
      <div className="location-bar-inner">
        {locationLoading ? (
          <span className="location-bar-detecting">
            <span className="location-bar-dot">📍</span> Detecting location…
          </span>
        ) : locationError && !location ? (
          <span className="location-bar-error">
            ⚠️ Location unavailable
            <button className="location-bar-btn" onClick={detectLocation}>📍 Detect Location</button>
          </span>
        ) : (
          <>
            {cityLabel && (
              <span className="location-bar-city">
                <span className="location-bar-dot">📍</span>
                <span className="location-bar-name">{cityLabel}</span>
              </span>
            )}
            <button className="location-bar-btn" onClick={detectLocation} title="Detect my current location">
              📍 Detect Location
            </button>
          </>
        )}
      </div>
    </div>
  );
}
