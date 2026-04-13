import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Admin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalWorkers: 0,
    activeBookings: 0,
    completedBookings: 0,
    totalEarnings: 0,
    workerPayouts: 0,
    topListedWorkers: 0,
  });
  const [regionPerf, setRegionPerf] = useState({
    regionScore: 100,
    totalDisputes: 0,
    fraudCount: 0,
    avgResolutionTime: 0,
    probationStatus: false,
    regionStatus: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const adminDocRef = doc(db, 'admins', user.uid);
    const unsubAdmin = onSnapshot(adminDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRegionPerf({
          regionScore: data.regionScore ?? 100,
          totalDisputes: data.totalDisputes ?? 0,
          fraudCount: data.fraudCount ?? 0,
          avgResolutionTime: data.avgResolutionTime ?? 0,
          probationStatus: data.probationStatus ?? false,
          regionStatus: data.regionStatus ?? 'active',
        });
        setIsSuperAdmin(data.role === 'superadmin');
      }
    });

    const workersQuery = query(collection(db, 'gig_workers'), where('adminId', '==', user.uid));
    const unsubWorkers = onSnapshot(workersQuery, (snap) => {
      const workers = snap.docs.map(d => d.data());
      setStats(prev => ({
        ...prev,
        totalWorkers: snap.size,
        topListedWorkers: workers.filter(w => w.isTopListed).length,
      }));
    });

    const activeBookingsQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', 'in', ['assigned', 'in_progress', 'awaiting_confirmation'])
    );
    const unsubActive = onSnapshot(activeBookingsQuery, (snap) => {
      setStats(prev => ({ ...prev, activeBookings: snap.size }));
    });

    const completedQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', '==', 'completed')
    );
    const unsubCompleted = onSnapshot(completedQuery, (snap) => {
      const count = snap.size;
      setStats(prev => ({
        ...prev,
        completedBookings: count,
        totalEarnings: count * 20,
        workerPayouts: count * 80,
      }));
    });

    setLoading(false);

    return () => {
      unsubAdmin();
      unsubWorkers();
      unsubActive();
      unsubCompleted();
    };
  }, []);

  const getScoreColor = (score) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--error)';
  };

  const dashboardCards = [
    { title: 'Total Workers', value: stats.totalWorkers, icon: '👷', color: 'var(--primary-purple)', path: '/admin/workers' },
    { title: 'Top Rated', value: stats.topListedWorkers, icon: '⭐', color: 'var(--warning)', path: '/admin/workers' },
    { title: 'Active Jobs', value: stats.activeBookings, icon: '⚡', color: 'var(--secondary-green)', path: '/admin/bookings' },
    { title: 'My Earnings', value: `₹${stats.totalEarnings}`, icon: '💰', color: 'var(--primary-purple)', path: '#' },
    { title: 'Payouts', value: `₹${stats.workerPayouts}`, icon: '💸', color: 'var(--success)', path: '#' },
  ];

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-main)', background: 'var(--bg-main)', minHeight: '100vh' }}>⏳ Loading dashboard...</div>;
  }

  return (
    <div className="dash-container" style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '40px 20px' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto' }}>
        
        {/* Header Section */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 850, color: 'var(--text-main)', margin: 0, letterSpacing: '-1px' }}>
              Admin Console
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginTop: 4 }}>Operations Overview</p>
          </div>
          <button 
            onClick={() => navigate('/admin/ai-instructions')}
            className="btn-primary"
            style={{ 
              background: 'linear-gradient(135deg, var(--primary-purple) 0%, #a855f7 100%)',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            🧠 AI Brain Config
          </button>
        </header>

        {/* Critical Alerts */}
        {(regionPerf.probationStatus || regionPerf.regionStatus === 'suspended') && (
          <div style={{ marginBottom: 32 }}>
            {regionPerf.probationStatus && (
              <div className="job-card" style={{ 
                background: 'var(--warning-bg)', 
                borderColor: 'var(--warning)', 
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 16
              }}>
                <span style={{ fontSize: 24 }}>⚠️</span>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--warning)', fontWeight: 800 }}>Probation Active</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-main)', opacity: 0.8 }}>High dispute rate detected (>15%). Approvals restricted.</p>
                </div>
              </div>
            )}
            {regionPerf.regionStatus === 'suspended' && (
              <div className="job-card" style={{ 
                background: 'var(--error-bg)', 
                borderColor: 'var(--error)', 
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16
              }}>
                <span style={{ fontSize: 24 }}>🚫</span>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--error)', fontWeight: 800 }}>Region Suspended</h4>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-main)', opacity: 0.8 }}>Operations halted by SuperAdmin. Contact support.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Region Score Section */}
        <div className="job-card" style={{ padding: 32, marginBottom: 40, background: 'var(--glass-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text-main)', fontWeight: 800 }}>Region Performance</h3>
            <span style={{ 
              padding: '4px 12px', 
              borderRadius: 'var(--radius-pill)', 
              fontSize: 12, 
              fontWeight: 800, 
              background: 'var(--bg-soft)', 
              color: 'var(--text-muted)' 
            }}>WEEKLY UPDATE</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 48, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: 64, 
                fontWeight: 900, 
                color: getScoreColor(regionPerf.regionScore),
                lineHeight: 1
              }}>
                {regionPerf.regionScore}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginTop: 8 }}>PLATFORM SCORE</div>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Disputes', value: regionPerf.totalDisputes, status: regionPerf.totalDisputes > 5 ? 'error' : 'success' },
                  { label: 'Fraud Detection', value: regionPerf.fraudCount, status: regionPerf.fraudCount > 0 ? 'error' : 'success' },
                  { label: 'Resolution Time', value: regionPerf.avgResolutionTime ? `${regionPerf.avgResolutionTime}h` : '—', status: 'normal' },
                ].map(m => (
                  <div key={m.label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ 
                      fontSize: 24, 
                      fontWeight: 800, 
                      color: m.status === 'error' ? 'var(--error)' : 'var(--text-main)' 
                    }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 6, background: 'var(--bg-soft)', borderRadius: 3, marginTop: 24, overflow: 'hidden' }}>
                <div style={{ 
                  height: '100%', 
                  width: `${regionPerf.regionScore}%`, 
                  background: getScoreColor(regionPerf.regionScore),
                  borderRadius: 3,
                  transition: 'width 1s ease-out'
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: 20, 
          marginBottom: 48 
        }}>
          {dashboardCards.map((card, idx) => (
            <button
              key={idx}
              onClick={() => card.path !== '#' && navigate(card.path)}
              className="job-card"
              style={{ 
                padding: 24, 
                textAlign: 'center', 
                borderTop: `4px solid ${card.color}`,
                cursor: card.path !== '#' ? 'pointer' : 'default',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{card.icon}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{card.title}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-main)' }}>{card.value}</div>
            </button>
          ))}
        </div>

        {/* Quick Actions & Tips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 32 }}>
          <div className="job-card" style={{ padding: 32, background: 'var(--primary-purple-glow)', borderColor: 'var(--primary-purple)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>⚡ Quick Commands</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <button onClick={() => navigate('/admin/workers')} className="btn-primary" style={{ padding: 14 }}>Manage Pro's</button>
              <button onClick={() => navigate('/admin/bookings')} className="btn-glass" style={{ padding: 14, background: 'var(--bg-soft)' }}>Bookings</button>
              <button onClick={() => navigate('/admin/workers')} className="btn-secondary" style={{ padding: 14 }}>Add Worker</button>
              {isSuperAdmin && (
                <button onClick={() => navigate('/admin/super')} className="btn-primary" style={{ padding: 14, background: 'var(--text-main)', color: 'var(--bg-main)' }}>Shield Panel</button>
              )}
            </div>
          </div>

          <div className="job-card" style={{ padding: 32 }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>💡 Pro Tips</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Resolve disputes < 24h for score bonus.',
                'Top-Listed status increases job flow.',
                'Keep dispute rate < 15% to avoid probation.',
                'Monitor region performance daily.'
              ].map((tip, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>
                  <span style={{ color: 'var(--primary-purple)' }}>●</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
