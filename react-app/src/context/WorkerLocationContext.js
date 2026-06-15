import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth, db, functionsInstance } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

const WorkerLocationContext = createContext(null);

/**
 * Radius (in meters) within which the worker is considered "at the work location".
 */
const PROXIMITY_RADIUS_M = 200;

/**
 * Interval for persisting location updates to Firestore (ms).
 * Active bookings update faster because the consumer is watching ETA live.
 */
const ACTIVE_BOOKING_PERSIST_INTERVAL_MS = 5_000;
const OPEN_WORK_PERSIST_INTERVAL_MS = 30_000;
const EXACT_LOCATION_RETENTION_MS = 4 * 60 * 60 * 1000;
const updateWorkerTravelLocation = httpsCallable(functionsInstance, 'updateWorkerTravelLocation');

function exactLocationExpiresAt() {
  return new Date(Date.now() + EXACT_LOCATION_RETENTION_MS);
}

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
  const trackingUidRef = useRef(null);
  const bookingIdRef = useRef(null);
  const lastPositionMetaRef = useRef({});
  const trackingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const reachTimeRef = useRef(null);
  const leftTimeRef = useRef(null);
  const locationStatusRef = useRef('idle');
  const currentPositionRef = useRef(null);
  const workLocationRef = useRef(null);

  useEffect(() => { trackingRef.current = tracking; }, [tracking]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { reachTimeRef.current = reachTime; }, [reachTime]);
  useEffect(() => { leftTimeRef.current = leftTime; }, [leftTime]);
  useEffect(() => { locationStatusRef.current = locationStatus; }, [locationStatus]);
  useEffect(() => { currentPositionRef.current = currentPosition; }, [currentPosition]);
  useEffect(() => { workLocationRef.current = workLocation; }, [workLocation]);

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
    workLocationRef.current = workLoc || null;
    setTracking(true);
    trackingRef.current = true;
    setLocationStatus('tracking');
    locationStatusRef.current = 'tracking';
    setReachTime(null);
    reachTimeRef.current = null;
    setLeftTime(null);
    leftTimeRef.current = null;
    setSessionId(null);
    sessionIdRef.current = null;
    setCurrentPosition(null);
    currentPositionRef.current = null;
    setIsAtWorkLocation(false);
    wasAtLocationRef.current = false;
    trackingUidRef.current = uid;
    bookingIdRef.current = bookingId || null;
    setError(null);

    // Create a new session document in Firestore
    const sessionData = {
      workerId: uid,
      bookingId: bookingId || null,
      reachTime: null,
      leftTime: null,
      durationMinutes: null,
      locationStatus: 'tracking',
      retentionClass: 'summary_only',
      lastLocationAt: null,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDoc(collection(db, 'worker_location_sessions'), sessionData)
      .then((docRef) => {
        setSessionId(docRef.id);
        sessionIdRef.current = docRef.id;
      })
      .catch(() => {
        // Firestore write failed — continue tracking locally
      });

    // Create live location doc — deleted when worker goes inactive
    setDoc(doc(db, 'worker_live_locations', uid), {
      workerId: uid,
      lat: null,
      lng: null,
      isActive: true,
      bookingId: bookingId || null,
      locationStatus: 'tracking',
      retentionClass: 'active_live_location',
      expiresAt: exactLocationExpiresAt(),
      activeSince: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => { /* noop */ });

    if (bookingId) {
      setDoc(doc(db, 'booking_live_tracking', bookingId), {
        bookingId,
        workerId: uid,
        lat: null,
        lng: null,
        accuracyM: null,
        speedMps: null,
        heading: null,
        distanceRemainingKm: null,
        etaMinutes: null,
        etaSource: 'waiting_for_location',
        routeStatus: 'tracking',
        locationStatus: 'tracking',
        isActive: true,
        retentionClass: 'active_job_exact_location',
        exactLocationExpiresAt: exactLocationExpiresAt(),
        startedAt: serverTimestamp(),
        lastLocationAt: null,
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => { /* noop */ });
    }

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        lastPositionMetaRef.current = {
          accuracyM: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
          speedMps: Number.isFinite(pos.coords.speed) ? Number(pos.coords.speed) : null,
          heading: Number.isFinite(pos.coords.heading) ? Number(pos.coords.heading) : null,
          timestampMs: pos.timestamp || Date.now(),
        };
        const nextPosition = { lat, lng };
        currentPositionRef.current = nextPosition;
        setCurrentPosition(nextPosition);
      },
      (err) => {
        // Worker denied or lost location access
        setLocationStatus('closed');
        locationStatusRef.current = 'closed';
        setError('Location sharing stopped.');
        setTracking(false);
        trackingRef.current = false;
        // Clean up live location on location error
        const currentUid = auth.currentUser?.uid;
        if (currentUid) {
          deleteDoc(doc(db, 'worker_live_locations', currentUid)).catch(() => {});
          const activeBookingId = bookingIdRef.current;
          if (activeBookingId) {
            setDoc(doc(db, 'booking_live_tracking', activeBookingId), {
              locationStatus: 'closed',
              routeStatus: 'location_closed',
              isActive: false,
              updatedAt: serverTimestamp(),
            }, { merge: true }).catch(() => {});
          }
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  /**
   * Stop tracking and finalise the session.
   * Deletes live location data (worker_live_locations) but preserves
   * work history sessions (worker_location_sessions) for historical records.
   */
  const stopTracking = useCallback((options = {}) => {
    const { updateState = true } = options;
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (persistIntervalRef.current) {
      clearInterval(persistIntervalRef.current);
      persistIntervalRef.current = null;
    }

    const activeSessionId = sessionIdRef.current;
    const activeReachTime = reachTimeRef.current;
    const activeLeftTime = leftTimeRef.current;
    const activeLocationStatus = locationStatusRef.current;

    // If worker was at location and hadn't left yet, record left time now
    if (wasAtLocationRef.current && !activeLeftTime) {
      const now = new Date();
      leftTimeRef.current = now;
      locationStatusRef.current = 'left_location';
      if (updateState) {
        setLeftTime(now);
        setLocationStatus('left_location');
      }

      if (activeSessionId) {
        const durationMs = activeReachTime ? now.getTime() - activeReachTime.getTime() : 0;
        updateDoc(doc(db, 'worker_location_sessions', activeSessionId), {
          leftTime: now,
          durationMinutes: Math.round(durationMs / 60000),
          locationStatus: 'left_location',
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
    } else if (activeSessionId) {
      // Worker stopped without reaching — mark as closed
      updateDoc(doc(db, 'worker_location_sessions', activeSessionId), {
        locationStatus: activeLocationStatus === 'closed' ? 'closed' : 'stopped',
        updatedAt: serverTimestamp(),
      }).catch(() => { /* noop */ });
    }

    // Delete live location data — only keep work history sessions
    const uid = trackingUidRef.current || auth.currentUser?.uid;
    if (uid) {
      deleteDoc(doc(db, 'worker_live_locations', uid)).catch(() => { /* noop */ });
    }
    const activeBookingId = bookingIdRef.current;
    if (activeBookingId) {
      setDoc(doc(db, 'booking_live_tracking', activeBookingId), {
        locationStatus: activeLocationStatus === 'closed' ? 'closed' : 'stopped',
        routeStatus: activeLocationStatus === 'closed' ? 'location_closed' : 'stopped',
        isActive: false,
        stoppedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => { /* noop */ });
    }

    trackingRef.current = false;
    sessionIdRef.current = null;
    currentPositionRef.current = null;
    workLocationRef.current = null;
    bookingIdRef.current = null;
    if (updateState) {
      setTracking(false);
      if (activeLocationStatus !== 'closed' && activeLocationStatus !== 'left_location') {
        setLocationStatus('idle');
        locationStatusRef.current = 'idle';
      }
      setWorkLocation(null);
      setCurrentPosition(null);
      setSessionId(null);
    }
  }, []);

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
      reachTimeRef.current = now;
      setLocationStatus('at_location');
      locationStatusRef.current = 'at_location';

      if (sessionId) {
        updateDoc(doc(db, 'worker_location_sessions', sessionId), {
          reachTime: now,
          locationStatus: 'at_location',
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
      const activeBookingId = bookingIdRef.current;
      if (activeBookingId) {
        setDoc(doc(db, 'booking_live_tracking', activeBookingId), {
          locationStatus: 'at_location',
          routeStatus: 'arrived',
          reachedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => { /* noop */ });
      }
    } else if (!withinRadius && wasAtLocationRef.current) {
      // Worker just left
      const now = new Date();
      wasAtLocationRef.current = false;
      setIsAtWorkLocation(false);
      setLeftTime(now);
      leftTimeRef.current = now;
      setLocationStatus('left_location');
      locationStatusRef.current = 'left_location';

      if (sessionId) {
        const durationMs = reachTime ? now.getTime() - reachTime.getTime() : 0;
        updateDoc(doc(db, 'worker_location_sessions', sessionId), {
          leftTime: now,
          durationMinutes: Math.round(durationMs / 60000),
          locationStatus: 'left_location',
          updatedAt: serverTimestamp(),
        }).catch(() => { /* noop */ });
      }
      const activeBookingId = bookingIdRef.current;
      if (activeBookingId) {
        setDoc(doc(db, 'booking_live_tracking', activeBookingId), {
          locationStatus: 'left_location',
          routeStatus: 'left_location',
          leftAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => { /* noop */ });
      }
    }
  }, [currentPosition, tracking, workLocation, sessionId, reachTime]);

  // Periodic persist of current position to session and live location
  useEffect(() => {
    if (!tracking) return;
    const persistIntervalMs = bookingIdRef.current
      ? ACTIVE_BOOKING_PERSIST_INTERVAL_MS
      : OPEN_WORK_PERSIST_INTERVAL_MS;
    persistIntervalRef.current = setInterval(() => {
      const latestPosition = currentPositionRef.current;
      const latestWorkLocation = workLocationRef.current;
      const latestLocationStatus = locationStatusRef.current;
      if (latestPosition) {
        const uid = auth.currentUser?.uid;
        const activeBookingId = bookingIdRef.current;
        const meta = lastPositionMetaRef.current || {};
        const distanceRemainingKm = latestWorkLocation
          ? Math.round((haversineDistance(
              latestPosition.lat,
              latestPosition.lng,
              latestWorkLocation.lat,
              latestWorkLocation.lng
            ) / 1000) * 10) / 10
          : null;
        const etaMinutes = distanceRemainingKm !== null
          ? Math.max(1, Math.round((distanceRemainingKm / 25) * 60))
          : null;
        // Update session document
        if (sessionId) {
          updateDoc(doc(db, 'worker_location_sessions', sessionId), {
            lastLocationAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => { /* noop */ });
        }
        // Update live location (for nearby worker discovery)
        if (uid) {
          setDoc(doc(db, 'worker_live_locations', uid), {
            workerId: uid,
            lat: latestPosition.lat,
            lng: latestPosition.lng,
            isActive: true,
            bookingId: activeBookingId || null,
            locationStatus: latestLocationStatus,
            accuracyM: meta.accuracyM ?? null,
            speedMps: meta.speedMps ?? null,
            heading: meta.heading ?? null,
            timestampMs: meta.timestampMs || Date.now(),
            retentionClass: 'active_live_location',
            expiresAt: exactLocationExpiresAt(),
            lastLocationAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(() => { /* noop */ });
        }
        if (activeBookingId) {
          updateWorkerTravelLocation({
            bookingId: activeBookingId,
            lat: latestPosition.lat,
            lng: latestPosition.lng,
            accuracyM: meta.accuracyM ?? null,
            speedMps: meta.speedMps ?? null,
            heading: meta.heading ?? null,
            timestampMs: meta.timestampMs || Date.now(),
            locationStatus: latestLocationStatus,
          }).catch(() => setDoc(doc(db, 'booking_live_tracking', activeBookingId), {
            bookingId: activeBookingId,
            workerId: uid,
            lat: latestPosition.lat,
            lng: latestPosition.lng,
            accuracyM: meta.accuracyM ?? null,
            speedMps: meta.speedMps ?? null,
            heading: meta.heading ?? null,
            distanceRemainingKm,
            etaMinutes,
            etaSource: distanceRemainingKm !== null ? 'haversine_fallback' : 'waiting_for_destination',
            routeStatus: distanceRemainingKm !== null && distanceRemainingKm <= 0.2 ? 'arrived' : 'en_route',
            locationStatus: latestLocationStatus,
            isActive: true,
            timestampMs: meta.timestampMs || Date.now(),
            retentionClass: 'active_job_exact_location',
            exactLocationExpiresAt: exactLocationExpiresAt(),
            lastLocationAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true })).catch(() => { /* noop */ });
        }
      }
    }, persistIntervalMs);

    return () => {
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current);
        persistIntervalRef.current = null;
      }
    };
  }, [tracking, sessionId]);

  // Cleanup on unmount — delete live location to avoid stale data
  useEffect(() => {
    return () => {
      stopTracking({ updateState: false });
    };
  }, [stopTracking]);

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
