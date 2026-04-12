import React, { useEffect, useRef } from 'react';

export default function MapView({ center, jobs = [], workerLocation }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (mapInstance.current) return;
    if (!window.L) return;

    const L = window.L;
    const lat = center?.lat || workerLocation?.lat || 13.0827;
    const lng = center?.lng || workerLocation?.lng || 80.2707;

    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    if (workerLocation) {
      L.marker([workerLocation.lat, workerLocation.lng], {
        icon: L.divIcon({
          html: '<div style="background:#A259FF;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">👷</div>',
          className: '',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
      }).addTo(map).bindPopup('<b>Your Location</b>');
    }

    jobs.forEach(job => {
      if (!job.lat || !job.lng) return;
      L.marker([job.lat, job.lng], {
        icon: L.divIcon({
          html: '<div style="background:#F59E0B;color:white;border-radius:8px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2)">📋</div>',
          className: '',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        })
      }).addTo(map).bindPopup(`<b>${job.title}</b><br/><a href="https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}" target="_blank">Navigate →</a>`);
    });

    mapInstance.current = map;
  }, [center, jobs, workerLocation]);

  return (
    <div ref={mapRef} style={{ height: '100%', width: '100%', borderRadius: 14 }} />
  );
}
