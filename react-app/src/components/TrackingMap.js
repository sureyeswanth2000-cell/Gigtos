import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * TrackingMap shows the worker's live Firestore location for one accepted booking.
 * Backend route ETA uses Google Maps when configured and falls back to an
 * approximate straight-line ETA when Maps is unavailable.
 */
export default function TrackingMap({ bookingId, consumerLat, consumerLng }) {
  const [workerLoc, setWorkerLoc] = useState(null);
  const [leafletReady, setLeafletReady] = useState(!!window.L);
  const [fallbackEta, setFallbackEta] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const routeLayer = useRef(null);
  const workerMarkerRef = useRef(null);
  const consumerMarkerRef = useRef(null);

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

  useEffect(() => {
    if (!bookingId) return undefined;
    return onSnapshot(doc(db, 'booking_live_tracking', bookingId), (snap) => {
      setWorkerLoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [bookingId]);

  useEffect(() => {
    if (!workerLoc?.lat || !workerLoc?.lng || !consumerLat || !consumerLng) {
      setFallbackEta(null);
      return;
    }
    const toRad = deg => deg * Math.PI / 180;
    const radiusKm = 6371;
    const dLat = toRad(consumerLat - workerLoc.lat);
    const dLng = toRad(consumerLng - workerLoc.lng);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(workerLoc.lat)) * Math.cos(toRad(consumerLat)) *
      Math.sin(dLng / 2) ** 2;
    const distanceKm = radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    setFallbackEta(Math.max(1, Math.round((distanceKm / 25) * 60)));
  }, [workerLoc, consumerLat, consumerLng]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !workerLoc?.lat || !workerLoc?.lng || !consumerLat || !consumerLng) return;
    const L = window.L;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, { center: [workerLoc.lat, workerLoc.lng], zoom: 14 });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: 'OpenStreetMap contributors' }).addTo(mapInstance.current);
    }

    const map = mapInstance.current;
    map.setView([workerLoc.lat, workerLoc.lng], 14);
    [routeLayer, workerMarkerRef, consumerMarkerRef].forEach((layerRef) => {
      if (layerRef.current) map.removeLayer(layerRef.current);
    });

    routeLayer.current = L.polyline(
      [[workerLoc.lat, workerLoc.lng], [consumerLat, consumerLng]],
      { color: '#7C3AED', weight: 5, opacity: 0.7 }
    ).addTo(map);
    workerMarkerRef.current = L.marker([workerLoc.lat, workerLoc.lng], {
      icon: L.divIcon({
        html: '<div style="background:#7C3AED;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid white;">W</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).addTo(map);
    consumerMarkerRef.current = L.marker([consumerLat, consumerLng], {
      icon: L.divIcon({
        html: '<div style="background:#F59E0B;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid white;">H</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    }).addTo(map);
  }, [leafletReady, workerLoc, consumerLat, consumerLng]);

  const lastUpdateMs = Number(workerLoc?.timestampMs || 0);
  const lastUpdateAgeSec = lastUpdateMs ? Math.max(0, Math.round((Date.now() - lastUpdateMs) / 1000)) : null;
  const isStale = lastUpdateAgeSec !== null && lastUpdateAgeSec > 30;
  const eta = Number.isFinite(Number(workerLoc?.etaMinutes)) ? Number(workerLoc.etaMinutes) : fallbackEta;
  const distanceRemaining = Number.isFinite(Number(workerLoc?.distanceRemainingKm))
    ? Number(workerLoc.distanceRemainingKm)
    : null;
  const etaSource = workerLoc?.etaSource || (fallbackEta !== null ? 'haversine_fallback' : '');
  const isGoogleEta = ['google_maps', 'google_maps_traffic', 'google_maps_cached'].includes(etaSource);
  const etaQualifier = isGoogleEta
    ? (etaSource === 'google_maps_cached' ? ' - route ETA' : ' - Google route ETA')
    : etaSource === 'haversine_fallback'
      ? ' - approximate'
      : '';

  return (
    <div>
      <div ref={mapRef} style={{ width: '100%', height: 320, borderRadius: 12, marginBottom: 12, background: '#eee' }} />
      {workerLoc?.lat && workerLoc?.lng ? (
        <>
          <div style={{ fontWeight: 700, color: '#7C3AED' }}>
            Worker is {workerLoc.routeStatus === 'arrived' ? 'at your location' : 'on the way'}.
            {lastUpdateAgeSec !== null && ` Last update ${lastUpdateAgeSec}s ago.`}
          </div>
          {eta !== null && (
            <div style={{ color: '#444', marginTop: 4 }}>
              Estimated arrival: <strong>{eta} min{eta === 1 ? '' : 's'}</strong>
              {distanceRemaining !== null && ` - ${distanceRemaining.toFixed(1)} km away`}
              {etaQualifier}
            </div>
          )}
          {isStale && (
            <div style={{ color: '#B45309', marginTop: 4, fontWeight: 600 }}>
              Location update is stale. The worker may have weak network.
            </div>
          )}
          {workerLoc.watchdogMessage && (
            <div style={{ color: workerLoc.watchdogLevel === 'timeout_review' ? '#B91C1C' : '#B45309', marginTop: 4, fontWeight: 700 }}>
              {workerLoc.watchdogMessage}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: 'var(--text-muted)' }}>Waiting for worker to start travel...</div>
      )}
    </div>
  );
}
