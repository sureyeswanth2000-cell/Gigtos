import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';

const CATEGORIES = [
  { name: 'Maid hourly basic help', type: 'maid_hourly_basic_help', icon: 'Maid' },
  { name: 'Kitchen help', type: 'kitchen_help', icon: 'Kitchen' },
  { name: 'Bathroom cleaning', type: 'bathroom_cleaning', icon: 'Bath' },
  { name: 'Bedroom cleaning', type: 'bedroom_cleaning', icon: 'Room' },
  { name: 'Full house cleaning', type: 'full_house_basic_cleaning', icon: 'Home' },
  { name: 'Electrician', type: 'Electrician', icon: 'Elec' },
];

const statusColors = {
  completed: { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success)' },
  scheduled: { bg: 'var(--primary-purple-glow)', text: 'var(--primary-purple)', border: 'var(--primary-purple)' },
  pending: { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning)' },
  matching: { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning)' },
  assigned: { bg: 'var(--primary-purple-glow)', text: 'var(--primary-purple)', border: 'var(--primary-purple)' },
  in_progress: { bg: 'var(--primary-purple-glow)', text: 'var(--primary-purple)', border: 'var(--primary-purple)' },
  cancelled: { bg: 'rgba(220,38,38,0.10)', text: '#dc2626', border: '#dc2626' },
};

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const ms = toMillis(value);
  return ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date pending';
}

function formatInr(value) {
  const amount = Math.round(Number(value || 0));
  return `Rs ${amount.toLocaleString('en-IN')}`;
}

function getBookingAmount(booking) {
  return booking.finalConsumerPrice ||
    booking.workerReceivable ||
    booking.acceptedQuote?.finalPrice ||
    booking.acceptedQuote?.price ||
    booking.fixedRate ||
    booking.quoteAmount ||
    0;
}

function getBookingTitle(booking) {
  return booking.serviceName || booking.serviceType || booking.gigType || booking.serviceId || 'Service booking';
}

export default function UserDashboard() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [lastWorkType, setLastWorkType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLastWorkType(localStorage.getItem('last_work_type') || '');
  }, []);

  useEffect(() => {
    let unsubscribeBookings = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeBookings();
      setError('');
      if (!user) {
        setBookings([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      unsubscribeBookings = onSnapshot(
        query(collection(db, 'bookings'), where('userId', '==', user.uid)),
        (snap) => {
          setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          setError(err.message || 'Could not load bookings.');
          setBookings([]);
          setLoading(false);
        }
      );
    });
    return () => {
      unsubscribeBookings();
      unsubscribeAuth();
    };
  }, []);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt)).slice(0, 5),
    [bookings]
  );
  const pendingCount = bookings.filter(b => ['pending', 'matching', 'scheduled', 'quoted', 'assigned', 'in_progress'].includes(String(b.status || '').toLowerCase())).length;
  const completedCount = bookings.filter(b => String(b.status || '').toLowerCase() === 'completed').length;
  const launchSaved = bookings.reduce((sum, b) => sum + Number(b.launchFeeWaived || b.feeWaived || 0), 0);
  const stats = [
    { label: 'Total bookings', value: bookings.length.toString(), icon: 'Jobs' },
    { label: 'Launch saved', value: formatInr(launchSaved), icon: 'Save' },
    { label: 'Pending', value: pendingCount.toString(), icon: 'Open' },
  ];

  if (loading) {
    return (
      <div style={{
        height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: 18
      }}>
        Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="dash-container" style={{
      minHeight: '100vh',
      background: 'var(--bg-main)',
      padding: '40px 20px',
    }}>
      <main style={{ maxWidth: 1000, margin: '0 auto' }}>
        <header style={{ marginBottom: 40, textAlign: 'center' }}>
          <h1 style={{
            fontSize: 'var(--font-xl)',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: 8,
            letterSpacing: '-1px'
          }}>
            Welcome Back
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Manage your real bookings and discover local experts.
          </p>
        </header>

        {error && (
          <div className="job-card" role="alert" style={{ padding: 18, marginBottom: 24, color: '#dc2626' }}>
            {error}
          </div>
        )}

        {lastWorkType && (
          <div style={{
            background: 'var(--primary-purple-glow)',
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--primary-purple)',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            marginBottom: 40,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 8px 32px var(--primary-purple-glow)'
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: 18 }}>Need another {lastWorkType}?</p>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>Quickly book a verified professional near you.</p>
            </div>
            <button onClick={() => navigate('/service')} className="btn-primary">Book Again</button>
          </div>
        )}

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 24, marginBottom: 48
        }}>
          {stats.map(s => (
            <div key={s.label} className="job-card" style={{
              padding: 24,
              display: 'flex', alignItems: 'center', gap: 20
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--primary-purple-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>{s.value}</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Discover Services</h2>
            <button onClick={() => navigate('/services')} style={{ background: 'none', border: 'none', color: 'var(--primary-purple)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>View All</button>
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: 20
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => {
                  localStorage.setItem('last_work_type', cat.name);
                  navigate(`/service?type=${encodeURIComponent(cat.type)}`);
                }}
                className="job-card"
                style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  cursor: 'pointer', padding: 16,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 900 }} className="job-card-icon">{cat.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 24 }}>Recent Bookings</h2>
          <div className="job-card" style={{ padding: 0, overflow: 'hidden' }}>
            {sortedBookings.length === 0 ? (
              <div style={{ padding: 64, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>No bookings</div>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 18 }}>No real bookings found yet.</p>
                <button onClick={() => navigate('/service')} className="btn-primary" style={{ marginTop: 24 }}>
                  Start Booking
                </button>
              </div>
            ) : (
              <div>
                {sortedBookings.map((b, i) => {
                  const status = String(b.status || 'pending').toLowerCase();
                  const colors = statusColors[status] || statusColors.pending;
                  return (
                    <div key={b.id} style={{
                      padding: '24px 32px', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: i === sortedBookings.length - 1 ? 'none' : '1px solid var(--border-light)',
                      gap: 18,
                    }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: 16 }}>{getBookingTitle(b)}</p>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                          {b.workerName || b.assignedWorker || 'Worker matching'} - {formatDate(b.createdAt || b.scheduledAt)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 8px 0', fontWeight: 800, color: 'var(--text-main)', fontSize: 18 }}>{formatInr(getBookingAmount(b))}</p>
                        <span style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 'var(--radius-pill)',
                          padding: '4px 12px',
                          fontSize: 12,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {completedCount > 0 && (
            <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>
              Completed bookings: {completedCount}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
