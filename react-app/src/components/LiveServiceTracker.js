/**
 * Shows live worker tracking status to a consumer for a booking.
 */
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import './LiveServiceTracker.css';

const STATUS_CONFIG = {
  tracking: { label: 'Worker is on the way', color: 'var(--primary-purple)', icon: '>', pulse: true },
  at_location: { label: 'Worker has arrived', color: 'var(--success)', icon: 'OK', pulse: false },
  left_location: { label: 'Worker has left', color: 'var(--warning)', icon: '<', pulse: false },
  closed: { label: 'Location sharing ended', color: 'var(--text-muted)', icon: '-', pulse: false },
  stopped: { label: 'Tracking finished', color: 'var(--text-muted)', icon: 'X', pulse: false },
};

function formatTime(ts) {
  if (!ts) return null;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getMapCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default function LiveServiceTracker({ bookingId, compact = false }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return undefined;
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
  const lastLat = getMapCoordinate(session.lastLat);
  const lastLng = getMapCoordinate(session.lastLng);
  const hasLiveCoordinates = lastLat !== null && lastLng !== null;

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
        hasLiveCoordinates ? (
          <a
            href={`https://www.google.com/maps?q=${lastLat},${lastLng}`}
            target="_blank"
            rel="noreferrer"
            className="map-link"
          >
            View Live Location -&gt;
          </a>
        ) : (
          <div className="map-link-unavailable" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
            Live location not available yet.
          </div>
        )
      )}
    </div>
  );
}
