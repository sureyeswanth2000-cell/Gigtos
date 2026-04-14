import React, { useEffect, useRef, useState } from 'react';
import { useLocation, DEFAULT_RADIUS_KM } from '../context/LocationContext';

/**
 * UserLocationMap – embeddable Leaflet map showing the user's live location
 * with a 20 km radius circle. Loads Leaflet dynamically from CDN.
 */
export default function UserLocationMap({ height = 280, showRadius = true, label, onLocationSelect }) {
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
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin = '';
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
        html: '<div class="user-map-marker">📍</div>',
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

    // If selection enabled, add click handler
    if (onLocationSelect) {
      const map = mapInstance.current;
      const handleClick = (e) => {
        const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
        L.marker([coords.lat, coords.lng], {
          icon: L.divIcon({
            html: '<div class="user-map-marker" style="background:#F59E0B;">📍</div>',
            className: '',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
        }).addTo(map);
        onLocationSelect(coords);
      };
      map.on('click', handleClick);
      return () => map.off('click', handleClick);
    }
  }, [leafletReady, location, showRadius, onLocationSelect]);

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
      {label && <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>}
      <div
        className="user-location-map"
        ref={mapRef}
        style={{ height, width: '100%' }}
      />
      <div className="user-location-map-caption">
        📍 Showing service area around {location.city || 'your location'} ({DEFAULT_RADIUS_KM} km radius)
      </div>
      {onLocationSelect && <div style={{ color: '#A259FF', marginTop: 4 }}>Tap on map to select location</div>}
    </div>
  );
}
