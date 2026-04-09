import React, { useEffect, useRef, useState } from 'react';
import { useLocation, DEFAULT_RADIUS_KM } from '../context/LocationContext';

/**
 * UserLocationMap – embeddable Leaflet map showing the user's live location
 * with a 20 km radius circle. Loads Leaflet dynamically from CDN.
 */
export default function UserLocationMap({ height = 280, showRadius = true }) {
  const { location, locationLoading } = useLocation();
  const [leafletReady, setLeafletReady] = useState(!!window.L);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // Load Leaflet CSS + JS if not already loaded
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

  // Init / update map whenever location changes
  useEffect(() => {
    if (!leafletReady || !location || !mapRef.current) return;
    const L = window.L;

    // If map already exists, update its view
    if (mapInstance.current) {
      mapInstance.current.setView([location.lat, location.lng], 12);
      // Remove old layers
      mapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
          mapInstance.current.removeLayer(layer);
        }
      });
    } else {
      mapInstance.current = L.map(mapRef.current, {
        center: [location.lat, location.lng],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapInstance.current);
    }

    // User marker
    L.marker([location.lat, location.lng], {
      icon: L.divIcon({
        html: '<div style="background:#A259FF;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">📍</div>',
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    }).addTo(mapInstance.current)
      .bindPopup(`<b>${location.city || 'Your Location'}</b><br/>Workers within ${DEFAULT_RADIUS_KM} km`);

    // 20 km radius circle
    if (showRadius) {
      L.circle([location.lat, location.lng], {
        radius: DEFAULT_RADIUS_KM * 1000,
        color: '#A259FF',
        fillColor: '#E9D5FF',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapInstance.current);
    }
  }, [leafletReady, location, showRadius]);

  // Clean up map on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  if (locationLoading || !location) {
    return (
      <div className="user-location-map user-location-map--loading" style={{ height }}>
        <span>📍 Loading map…</span>
      </div>
    );
  }

  return (
    <div className="user-location-map-wrapper">
      <div
        className="user-location-map"
        ref={mapRef}
        style={{ height, width: '100%' }}
      />
      <div className="user-location-map-caption">
        📍 Showing service area around {location.city || 'your location'} ({DEFAULT_RADIUS_KM} km radius)
      </div>
    </div>
  );
}
