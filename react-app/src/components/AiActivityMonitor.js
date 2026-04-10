import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useLocation as useGigLocation } from '../context/LocationContext';
import { matchNearbyWorkers, getWorkerDisplayInfo } from '../utils/instantBooking';
import './AiActivityMonitor.css';

const NEARBY_RADIUS_KM = 10;

/**
 * Service-type icons used on worker cards.
 */
const SERVICE_ICONS = {
  plumber: '🔧',
  electrician: '⚡',
  carpenter: '🪚',
  painter: '🎨',
  cleaner: '🧹',
  driver: '🚗',
  security: '🛡️',
  construction: '🏗️',
  delivery: '📦',
};

function getServiceIcon(serviceType) {
  if (!serviceType) return '🔧';
  const key = serviceType.toLowerCase();
  for (const [k, icon] of Object.entries(SERVICE_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return '🔧';
}

function AiPulse() {
  return (
    <span className="ai-pulse-dot" aria-hidden="true">
      <span className="ai-pulse-ring" />
    </span>
  );
}

/**
 * Nearby Workers section — fetches real workers from the worker_availability
 * Firestore collection within 10 km of the user and displays them as
 * bookable cards with service type, name, rating, distance, and price.
 */
export default function AiActivityMonitor({ onBookWorker }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { location } = useGigLocation() || {};
  const navigate = useNavigate();

  // Fetch real nearby workers from Firestore
  useEffect(() => {
    if (!location?.lat || !location?.lng) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchWorkers = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'worker_availability'), where('isAvailable', '==', true))
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Match workers across all service types within 10 km
        const serviceTypes = [...new Set(all.map((w) => w.serviceType))];
        const matched = [];
        const seen = new Set();

        for (const sType of serviceTypes) {
          const results = matchNearbyWorkers(all, {
            serviceType: sType,
            lat: location.lat,
            lng: location.lng,
            radiusKm: NEARBY_RADIUS_KM,
          });
          for (const w of results) {
            if (!seen.has(w.workerId)) {
              seen.add(w.workerId);
              matched.push(w);
            }
          }
        }

        if (!cancelled) setWorkers(matched);
      } catch (err) {
        // Log for debugging; UI falls back to empty state
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWorkers();
    return () => { cancelled = true; };
  }, [location]);

  const handleBook = useCallback(
    (worker) => {
      if (!auth.currentUser) {
        navigate('/auth?mode=user');
        return;
      }
      if (onBookWorker) onBookWorker(worker);
    },
    [onBookWorker, navigate],
  );

  const cityName = location?.city || 'your area';

  return (
    <section className="ai-monitor" aria-label="Nearby Workers">
      <div className="ai-monitor__header">
        <div className="ai-monitor__title-row">
          <AiPulse />
          <h2>Workers Near You</h2>
          <span className="ai-live-badge">LIVE</span>
        </div>
        <p className="ai-monitor__subtitle">
          Real workers within {NEARBY_RADIUS_KM} km of {cityName} — book for immediate help.
        </p>
      </div>

      <div className="ai-monitor__feed">
        {loading && (
          <div className="ai-empty">Searching for workers nearby…</div>
        )}

        {!loading && workers.length === 0 && (
          <div className="ai-empty">
            No workers available within {NEARBY_RADIUS_KM} km right now. Check back soon or browse services below.
          </div>
        )}

        {!loading &&
          workers.map((worker) => {
            const info = getWorkerDisplayInfo(worker);
            if (!info) return null;
            const icon = getServiceIcon(info.serviceType);

            return (
              <div className="ai-card nearby-worker-card" key={worker.workerId}>
                <div className="ai-card__icon">
                  <span className="nearby-worker-icon">{icon}</span>
                </div>
                <div className="ai-card__body">
                  <div className="ai-card__title">
                    {info.workerName}
                    <span className="nearby-worker-badge">✅ Available</span>
                  </div>
                  <div className="ai-card__desc">
                    {info.serviceType}
                    {info.area && ` · 📍 ${info.area}`}
                  </div>
                  <div className="ai-card__meta">
                    <span className="nearby-worker-rating">
                      ⭐ {info.rating > 0 ? info.rating.toFixed(1) : 'New'}
                    </span>
                    {info.distanceKm != null && (
                      <span className="nearby-worker-distance">
                        📍 {info.distanceKm} km away
                      </span>
                    )}
                    <span className="nearby-worker-price">
                      ₹{info.fixedRate.toLocaleString('en-IN')}/day
                    </span>
                  </div>
                </div>
                <div className="nearby-worker-action">
                  <button
                    className="nearby-book-btn"
                    onClick={() => handleBook(worker)}
                    aria-label={`Book ${info.workerName}`}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
