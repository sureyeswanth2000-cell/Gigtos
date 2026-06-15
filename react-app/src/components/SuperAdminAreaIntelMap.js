import React, { useEffect, useMemo, useRef, useState } from 'react';

const HEALTH_COLORS = {
  'is-critical': '#DC2626',
  'is-warning': '#D97706',
  'is-watch': '#7C3AED',
  'is-muted': '#6B7280',
  'is-healthy': '#16A34A',
};

function ensureLeaflet(setReady) {
  if (window.L) {
    setReady(true);
    return;
  }
  if (!document.querySelector('link[data-gigtos-leaflet]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.dataset.gigtosLeaflet = 'true';
    document.head.appendChild(link);
  }
  const existingScript = document.querySelector('script[data-gigtos-leaflet]');
  if (existingScript) {
    existingScript.addEventListener('load', () => setReady(true), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.dataset.gigtosLeaflet = 'true';
  script.onload = () => setReady(true);
  document.head.appendChild(script);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markerRadius(point) {
  const pressure = Number(point.openJobs || 0) + Number(point.noWorkerSearches || 0) + Math.ceil(Number(point.activePoolWorkers || 0) / 3);
  return Math.max(8, Math.min(24, 8 + pressure));
}

function popupHtml(point) {
  const confidence = point.coordinateConfidence === 'area_center'
    ? 'Aggregate area center'
    : 'City fallback. Add area center in price rule.';
  return `
    <div class="superadmin-map-popup">
      <strong>${escapeHtml(point.city || 'City')} / ${escapeHtml(point.areaName || point.areaId || 'area')}</strong>
      <span>${escapeHtml(point.serviceName || point.serviceId || 'service')}</span>
      <dl>
        <dt>Demand</dt><dd>${escapeHtml(point.demandLevel || 'normal')}</dd>
        <dt>Open</dt><dd>${Number(point.openWorkers || 0)}</dd>
        <dt>Busy</dt><dd>${Number(point.busyWorkers || 0)}</dd>
        <dt>Jobs</dt><dd>${Number(point.openJobs || 0)}</dd>
        <dt>No worker</dt><dd>${Number(point.noWorkerSearches || 0)}</dd>
        <dt>Queue</dt><dd>${point.conversionPercent == null ? 'n/a' : `${Number(point.conversionPercent)}%`}</dd>
        <dt>Price</dt><dd>INR ${Number(point.recommendedPrice || 0).toLocaleString('en-IN')}</dd>
      </dl>
      <p>${escapeHtml(point.recruitSuggestion || '')}</p>
      <small>${escapeHtml(confidence)}</small>
    </div>
  `;
}

export default function SuperAdminAreaIntelMap({ points = [] }) {
  const [leafletReady, setLeafletReady] = useState(!!window.L);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerLayer = useRef(null);
  const usablePoints = useMemo(
    () => points.filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))),
    [points]
  );
  const fallbackPoints = usablePoints.filter(point => point.coordinateConfidence === 'city_fallback');

  useEffect(() => {
    ensureLeaflet(setLeafletReady);
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    const L = window.L;
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        center: usablePoints[0] ? [usablePoints[0].lat, usablePoints[0].lng] : [20.5937, 78.9629],
        zoom: usablePoints[0] ? 11 : 5,
        scrollWheelZoom: false,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap contributors',
      }).addTo(mapInstance.current);
    }

    const map = mapInstance.current;
    if (markerLayer.current) {
      map.removeLayer(markerLayer.current);
    }
    markerLayer.current = L.layerGroup().addTo(map);

    if (usablePoints.length === 0) {
      map.setView([20.5937, 78.9629], 5);
      return;
    }

    const bounds = [];
    usablePoints.forEach(point => {
      const color = HEALTH_COLORS[point.markerClass] || HEALTH_COLORS['is-healthy'];
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: markerRadius(point),
        color,
        fillColor: color,
        fillOpacity: point.coordinateConfidence === 'city_fallback' ? 0.38 : 0.72,
        weight: point.coordinateConfidence === 'city_fallback' ? 2 : 3,
      }).addTo(markerLayer.current);
      marker.bindPopup(popupHtml(point), { maxWidth: 320 });
      bounds.push([point.lat, point.lng]);
    });
    if (bounds.length === 1) {
      map.setView(bounds[0], 12);
    } else {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12 });
    }
  }, [leafletReady, usablePoints]);

  return (
    <section className="superadmin-area-map" aria-label="Area Intelligence Map">
      <div className="superadmin-area-map-head">
        <div>
          <h4>Area Intelligence Map</h4>
          <p>Aggregate city/area/service pressure only. Exact consumer and worker live locations stay out of this view.</p>
        </div>
        <span>{usablePoints.length} map points</span>
      </div>

      {usablePoints.length === 0 ? (
        <div className="superadmin-area-intel-empty">
          Add service price rules and demand snapshots to show aggregate map pressure.
        </div>
      ) : (
        <>
          <div ref={mapRef} className="superadmin-area-map-canvas" />
          <div className="superadmin-area-map-legend">
            <span><i className="is-critical" /> Supply gap or peak</span>
            <span><i className="is-warning" /> Stale or missing snapshot</span>
            <span><i className="is-watch" /> Low sample or manual override</span>
            <span><i className="is-healthy" /> Healthy</span>
            <span><i className="is-muted" /> Disabled</span>
          </div>
          {fallbackPoints.length > 0 && (
            <div className="superadmin-area-map-fallbacks">
              <strong>{fallbackPoints.length} points need area centers</strong>
              <span>
                These markers use city fallback locations. Add area center lat/lng in the price rule for exact aggregate area placement.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
