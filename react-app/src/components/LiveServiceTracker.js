/**
 * LiveServiceTracker — Shows live worker tracking status to a consumer for a given booking.
 * Logic: Reads from `worker_location_sessions` Firestore collection based on bookingId.
 */
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import './LiveServiceTracker.css';

const STATUS_CONFIG = {
  tracking: { label: 'Worker is on the way', color: 'var(--primary-purple)', icon: '🚶', pulse: true },
  at_location: { label: 'Worker has arrived', color: 'var(--success)', icon: '✅', pulse: false },
  left_location: { label: 'Worker has left', color: 'var(--warning)', icon: '👋', pulse: false },
  closed: { label: 'Location sharing ended', color: 'var(--text-muted)', icon: '📍', pulse: false },
  stopped: { label: 'Tracking finished', color: 'var(--text-muted)', icon: '⏹️', pulse: false },
};

function formatTime(ts) {
  if (!ts) return null;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function LiveServiceTracker({ bookingId, compact = false }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'worker_location_sessions'),
      where('bookingId', '==', bookingId),
      orderBy('startedAt', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const docData = snap.docs[0].data();
        setSession({ id: snap.docs[0].id, ...docData });
      } else {
        setSession(null);
      }
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [bookingId]);

  if (loading || !session) return null;

  const status = session.locationStatus || 'tracking';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.tracking;

  if (compact) {
    return (
      <div className="live-tracker-compact" role="status" aria-label={`Worker tracking: ${config.label}`}>
        <span className={config.pulse ? 'tracker-icon pulse small' : 'tracker-icon small'}>{config.icon}</span>
        <span style={{ color: config.color }}>{config.label}</span>
      </div>
    );
  }

  return (
    <div className="live-tracker-container" role="region" aria-label="Live Worker Tracking">
      <div className="tracker-header">
        <span className={config.pulse ? 'tracker-icon pulse' : 'tracker-icon'}>{config.icon}</span>
        <div className="tracker-text">
          <div className="tracker-label" style={{ color: config.color }}>{config.label}</div>
          <div className="tracker-subtext">Real-time status for your booking</div>
        </div>
      </div>

      <div className="tracker-stats">
        {session.reachTime && (
          <div className="stat-item">
            <span className="stat-label">Arrived:</span>
            {formatTime(session.reachTime)}
          </div>
        )}
        {session.leftTime && (
          <div className="stat-item">
            <span className="stat-label">Left:</span>
            {formatTime(session.leftTime)}
          </div>
        )}
        {session.durationMinutes != null && session.durationMinutes > 0 && (
          <div className="stat-item">
            <span className="stat-label">Duration:</span>
            {session.durationMinutes} min
          </div>
        )}
      </div>

      {status === 'tracking' && (
        session.lastLat && session.lastLng ? (
          <a
            href={`https://www.google.com/maps?q=${session.lastLat},${session.lastLng}`}
            target="_blank"
            rel="noreferrer"
            className="map-link"
          >
            📍 View Live Location ↗
          </a>
        ) : (
          <div className="map-link-unavailable" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            📍 Live location not available yet.
          </div>
        )
      )}
    </div>
  );
}
