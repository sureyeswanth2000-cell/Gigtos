/**
 * LiveServiceTracker — Shows live worker tracking status to a consumer for a given booking.
 *
 * Reads from the `worker_location_sessions` Firestore collection using the bookingId.
 * Displays: worker tracking status, reach time, left time, and location status indicator.
 */
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';

const STATUS_CONFIG = {
  tracking: { label: 'Worker is on the way', color: '#2196f3', bg: '#e3f2fd', icon: '🚶', pulse: true },
  at_location: { label: 'Worker has arrived', color: '#4caf50', bg: '#e8f5e9', icon: '✅', pulse: false },
  left_location: { label: 'Worker has left', color: '#ff9800', bg: '#fff3e0', icon: '👋', pulse: false },
  closed: { label: 'Location sharing stopped', color: '#9e9e9e', bg: '#f5f5f5', icon: '📍', pulse: false },
  stopped: { label: 'Tracking ended', color: '#9e9e9e', bg: '#f5f5f5', icon: '⏹️', pulse: false },
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
    }, (err) => {
      console.error('LiveServiceTracker snapshot error:', err);
      setLoading(false);
    });

    return unsub;
  }, [bookingId]);

  if (loading) return null;
  if (!session) return null;

  const status = session.locationStatus || 'tracking';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.tracking;

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: config.bg,
          border: `1px solid ${config.color}`,
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 600,
          color: config.color,
        }}
        role="status"
        aria-live="polite"
        aria-label={`Worker tracking: ${config.label}`}
      >
        <span style={config.pulse ? { animation: 'liveTrackerPulse 1.5s infinite' } : {}}>
          {config.icon}
        </span>
        {config.label}
        <style>{`
          @keyframes liveTrackerPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '14px',
        background: config.bg,
        border: `1.5px solid ${config.color}`,
        borderRadius: '10px',
      }}
      role="region"
      aria-label="Live Worker Tracking"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <span
          style={{
            fontSize: '24px',
            ...(config.pulse ? { animation: 'liveTrackerPulse 1.5s infinite' } : {}),
          }}
        >
          {config.icon}
        </span>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: config.color }}>
            {config.label}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            Live tracking for this booking
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: '#374151' }}>
        {session.reachTime && (
          <div>
            <span style={{ fontWeight: 600 }}>Arrived: </span>
            {formatTime(session.reachTime)}
          </div>
        )}
        {session.leftTime && (
          <div>
            <span style={{ fontWeight: 600 }}>Left: </span>
            {formatTime(session.leftTime)}
          </div>
        )}
        {session.durationMinutes != null && session.durationMinutes > 0 && (
          <div>
            <span style={{ fontWeight: 600 }}>Duration: </span>
            {session.durationMinutes} min
          </div>
        )}
      </div>

      {session.lastLat && session.lastLng && status === 'tracking' && (
        <div style={{ marginTop: '8px' }}>
          <a
            href={`https://www.google.com/maps?q=${session.lastLat},${session.lastLng}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              background: 'white',
              border: `1px solid ${config.color}`,
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: config.color,
              textDecoration: 'none',
            }}
          >
            📍 View on Map
          </a>
        </div>
      )}

      <style>{`
        @keyframes liveTrackerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
