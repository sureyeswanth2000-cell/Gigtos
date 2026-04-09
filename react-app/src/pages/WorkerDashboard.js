import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const purple = '#A259FF';
const ACTIVE_HOURS = 12;
const ACTIVE_MS = ACTIVE_HOURS * 60 * 60 * 1000;

const NAV_CARDS = [
  { label: '🗺️ Map', path: '/worker/map', desc: 'Jobs near you' },
  { label: '📋 Open Work', path: '/worker/open-work', desc: 'Browse & quote' },
  { label: '📅 Future Work', path: '/worker/future-work', desc: 'Scheduled jobs' },
  { label: '📂 History', path: '/worker/history', desc: 'Past earnings' },
  { label: '👤 Profile', path: '/worker/profile', desc: 'Edit your info' },
  { label: '💬 Support', path: '/worker/support', desc: 'Get help' },
];

function formatCountdown(ms) {
  if (ms <= 0) return '0h 0m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [lastWorkType, setLastWorkType] = useState('');

  const refreshActiveState = useCallback(() => {
    const until = parseInt(localStorage.getItem('worker_active_until') || '0', 10);
    const now = Date.now();
    if (until > now) {
      setIsActive(true);
      setRemaining(until - now);
    } else {
      setIsActive(false);
      setRemaining(0);
      localStorage.removeItem('worker_active_since');
      localStorage.removeItem('worker_active_until');
    }
  }, []);

  useEffect(() => {
    refreshActiveState();
    setLastWorkType(localStorage.getItem('last_work_type') || '');
    const interval = setInterval(refreshActiveState, 30000);
    return () => clearInterval(interval);
  }, [refreshActiveState]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setError('Not logged in');
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (!snap.exists()) {
          setError('Worker account not found. Please activate your worker login.');
          setLoading(false);
          return;
        }
        setWorker(snap.data());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleActivate = () => {
    const now = Date.now();
    const until = now + ACTIVE_MS;
    localStorage.setItem('worker_active_since', String(now));
    localStorage.setItem('worker_active_until', String(until));
    setIsActive(true);
    setRemaining(ACTIVE_MS);
  };

  const handleDeactivate = () => {
    localStorage.removeItem('worker_active_since');
    localStorage.removeItem('worker_active_until');
    setIsActive(false);
    setRemaining(0);
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>⏳ Loading worker dashboard...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: '#b91c1c' }}>❌ {error}</div>;
  }

  const statusColor = worker?.status === 'active' ? '#065f46' : '#92400e';
  const statusBg = worker?.status === 'active' ? '#d1fae5' : '#fef3c7';
  const isPending = worker?.approvalStatus !== 'approved' || worker?.status !== 'active';

  return (
    <main style={{ maxWidth: 900, margin: '20px auto', padding: 20 }} aria-label="Worker Dashboard">
      {lastWorkType && (
        <div style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#7C3AED', fontSize: 13 }}>🔧 Last work type: <strong>{lastWorkType}</strong></span>
          <button onClick={() => navigate('/worker/open-work')} style={{ background: purple, color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }} aria-label="Find more work">
            Find More
          </button>
        </div>
      )}

      <h2 style={{ marginBottom: 14 }}>👷 Worker Dashboard</h2>

      {isPending && (
        <div style={{ marginBottom: 14, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 10, padding: 12, fontSize: 13, fontWeight: 600 }}>
          ⏳ Pending Approval: Your account is not fully active. Please contact your mason/region lead.
        </div>
      )}

      {/* Active Status Toggle */}
      <div style={{ background: isActive ? '#f0fdf4' : '#fafafa', border: `1px solid ${isActive ? '#86efac' : '#e5e7eb'}`, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: isActive ? '#065f46' : '#374151' }}>
            {isActive ? '🟢 You are Active' : '⚫ You are Inactive'}
          </p>
          {isActive && remaining > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Active for {formatCountdown(remaining)} remaining</p>
          )}
        </div>
        {isActive ? (
          <button onClick={handleDeactivate} style={{ padding: '8px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }} aria-label="Deactivate your availability">
            Deactivate
          </button>
        ) : (
          <button onClick={handleActivate} style={{ padding: '8px 18px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }} aria-label={`Activate availability for ${ACTIVE_HOURS} hours`}>
            Activate ({ACTIVE_HOURS}h)
          </button>
        )}
      </div>

      {/* Worker Info */}
      <div style={{ background: 'white', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{worker?.name || 'Worker'}</h3>
          <span style={{ background: statusBg, color: statusColor, padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
            {worker?.status || 'inactive'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div><strong>Phone:</strong> {worker?.phone || '-'}</div>
          <div><strong>Email:</strong> {worker?.email || '-'}</div>
          <div><strong>Service:</strong> {worker?.gigType || '-'}</div>
          <div><strong>Area:</strong> {worker?.area || '-'}</div>
          <div><strong>Approval:</strong> {worker?.approvalStatus || 'pending'}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[{ label: 'Total Works', value: worker?.totalWorks || 0 }, { label: 'Rating', value: worker?.rating ? `${worker.rating}★` : 'N/A' }, { label: 'Earnings', value: worker?.earnings || '₹0' }].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: purple }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Navigation Cards – horizontal scroll snap */}
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Quick Access</h3>
      <div
        style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 8 }}
        role="list"
        aria-label="Worker navigation shortcuts"
      >
        {NAV_CARDS.map(card => (
          <button
            key={card.path}
            role="listitem"
            onClick={() => navigate(card.path)}
            style={{ flexShrink: 0, scrollSnapAlign: 'start', minWidth: 120, background: '#fff', border: `2px solid ${purple}`, borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center' }}
            aria-label={`Go to ${card.label}`}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }}>{card.label.split(' ')[0]}</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#374151' }}>{card.label.replace(/^[^\s]+\s/, '')}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{card.desc}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
