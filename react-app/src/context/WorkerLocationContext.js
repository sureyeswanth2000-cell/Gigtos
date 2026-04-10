import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../firebase';
import { doc, setDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const WorkerLocationContext = createContext(null);

/**
 * Radius (in meters) within which the worker is considered "at the work location".
 */
const PROXIMITY_RADIUS_M = 200;

/**
 * Interval for persisting location updates to Firestore (ms).
 */
const PERSIST_INTERVAL_MS = 60_000;

/**
 * Calculate distance between two lat/lng points using the Haversine formula.
 * Returns distance in meters.
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * WorkerLocationProvider — tracks a worker's live GPS position while they are active.
 *
 * Features:
 * - Starts `watchPosition` when `startTracking(workLocation)` is called
 * - Stops when `stopTracking()` is called
 * - Detects when worker reaches the work location and records reach time
 * - Detects when worker leaves the work location and records left time
 * - If the worker stops sharing their location, marks status as "Location closed"
 * - Saves session data to Firestore: `worker_location_sessions/{docId}`
 */
export function WorkerLocationProvider({ children }) {
  const [tracking, setTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null); // { lat, lng }
  const [workLocation, setWorkLocation] = useState(null); // { lat, lng }
  const [isAtWorkLocation, setIsAtWorkLocation] = useState(false);
  const [reachTime, setReachTime] = useState(null);
  const [leftTime, setLeftTime] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | tracking | at_location | left_location | closed
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  const watchIdRef = useRef(null);
  const persistIntervalRef = useRef(null);
  const wasAtLocationRef = useRef(false);

  /**
   * Start continuous GPS tracking for the worker.
   * @param {{ lat: number, lng: number }} workLoc — the assigned work/booking location
   * @param {string} [bookingId] — optional booking reference
   */
  const startTracking = useCallback((workLoc, bookingId) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setError('You must be logged in to start tracking.');
      return;
    }

    setWorkLocation(workLoc || null);
    setTracking(true);
    setLocationStatus('tracking');
    setReachTime(null);
    setLeftTime(null);
    setIsAtWorkLocation(false);
    wasAtLocationRef.current = false;
    setError(null);

    // Create a new session document in Firestore
    const sessionData = {
      workerId: uid,
      bookingId: bookingId || null,
      workLocationLat: workLoc?.lat || null,
      workLocationLng: workLoc?.lng || null,
      reachTime: null,
      leftTime: null,
      durationMinutes: null,
      locationStatus: 'tracking',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDoc(collection(db, 'worker_location_sessions'), sessionData)
      .then((docRef) => {
        setSessionId(docRef.id);
      })
      .catch(() => {
        // Firestore write failed — continue tracking locally
      });

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentPosition({ lat, lng });
      },
      (err) => {
        // Worker denied or lost location access
        setLocationStatus('closed');
        setError('Location sharing stopped.');
        setTracking(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  /**
   * Stop tracking and finalise the session.
   */
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (persistIntervalRef.current) {
      clearInterval(persistIntervalRef.current);
      persistIntervalRef.current = null;
    }

    // If worker was at location and hadn't left yet, record left time now
    if (wasAtLocationRef.current && !leftTime) {
      const now = new Date();
      setLeftTime(now);
      setLocationStatus('left_location');

      if (sessionId) {
        const durationMs = reachTime ? now.getTime() - reachTime.getTime() : 0;
        updateDoc(doc(db, 'worker_location_sessions', sessionId), {
          leftTime: now,
          durationMinutes: Math.round(durationMs / 60000),
          locationStatus: 'left_location',
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
    } else if (sessionId) {
      // Worker stopped without reaching — mark as closed
      updateDoc(doc(db, 'worker_location_sessions', sessionId), {
        locationStatus: locationStatus === 'closed' ? 'closed' : 'stopped',
        updatedAt: serverTimestamp(),
      }).catch(() => { /* noop */ });
    }

    setTracking(false);
    if (locationStatus !== 'closed' && locationStatus !== 'left_location') {
      setLocationStatus('idle');
    }
    setWorkLocation(null);
    setCurrentPosition(null);
    setSessionId(null);
  }, [leftTime, reachTime, sessionId, locationStatus]);

  // Proximity check: detect reach/leave events
  useEffect(() => {
    if (!tracking || !currentPosition || !workLocation) return;

    const distance = haversineDistance(
      currentPosition.lat, currentPosition.lng,
      workLocation.lat, workLocation.lng
    );

    const withinRadius = distance <= PROXIMITY_RADIUS_M;

    if (withinRadius && !wasAtLocationRef.current) {
      // Worker just arrived
      const now = new Date();
      wasAtLocationRef.current = true;
      setIsAtWorkLocation(true);
      setReachTime(now);
      setLocationStatus('at_location');

      if (sessionId) {
        updateDoc(doc(db, 'worker_location_sessions', sessionId), {
          reachTime: now,
          locationStatus: 'at_location',
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
    } else if (!withinRadius && wasAtLocationRef.current) {
      // Worker just left
      const now = new Date();
      wasAtLocationRef.current = false;
      setIsAtWorkLocation(false);
      setLeftTime(now);
      setLocationStatus('left_location');

      if (sessionId) {
        const durationMs = reachTime ? now.getTime() - reachTime.getTime() : 0;
        updateDoc(doc(db, 'worker_location_sessions', sessionId), {
          leftTime: now,
          durationMinutes: Math.round(durationMs / 60000),
          locationStatus: 'left_location',
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
    }
  }, [currentPosition, tracking, workLocation, sessionId, reachTime]);

  // Periodic persist of current position
  useEffect(() => {
    if (!tracking || !sessionId) return;
    persistIntervalRef.current = setInterval(() => {
      if (currentPosition && sessionId) {
        updateDoc(doc(db, 'worker_location_sessions', sessionId), {
          lastLat: currentPosition.lat,
          lastLng: currentPosition.lng,
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
    }, PERSIST_INTERVAL_MS);

    return () => {
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
        persistIntervalRef.current = null;
      }
    };
  }, [tracking, sessionId, currentPosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
      }
    };
  }, []);

  return (
    <WorkerLocationContext.Provider
      value={{
        tracking,
        currentPosition,
        workLocation,
        isAtWorkLocation,
        reachTime,
        leftTime,
        locationStatus,
        error,
        startTracking,
        stopTracking,
      }}
    >
      {children}
    </WorkerLocationContext.Provider>
  );
}

/**
 * Hook to access worker location tracking context.
 */
export function useWorkerLocation() {
  return useContext(WorkerLocationContext);
}
