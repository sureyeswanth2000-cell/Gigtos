import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LocationContext = createContext(null);

const STORAGE_KEY = 'gigtos_user_location';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      addr.state ||
      'Your Location';
    const state = addr.state || '';
    return { city, state, display: state ? `${city}, ${state}` : city };
  } catch {
    return null;
  }
}

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState('');

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    setDetecting(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const geo = await reverseGeocode(lat, lng);
        const loc = {
          lat,
          lng,
          city: geo?.city || 'Your Location',
          state: geo?.state || '',
          display: geo?.display || 'Your Location',
          radius: 20,
          source: 'gps',
        };
        setLocation(loc);
        // Only persist the city/display name, not coordinates
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          city: loc.city,
          state: loc.state,
          display: loc.display,
          radius: loc.radius,
          source: loc.source,
        }));
        setDetecting(false);
      },
      (err) => {
        setError(err.message || 'Location access denied');
        setDetecting(false);
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  const setManualLocation = useCallback((city, state, lat, lng) => {
    const loc = {
      lat: lat || null,
      lng: lng || null,
      city,
      state: state || '',
      display: state ? `${city}, ${state}` : city,
      radius: 20,
      source: 'manual',
    };
    setLocation(loc);
    // Only persist the city/display name, not coordinates
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      city: loc.city,
      state: loc.state,
      display: loc.display,
      radius: loc.radius,
      source: loc.source,
    }));
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!location) {
      detect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LocationContext.Provider
      value={{ location, detecting, error, detect, setManualLocation, clearLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}

export default LocationContext;
