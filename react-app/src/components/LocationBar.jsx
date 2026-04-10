import React from 'react';
import { useLocation } from '../context/LocationContext';

/**
 * Clean inline SVG location pin icon – renders consistently across all platforms.
 */
function LocationIcon({ size = 16, className = '' }) {
  return (
    <svg
      className={`location-bar-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
            <LocationIcon size={14} className="location-bar-dot" /> Detecting location…
          </span>
        ) : locationError && !location ? (
          <span className="location-bar-error">
            <span className="location-bar-error-text">Location unavailable</span>
            <button className="location-bar-btn" onClick={detectLocation}>
              <LocationIcon size={14} /> Detect Location
            </button>
          </span>
        ) : (
          <>
            {cityLabel && (
              <span className="location-bar-city" title={isSaved ? 'Saved location from signup' : 'Click to re-detect'}>
                <LocationIcon size={14} className="location-bar-dot" />
                <span className="location-bar-name">{cityLabel}</span>
                {!isSaved && (
                  <span className="location-bar-arrow" onClick={detectLocation}>▼</span>
                )}
              </span>
            )}
            {!cityLabel && (
              <button className="location-bar-btn" onClick={detectLocation} title="Detect my current location">
                <LocationIcon size={14} /> Detect Location
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
