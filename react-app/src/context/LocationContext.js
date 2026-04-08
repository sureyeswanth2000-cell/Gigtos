import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null); // { lat, lng }
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [addressInput, setAddressInput] = useState('');

  const detectLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationLoading(false);
        },
        () => {
          // Fallback: try GeoIP-based location
          tryGeoIPFallback();
        },
        { timeout: 8000 }
      );
    } else {
      tryGeoIPFallback();
    }
  }, []);

  const tryGeoIPFallback = () => {
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        if (data.latitude && data.longitude) {
          setLocation({ lat: data.latitude, lng: data.longitude });
        } else {
          setLocationError('Could not detect location automatically. Please enter your address.');
        }
        setLocationLoading(false);
      })
      .catch(() => {
        setLocationError('Could not detect location automatically. Please enter your address.');
        setLocationLoading(false);
      });
  };

  const setManualLocation = useCallback((lat, lng) => {
    setLocation({ lat, lng });
    setLocationError(null);
  }, []);

  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  return (
    <LocationContext.Provider
      value={{
        location,
        locationError,
        locationLoading,
        addressInput,
        setAddressInput,
        detectLocation,
        setManualLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside LocationProvider');
  return ctx;
}
