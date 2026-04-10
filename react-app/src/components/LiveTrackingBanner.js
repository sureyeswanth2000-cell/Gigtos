/**
 * LiveTrackingBanner — Floating banner that shows active worker tracking
 * for the logged-in user's bookings. Displayed on every page except Home.
 *
 * Listens to the user's bookings with active statuses (assigned, in_progress)
 * and checks for matching worker_location_sessions. Shows a compact pill/bar
 * the user can click to navigate to My Bookings.
 */
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot, doc, getDoc
} from 'firebase/firestore';

const ACTIVE_STATUSES = ['assigned', 'in_progress'];

const STATUS_LABELS = {
  tracking: 'Worker is on the way',
  at_location: 'Worker has arrived',
  left_location: 'Worker has left the site',
  closed: 'Location sharing stopped',
};

export default function LiveTrackingBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [trackingBookings, setTrackingBookings] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [isWorker, setIsWorker] = useState(false);

  // Hide on home page, auth page, and worker pages
  const hiddenPaths = ['/', '/auth'];
  const isHidden =
    hiddenPaths.includes(location.pathname) ||
    location.pathname.startsWith('/worker/') ||
    location.pathname.startsWith('/admin/') ||
    location.pathname.startsWith('/mason/');

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const workerDoc = await getDoc(doc(db, 'worker_auth', u.uid));
          setIsWorker(workerDoc.exists());
        } catch {
          setIsWorker(false);
        }
      } else {
        setIsWorker(false);
      }
    });
    return unsub;
  }, []);

  // Listen to user's active bookings and their tracking sessions
  useEffect(() => {
    if (!user || isHidden || isWorker) {
      setTrackingBookings([]);
      return;
    }

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      where('status', 'in', ACTIVE_STATUSES)
    );

    const unsub = onSnapshot(bookingsQuery, (snap) => {
      const activeBookings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (activeBookings.length === 0) {
        setTrackingBookings([]);
        return;
      }

      // For each active booking, listen to its tracking session
      const sessionUnsubs = activeBookings.map((booking) => {
        const sessionQuery = query(
          collection(db, 'worker_location_sessions'),
          where('bookingId', '==', booking.id)
        );

        return onSnapshot(sessionQuery, (sessionSnap) => {
          setTrackingBookings((prev) => {
            // Remove old entries for this booking
            const filtered = prev.filter((tb) => tb.bookingId !== booking.id);

            if (!sessionSnap.empty) {
              // Get the most recent session
              const sessions = sessionSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));
              sessions.sort(
                (a, b) =>
                  (b.startedAt?.seconds || 0) - (a.startedAt?.seconds || 0)
              );
              const latestSession = sessions[0];

              // Only show if session is still active (tracking or at_location)
              if (['tracking', 'at_location'].includes(latestSession.locationStatus)) {
                filtered.push({
                  bookingId: booking.id,
                  serviceType: booking.serviceType,
                  workerName: booking.assignedWorker || 'Worker',
                  locationStatus: latestSession.locationStatus,
                  reachTime: latestSession.reachTime,
                  lastLat: latestSession.lastLat,
                  lastLng: latestSession.lastLng,
                });
              }
            }

            return filtered;
          });
        }, () => { /* ignore session errors */ });
      });

      return () => sessionUnsubs.forEach((u) => u());
    }, () => { /* ignore booking errors */ });

    return unsub;
  }, [user, isHidden, isWorker]);

  if (isHidden || !user || isWorker || trackingBookings.length === 0) {
    return null;
  }

  const primary = trackingBookings[0];
  const statusLabel = STATUS_LABELS[primary.locationStatus] || 'Tracking active';
  const isArrived = primary.locationStatus === 'at_location';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)',
        maxWidth: '500px',
      }}
    >
      {/* Expanded panel */}
      {expanded && trackingBookings.length > 1 && (
        <div
          style={{
            background: 'white',
            borderRadius: '12px 12px 0 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
            padding: '12px',
            marginBottom: '-1px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>
            All Active Tracking ({trackingBookings.length})
          </div>
          {trackingBookings.slice(1).map((tb) => (
            <div
              key={tb.bookingId}
              onClick={() => navigate('/my-bookings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                background: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '4px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
              role="button"
              tabIndex={0}
              aria-label={`Track ${tb.serviceType} worker`}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/my-bookings')}
            >
              <span style={{
                animation: tb.locationStatus === 'tracking' ? 'liveTrackBannerPulse 1.5s infinite' : 'none',
              }}>
                {tb.locationStatus === 'at_location' ? '✅' : '🚶'}
              </span>
              <span style={{ fontWeight: 600 }}>{tb.serviceType}</span>
              <span style={{ color: '#6b7280' }}>— {STATUS_LABELS[tb.locationStatus] || 'Active'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main banner */}
      <div
        onClick={() => navigate('/my-bookings')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          background: isArrived
            ? 'linear-gradient(135deg, #4caf50, #2e7d32)'
            : 'linear-gradient(135deg, #A259FF, #7C3AED)',
          borderRadius: expanded && trackingBookings.length > 1 ? '0 0 12px 12px' : '12px',
          boxShadow: '0 4px 20px rgba(162, 89, 255, 0.35)',
          cursor: 'pointer',
          color: 'white',
          transition: 'all 0.2s ease',
        }}
        role="button"
        tabIndex={0}
        aria-label={`Live tracking: ${statusLabel}. Tap to view in My Bookings.`}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/my-bookings')}
      >
        {/* Pulsing indicator */}
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isArrived ? '#a5d6a7' : '#fff',
            boxShadow: isArrived
              ? '0 0 8px rgba(165,214,167,0.7)'
              : '0 0 8px rgba(255,255,255,0.7)',
            animation: 'liveTrackBannerPulse 1.5s infinite',
            flexShrink: 0,
          }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>
            {primary.serviceType} — {primary.workerName}
          </div>
          <div style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>
            {statusLabel}
          </div>
        </div>

        {/* Count badge if multiple */}
        {trackingBookings.length > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              background: 'rgba(255,255,255,0.25)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '14px',
              padding: '2px 8px',
              color: 'white',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            aria-label={`${trackingBookings.length} active trackings`}
          >
            +{trackingBookings.length - 1}
          </button>
        )}

        <span style={{ fontSize: '18px', opacity: 0.8 }}>→</span>
      </div>

      <style>{`
        @keyframes liveTrackBannerPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
