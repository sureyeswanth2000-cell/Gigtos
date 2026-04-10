import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { WorkerLocationProvider } from '../../context/WorkerLocationContext';
import ActiveStatusButton from '../../components/worker/ActiveStatusButton';
import WorkerStatsCard from '../../components/worker/WorkerStatsCard';
import RatingDisplay from '../../components/worker/RatingDisplay';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import WorkerLocationTracker from '../../components/worker/WorkerLocationTracker';
import '../../styles/worker-dashboard.css';

const NAV_CARDS = [
  { to: '/worker/open-work', icon: '📋', label: 'Open Work' },
  { to: '/worker/history', icon: '🕐', label: 'History' },
  { to: '/worker/future-work', icon: '📅', label: 'Future Work' },
  { to: '/worker/profile', icon: '👤', label: 'My Profile' },
  { to: '/worker/support', icon: '💬', label: 'Support' },
  { to: '/worker/map', icon: '🗺️', label: 'Map' },
];

export default function WorkerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate('/auth'); return; }
      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (!snap.exists()) {
          setError('Worker account not found.');
          setLoading(false);
          return;
        }
        setWorker({ ...snap.data(), uid: u.uid });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleStatusChange = useCallback((active) => {
    setIsActive(active);
  }, []);

  if (loading) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div className="worker-header-section">
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 160, height: 20, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
          </div>
          <div className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 10 }} />
          <div className="stats-row">
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <p style={{ color: '#b91c1c' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = (worker?.name || 'W').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPending = worker?.approvalStatus !== 'approved';

  const stats = {
    completed: worker?.completedJobs || 0,
    pending: worker?.pendingJobs || 0,
    rating: worker?.rating || 0,
    earnings: worker?.totalEarnings || 0,
  };

  return (
    <WorkerLocationProvider>
    <div className="worker-page">
      <div className="worker-container">
        {/* Header */}
        <div className="worker-header-section">
          <div className="worker-avatar">{initials}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{worker?.name || 'Worker'}</div>
          <RatingDisplay rating={stats.rating} size="sm" />
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {worker?.gigType || 'General Worker'} · {worker?.area || 'Unknown Area'}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isActive ? '#34D399' : '#FCD34D',
              boxShadow: isActive ? '0 0 0 3px rgba(52,211,153,0.3)' : '0 0 0 3px rgba(252,211,77,0.3)'
            }} />
            <span style={{ fontSize: 13, opacity: 0.9 }}>
              {isActive ? 'Active & visible to customers' : 'Offline'}
            </span>
          </div>
        </div>

        {isPending && (
          <div className="worker-card" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: 14 }}>
            <div style={{ color: '#C2410C', fontWeight: 600, fontSize: 14 }}>
              ⏳ Approval Pending
            </div>
            <p style={{ color: '#9A3412', fontSize: 13, margin: '4px 0 0' }}>
              Your account is pending approval by your region lead. Some features may be limited.
            </p>
          </div>
        )}

        {/* Active Status */}
        <ActiveStatusButton onStatusChange={handleStatusChange} />

        {/* Worker Location Tracker — shown when worker is active */}
        <WorkerLocationTracker />

        {/* Stats */}
        <WorkerStatsCard stats={stats} />

        {/* Navigation Cards */}
        <h3 className="section-title">My Dashboard</h3>
        <div className="nav-cards-grid">
          {NAV_CARDS.map(card => (
            <Link key={card.to} to={card.to} className="nav-card">
              <span className="nav-card-icon">{card.icon}</span>
              <span className="nav-card-label">{card.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <WorkerBottomNav />
    </div>
    </WorkerLocationProvider>
  );
}
