import React, { useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functionsInstance } from '../../firebase';

const EXACT_LOCATION_RETENTION_MS = 4 * 60 * 60 * 1000;
const updateWorkerTravelLocation = httpsCallable(functionsInstance, 'updateWorkerTravelLocation');

function exactLocationExpiresAt() {
  return new Date(Date.now() + EXACT_LOCATION_RETENTION_MS);
}

/**
 * Legacy-compatible start travel button.
 * New dashboard flow uses WorkerLocationContext; this component writes the same
 * booking_live_tracking contract when used elsewhere.
 */
export default function StartTravelButton({ bookingId, workerId }) {
  const [tracking, setTracking] = useState(false);
  const intervalRef = useRef(null);

  const sendLocation = () => {
    if (!navigator.geolocation || !bookingId || !workerId) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude, accuracy, speed, heading } = pos.coords;
      updateWorkerTravelLocation({
        bookingId,
        lat: latitude,
        lng: longitude,
        accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
        speedMps: Number.isFinite(speed) ? Number(speed) : null,
        heading: Number.isFinite(heading) ? Number(heading) : null,
        timestampMs: pos.timestamp || Date.now(),
        locationStatus: 'tracking',
      }).catch(() => setDoc(doc(db, 'booking_live_tracking', bookingId), {
        bookingId,
        workerId,
        lat: latitude,
        lng: longitude,
        accuracyM: Number.isFinite(accuracy) ? Math.round(accuracy) : null,
        speedMps: Number.isFinite(speed) ? Number(speed) : null,
        heading: Number.isFinite(heading) ? Number(heading) : null,
        routeStatus: 'en_route',
        locationStatus: 'tracking',
        etaSource: 'haversine_fallback',
        isActive: true,
        timestampMs: pos.timestamp || Date.now(),
        retentionClass: 'active_job_exact_location',
        exactLocationExpiresAt: exactLocationExpiresAt(),
        lastLocationAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true })).catch(() => {});
    });
  };

  const startTracking = () => {
    setTracking(true);
    sendLocation();
    intervalRef.current = setInterval(sendLocation, 5000);
  };

  const stopTracking = () => {
    setTracking(false);
    clearInterval(intervalRef.current);
    if (bookingId && workerId) {
      setDoc(doc(db, 'booking_live_tracking', bookingId), {
        bookingId,
        workerId,
        routeStatus: 'stopped',
        locationStatus: 'stopped',
        isActive: false,
        stoppedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  return tracking ? (
    <button className="btn-danger" onClick={stopTracking}>Stop Travel</button>
  ) : (
    <button className="btn-primary" onClick={startTracking}>Start Travel</button>
  );
}
