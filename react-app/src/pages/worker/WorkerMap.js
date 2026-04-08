import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

const MOCK_JOBS = [
  { id: 1, title: 'Plumber needed', area: 'Adyar', budget: 800, lat: 13.0012, lng: 80.2565, category: 'Plumbing' },
  { id: 2, title: 'Electrician', area: 'Velachery', budget: 1200, lat: 12.9816, lng: 80.2209, category: 'Electrical' },
  { id: 3, title: 'House cleaning', area: 'OMR', budget: 600, lat: 12.9200, lng: 80.2300, category: 'Cleaning' },
];

export default function WorkerMap() {
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  // Load Leaflet CSS + JS dynamically
  useEffect(() => {
    if (window.L) { setLeafletLoaded(true); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Get location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          setLocationError('Location access denied. Showing default location (Chennai).');
          setLocation({ lat: 13.0827, lng: 80.2707 });
        }
      );
    } else {
      setLocation({ lat: 13.0827, lng: 80.2707 });
    }
  }, []);

  // Init map
  useEffect(() => {
    if (!leafletLoaded || !location || !mapRef.current || mapInstance.current) return;
    const L = window.L;

    const map = L.map(mapRef.current, { center: [location.lat, location.lng], zoom: 13 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Worker marker
    L.marker([location.lat, location.lng], {
      icon: L.divIcon({
        html: '<div style="background:#A259FF;color:white;border-radius:50%;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">👷</div>',
        className: '',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      })
    }).addTo(map).bindPopup('<b>Your Location</b>').openPopup();

    // Job markers
    MOCK_JOBS.forEach(job => {
      L.marker([job.lat, job.lng], {
        icon: L.divIcon({
          html: `<div style="background:#F59E0B;color:white;border-radius:8px;min-width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;padding:0 6px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.2)">&#8377;${job.budget}</div>`,
          className: '',
          iconSize: [null, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(map).bindPopup(
        `<div style="min-width:160px"><b>${job.title}</b><br/>📍 ${job.area}<br/>💰 ₹${job.budget}<br/><a href="https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}" target="_blank" style="color:#A259FF;font-weight:600">Navigate →</a></div>`
      );
    });

    mapInstance.current = map;
  }, [leafletLoaded, location]);

  return (
    <div className="worker-page">
      <div className="worker-container">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/worker/dashboard" style={{ color: '#A259FF', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F1144' }}>🗺️ My Map</h2>
        </div>

        {locationError && (
          <div style={{ background: '#FEF3C7', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#92400E' }}>
            ⚠️ {locationError}
          </div>
        )}

        {/* Map */}
        <div style={{ height: 320, borderRadius: 14, overflow: 'hidden', marginBottom: 16, border: '1px solid #E9D5FF', position: 'relative' }}>
          {!leafletLoaded || !location ? (
            <div className="skeleton" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
              📍 Loading map...
            </div>
          ) : (
            <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
          )}
        </div>

        {/* Nearby Jobs */}
        <h3 className="section-title">📍 Nearby Jobs ({MOCK_JOBS.length})</h3>
        {MOCK_JOBS.map(job => (
          <div
            key={job.id}
            className="job-card"
            style={{ cursor: 'pointer', border: selectedJob?.id === job.id ? '2px solid #A259FF' : undefined }}
            onClick={() => setSelectedJob(job)}
          >
            <div className="job-card-header">
              <div className="job-title">{job.title}</div>
              <span className="job-category-badge">{job.category}</span>
            </div>
            <div className="job-meta">
              <span className="job-meta-item">📍 {job.area}</span>
              <span className="job-meta-item">💰 ₹{job.budget}</span>
            </div>
            <div className="job-actions">
              <button
                className="btn-secondary"
                onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`, '_blank'); }}
              >
                🧭 Navigate
              </button>
              <Link
                to="/worker/open-work"
                className="btn-primary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600 }}
              >
                View Jobs
              </Link>
            </div>
          </div>
        ))}
      </div>
      <WorkerBottomNav />
    </div>
  );
}
