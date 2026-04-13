/**
 * NearbyWorkerNotification — Floating notification showing available workers
 * with their fixed daily rates near the user.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useLocation as useGigLocation } from '../context/LocationContext';
import { matchNearbyWorkers, buildNotificationText } from '../utils/instantBooking';

const DISMISS_KEY = 'gigtos_nearby_dismissed';
const DISMISS_DURATION = 30 * 60 * 1000; // 30 minutes

export default function NearbyWorkerNotification({ onBookWorker }) {
  const [workers, setWorkers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { location } = useGigLocation() || {};

  // Check dismiss state
  useEffect(() => {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (ts && Date.now() - parseInt(ts, 10) < DISMISS_DURATION) {
      setDismissed(true);
    }
  }, []);

  // Fetch available workers
  useEffect(() => {
    if (dismissed || !location?.lat || !location?.lng) {
      setLoading(false);
      return;
    }

    const fetchWorkers = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'worker_availability'), where('isAvailable', '==', true))
        );
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const serviceTypes = [...new Set(all.map((w) => w.serviceType))];
        const allMatched = [];
        const seen = new Set();

        for (const sType of serviceTypes) {
          const results = matchNearbyWorkers(all, {
            serviceType: sType,
            lat: location.lat,
            lng: location.lng,
            radiusKm: 10,
          });
          for (const w of results) {
            if (!seen.has(w.workerId)) {
              seen.add(w.workerId);
              allMatched.push(w);
            }
          }
        }
        setWorkers(allMatched);
      } catch {
        setWorkers([]);
      } finally {
        setLoading(false);
      }
    };

    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    fetchWorkers();
  }, [location, dismissed]);

  useEffect(() => {
    if (workers.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % workers.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [workers.length]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  const handleBook = useCallback(() => {
    const worker = workers[currentIndex];
    if (worker && onBookWorker) {
      onBookWorker(worker);
    }
  }, [workers, currentIndex, onBookWorker]);

  if (dismissed || loading || workers.length === 0) return null;

  const currentWorker = workers[currentIndex];
  const text = buildNotificationText(currentWorker);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        width: 'calc(100% - 32px)',
        maxWidth: 500,
        animation: 'nearbySlideUp 0.4s ease-out',
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        style={{
          background: 'linear-gradient(135deg, var(--success) 0%, #10B981 100%)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          boxShadow: '0 8px 28px var(--success-bg)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        {/* Pulsing indicator */}
        <span
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#A7F3D0',
            boxShadow: '0 0 8px rgba(167,243,208,0.7)',
            animation: 'nearbyPulse 1.5s infinite',
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
            {text}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
            {currentWorker.workerName} · ⭐ {currentWorker.rating || 'New'}{' '}
            {currentWorker.distanceKm != null && `· ${currentWorker.distanceKm}km away`}
          </div>
        </div>

        <button
          onClick={handleBook}
          style={{
            background: '#fff', color: 'var(--success)',
            border: 'none', borderRadius: 8,
            padding: '8px 16px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
          aria-label={`Book ${currentWorker.workerName}`}
        >
          Book Now
        </button>

        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', borderRadius: '50%',
            width: 24, height: 24, fontSize: 14,
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>

      {workers.length > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 4,
          marginTop: 8,
        }}>
          {workers.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === currentIndex ? 16 : 6, height: 6,
                borderRadius: 3,
                background: i === currentIndex ? 'var(--success)' : 'var(--success-bg)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes nearbySlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(40px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes nearbyPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
