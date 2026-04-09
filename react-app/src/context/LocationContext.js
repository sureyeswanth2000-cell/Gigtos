import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LocationContext = createContext(null);

/**
 * Default radius for worker availability checks (km).
 */
export const DEFAULT_RADIUS_KM = 20;

/**
 * Provides user location state and geo-filtering utilities.
 */
export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null); // { lat, lng, source }
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const detectLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          source: 'gps',
        });
        setLocationLoading(false);
      },
      () => {
        // Fallback: try GeoIP
        fetch('https://ipapi.co/json/')
          .then((res) => res.json())
          .then((data) => {
            if (data.latitude && data.longitude) {
              setLocation({
                lat: data.latitude,
                lng: data.longitude,
                city: data.city,
                source: 'geoip',
              });
            } else {
              setLocationError('Could not determine your location automatically.');
            }
          })
          .catch(() => {
            setLocationError('Could not determine your location automatically.');
          })
          .finally(() => {
            setLocationLoading(false);
          });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  /**
   * Manually set location from an address or map picker.
   * @param {{ lat: number, lng: number, city?: string }} coords
   */
  const setManualLocation = useCallback((coords) => {
    setLocation({ ...coords, source: 'manual' });
    setLocationError(null);
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        locationError,
        locationLoading,
        detectLocation,
        setManualLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Hook to access location context.
 */
export function useLocation() {
  return useContext(LocationContext);
}
