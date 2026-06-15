import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useLocation as useGigLocation } from '../context/LocationContext';
import { matchNearbyWorkers, getWorkerDisplayInfo } from '../utils/instantBooking';
import { usePricingSettings } from '../utils/usePricingSettings';
import './AiActivityMonitor.css';

const NEARBY_RADIUS_KM = 10;

const SERVICE_LABELS = {
  plumber: 'PL',
  electrician: 'EL',
  carpenter: 'CA',
  painter: 'PA',
  cleaner: 'CL',
  driver: 'DR',
  security: 'SE',
  construction: 'CO',
  delivery: 'DE',
};

function getServiceMark(serviceType) {
  if (!serviceType) return 'SV';
  const key = serviceType.toLowerCase();
  for (const [service, label] of Object.entries(SERVICE_LABELS)) {
    if (key.includes(service)) return label;
  }
  return serviceType.slice(0, 2).toUpperCase();
}

function AiPulse() {
  return (
    <span className="ai-pulse-dot" aria-hidden="true">
      <span className="ai-pulse-ring" />
    </span>
  );
}

export default function AiActivityMonitor({ onBookWorker }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { location } = useGigLocation() || {};
  const pricingSettings = usePricingSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location?.lat || !location?.lng) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    const fetchWorkers = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'worker_availability'), where('isAvailable', '==', true))
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const serviceTypes = [...new Set(all.map((w) => w.serviceType))];
        const matched = [];
        const seen = new Set();
        const heavyDriverSubtypes = ['driver-with-private-bus', 'driver-with-bulldozer'];

        for (const serviceType of serviceTypes) {
          const radiusKm = heavyDriverSubtypes.includes(serviceType) ? 100 : NEARBY_RADIUS_KM;
          const results = matchNearbyWorkers(all, {
            serviceType,
            lat: location.lat,
            lng: location.lng,
            radiusKm,
          });
          for (const worker of results) {
            if (!seen.has(worker.workerId)) {
              seen.add(worker.workerId);
              matched.push(worker);
            }
          }
        }

        if (!cancelled) setWorkers(matched);
      } catch {
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchWorkers();
    return () => {
      cancelled = true;
    };
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
          Real workers within {NEARBY_RADIUS_KM} km of {cityName}. Book for immediate help.
        </p>
      </div>

      <div className="ai-monitor__feed">
        {loading && (
          <div className="ai-empty">Checking nearby worker supply...</div>
        )}

        {!loading && workers.length === 0 && (
          <div className="ai-empty">
            <strong>All nearby workers are occupied right now.</strong>
            <span>Please check again shortly or browse services below.</span>
          </div>
        )}

        {!loading &&
          workers.map((worker) => {
            const info = getWorkerDisplayInfo(worker, pricingSettings);
            if (!info) return null;
            const serviceMark = getServiceMark(info.serviceType);

            return (
              <div className="ai-card nearby-worker-card" key={worker.workerId}>
                <div className="ai-card__icon">
                  <span className="nearby-worker-icon">{serviceMark}</span>
                </div>
                <div className="ai-card__body">
                  <div className="ai-card__title">
                    {info.workerName}
                    <span className="nearby-worker-badge">Available</span>
                  </div>
                  <div className="ai-card__desc">
                    {info.serviceType}
                    {info.area && ` - ${info.area}`}
                  </div>
                  <div className="ai-card__meta">
                    <span className="nearby-worker-rating">
                      Rating {info.rating > 0 ? info.rating.toFixed(1) : 'New'}
                    </span>
                    {info.distanceKm != null && (
                      <span className="nearby-worker-distance">
                        {info.distanceKm} km away
                      </span>
                    )}
                    <span className="nearby-worker-price">
                      INR {info.finalPrice.toLocaleString('en-IN')} total
                    </span>
                  </div>
                </div>
                <div className="nearby-worker-action">
                  <button
                    className="nearby-book-btn"
                    onClick={() => handleBook(worker)}
                    aria-label={`Book ${info.workerName}`}
                    type="button"
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
