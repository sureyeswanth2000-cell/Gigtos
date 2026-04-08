import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LocationContext = createContext(null);

/**
 * Provides the user's geolocation (lat/lng) and related state to the whole app.
 * - Tries the browser Geolocation API first.
 * - Falls back to a GeoIP lookup (ip-api.com) if denied/unavailable.
 * - Exposes a `setManualLocation` helper so users can type an address instead.
 */
export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null); // { lat, lng, source }
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const setManualLocation = useCallback((lat, lng) => {
    setLocation({ lat: parseFloat(lat), lng: parseFloat(lng), source: 'manual' });
    setLocationError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchGeoIP() {
      try {
        const res = await fetch('https://ip-api.com/json/?fields=lat,lon,status');
        const data = await res.json();
        if (!cancelled && data.status === 'success') {
          setLocation({ lat: data.lat, lng: data.lon, source: 'geoip' });
        } else if (!cancelled) {
          setLocationError('Unable to detect location automatically.');
        }
      } catch {
        if (!cancelled) {
          setLocationError('Unable to detect location automatically.');
        }
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!cancelled) {
            setLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              source: 'browser',
            });
            setLocationLoading(false);
          }
        },
        () => {
          // Permission denied or unavailable — fall back to GeoIP
          fetchGeoIP();
        },
        { timeout: 8000 },
      );
    } else {
      fetchGeoIP();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{ location, locationError, locationLoading, setManualLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Hook to consume the location context.
 * @returns {{ location, locationError, locationLoading, setManualLocation }}
 */
export function useLocation() {
  return useContext(LocationContext);
}

export default LocationContext;
