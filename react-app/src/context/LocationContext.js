import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const LocationContext = createContext(null);

/**
 * Default radius for worker availability checks (km).
 */
export const DEFAULT_RADIUS_KM = 20;

/**
 * localStorage key for cached user location (used for unauthenticated browsing).
 */
const LS_LOCATION_KEY = 'gigtos_user_location';

/**
 * Reverse-geocode lat/lng to a city name using OpenStreetMap Nominatim.
 * Returns the city/town/village name or null.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Gigtos/1.0' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || null;
    const displayName = data.display_name || null;
    return { city, displayName };
  } catch {
    return { city: null, displayName: null };
  }
}

/**
 * Forward-geocode a city/place name to lat/lng using OpenStreetMap Nominatim.
 * Returns { lat, lng, city } or null.
 */
export async function geocodeCity(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'Gigtos/1.0' } }
    );
    const results = await res.json();
    if (results.length === 0) return null;
    return results.map((r) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      city: r.address?.city || r.address?.town || r.address?.village || r.display_name?.split(',')[0] || query,
      displayName: r.display_name,
    }));
  } catch {
    return null;
  }
}

/**
 * Detect current GPS location with GeoIP fallback.
 * Returns a promise that resolves to { lat, lng, city, source } or rejects.
 */
export function detectCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const { city, displayName } = await reverseGeocode(lat, lng);
        resolve({ lat, lng, city, displayName, source: 'gps' });
      },
      () => {
        // Fallback: try GeoIP
        fetch('https://ipapi.co/json/')
          .then((res) => res.json())
          .then((data) => {
            if (data.latitude && data.longitude) {
              resolve({
                lat: data.latitude,
                lng: data.longitude,
                city: data.city,
                source: 'geoip',
              });
            } else {
              reject(new Error('Could not determine your location automatically.'));
            }
          })
          .catch(() => {
            reject(new Error('Could not determine your location automatically.'));
          });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  });
}

/**
 * Provides user location state and geo-filtering utilities.
 *
 * Behaviour:
 * - **Logged-in user/worker**: Loads saved location from Firestore (`users/{uid}` or
 *   `worker_auth/{uid}`). No auto-detection on every page load.
 * - **Unauthenticated visitor**: Auto-detects once via GPS / GeoIP (current behaviour)
 *   so that the homepage can show local services.
 */
export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null); // { lat, lng, city?, source }
  const [locationError, setLocationError] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const authChecked = useRef(false);

  /**
   * One-shot detect via GPS / GeoIP. Used for unauthenticated visitors or
   * when the user explicitly presses the detect button.
   */
  const detectLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError(null);

    detectCurrentLocation()
      .then((loc) => {
        setLocation(loc);
        // Cache in localStorage so unauthenticated visitors don't re-detect each page load
        try { localStorage.setItem(LS_LOCATION_KEY, JSON.stringify(loc)); } catch { /* noop */ }
      })
      .catch((err) => {
        setLocationError(err.message || 'Could not determine your location automatically.');
      })
      .finally(() => {
        setLocationLoading(false);
      });
  }, []);

  // On mount, check auth state and decide how to load location.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (authChecked.current) return; // Only run once
      authChecked.current = true;

      if (currentUser) {
        // Try loading saved location from Firestore
        try {
          // Check user doc first, then worker_auth doc
          let savedLoc = null;
          const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.locationLat && data.locationLng) {
              savedLoc = {
                lat: data.locationLat,
                lng: data.locationLng,
                city: data.locationCity || null,
                source: 'saved',
              };
            }
          }

          if (!savedLoc) {
            const workerSnap = await getDoc(doc(db, 'worker_auth', currentUser.uid));
            if (workerSnap.exists()) {
              const data = workerSnap.data();
              if (data.locationLat && data.locationLng) {
                savedLoc = {
                  lat: data.locationLat,
                  lng: data.locationLng,
                  city: data.locationCity || null,
                  source: 'saved',
                };
              }
            }
          }

          if (savedLoc) {
            setLocation(savedLoc);
            setLocationLoading(false);
            return;
          }
        } catch {
          // Firestore read failed — fall through to auto-detect
        }

        // No saved location — detect once (first login before location was saved)
        detectLocation();
      } else {
        // Unauthenticated — try cached localStorage first, then auto-detect
        try {
          const cached = localStorage.getItem(LS_LOCATION_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && parsed.lat && parsed.lng) {
              setLocation({ ...parsed, source: parsed.source || 'cached' });
              setLocationLoading(false);
              return;
            }
          }
        } catch { /* noop */ }

        detectLocation();
      }
    });

    return () => unsubscribe();
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
