import React, { useEffect, useRef, useState } from 'react';
import { ref as dbRef, onValue } from 'firebase/database';
import { rtdb } from '../firebase';

/**
 * TrackingMap – Shows worker's live location and route to consumer address.
 * Props:
 *   bookingId – Firestore booking ID
 *   consumerLat, consumerLng – Consumer's address coordinates
 */
export default function TrackingMap({ bookingId, consumerLat, consumerLng }) {
  const [workerLoc, setWorkerLoc] = useState(null);
  const [leafletReady, setLeafletReady] = useState(!!window.L);
  const [eta, setEta] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayer = useRef(null);

  // Load Leaflet if needed
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  // Subscribe to worker's live location
  useEffect(() => {
    if (!bookingId) return;
    const unsub = onValue(dbRef(rtdb, `/active_tracking/${bookingId}`), (snap) => {
      setWorkerLoc(snap.val());
    });
    return () => unsub();
  }, [bookingId]);

  // Calculate ETA (straight-line, Haversine, assume 30km/h)
  useEffect(() => {
    if (!workerLoc || !consumerLat || !consumerLng) { setEta(null); return; }
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(consumerLat - workerLoc.lat);
    const dLng = toRad(consumerLng - workerLoc.lng);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(workerLoc.lat)) * Math.cos(toRad(consumerLat)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    const speedKmh = 30; // Assume 30 km/h urban
    const etaMin = Math.round((distanceKm / speedKmh) * 60);
    setEta(etaMin);
  }, [workerLoc, consumerLat, consumerLng]);

  // Draw map and route
  useEffect(() => {
    if (!leafletReady || !mapRef.current || !workerLoc || !consumerLat || !consumerLng) return;
    const L = window.L;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, { center: [workerLoc.lat, workerLoc.lng], zoom: 14 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(mapInstance.current);
    }
    const map = mapInstance.current;
    map.setView([workerLoc.lat, workerLoc.lng], 14);
    if (routeLayer.current) { map.removeLayer(routeLayer.current); }
    // Draw route line (straight, for demo; use Directions API for real route)
    routeLayer.current = L.polyline([[workerLoc.lat, workerLoc.lng], [consumerLat, consumerLng]], { color: '#A259FF', weight: 5, opacity: 0.7 }).addTo(map);
    // Worker marker
    L.marker([workerLoc.lat, workerLoc.lng], { icon: L.divIcon({ html: '<div style="background:#A259FF;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;">👷</div>', iconSize: [32,32], iconAnchor: [16,16] }) }).addTo(map);
    // Consumer marker
    L.marker([consumerLat, consumerLng], { icon: L.divIcon({ html: '<div style="background:#F59E0B;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;">🏠</div>', iconSize: [32,32], iconAnchor: [16,16] }) }).addTo(map);
  }, [leafletReady, workerLoc, consumerLat, consumerLng]);

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: 320, borderRadius: 16, marginBottom: 12, background: '#eee' }} />
      {workerLoc && (
        <>
          <div style={{ fontWeight: 700, color: '#A259FF' }}>
            Worker is en route. Last update: {new Date(workerLoc.timestamp).toLocaleTimeString()}
          </div>
          {eta !== null && (
            <div style={{ color: '#444', marginTop: 4 }}>
              Estimated Arrival: <strong>{eta} min{eta === 1 ? '' : 's'}</strong>
            </div>
          )}
        </>
      )}
      {!workerLoc && <div style={{ color: 'var(--text-muted)' }}>Waiting for worker to start travel…</div>}
    </div>
  );
}
