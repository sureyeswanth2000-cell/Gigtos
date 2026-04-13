import React, { useState, useRef } from 'react';
import { ref as dbRef, set } from 'firebase/database';
import { rtdb } from '../../firebase';

/**
 * StartTravelButton – Worker triggers live GPS updates to RTDB for a booking.
 * Props:
 *   bookingId – Firestore booking ID
 *   workerId – Auth UID of worker
 */
export default function StartTravelButton({ bookingId, workerId }) {
  const [tracking, setTracking] = useState(false);
  const intervalRef = useRef(null);

  const sendLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      set(dbRef(rtdb, `/active_tracking/${bookingId}`), {
        lat: latitude,
        lng: longitude,
        workerId,
        timestamp: Date.now(),
      });
    });
  };

  const startTracking = () => {
    setTracking(true);
    sendLocation();
    intervalRef.current = setInterval(sendLocation, 15000); // every 15s
  };

  const stopTracking = () => {
    setTracking(false);
    clearInterval(intervalRef.current);
  };

  return tracking ? (
    <button className="btn-danger" onClick={stopTracking}>Stop Travel</button>
  ) : (
    <button className="btn-primary" onClick={startTracking}>Start Travel</button>
  );
}
