import React from 'react';
import { useLocation } from '../context/LocationContext';

/**
 * LocationBar – persistent bar below the header showing the user's city.
 * For logged-in users it displays the saved location from signup.
 * The detect button is available for manual re-detection when needed.
 */
export default function LocationBar() {
  const { location, locationLoading, locationError, detectLocation } = useLocation();

  const cityLabel = location?.city || null;
  const isSaved = location?.source === 'saved';

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
              <span className="location-bar-city" title={isSaved ? 'Saved location from signup' : 'Click to re-detect'}>
                <span className="location-bar-dot">📍</span>
                <span className="location-bar-name">{cityLabel}</span>
                {!isSaved && (
                  <span className="location-bar-arrow" onClick={detectLocation}>▼</span>
                )}
              </span>
            )}
            {!cityLabel && (
              <button className="location-bar-btn" onClick={detectLocation} title="Detect my current location">
                📍 Detect Location
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
