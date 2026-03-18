import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
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

    console.log('📊 Loading admin stats for UID:', user.uid);

    // Fetch admin profile for region performance + role check
    const adminDocRef = doc(db, 'admins', user.uid);
    const unsubAdmin = onSnapshot(adminDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log('🔐 Admin role:', data.role);
        console.log('📍 Admin is region lead?', data.role === 'regionLead');
        setRegionPerf({
          regionScore: data.regionScore ?? 100,
          totalDisputes: data.totalDisputes ?? 0,
          fraudCount: data.fraudCount ?? 0,
          avgResolutionTime: data.avgResolutionTime ?? 0,
          probationStatus: data.probationStatus ?? false,
          regionStatus: data.regionStatus ?? 'active',
        });
        setIsSuperAdmin(data.role === 'superadmin');
      } else {
        console.error('❌ Admin document not found for UID:', user.uid);
      }
    });

    // Workers count + top-listed
    const workersQuery = query(collection(db, 'gig_workers'), where('adminId', '==', user.uid));
    const unsubWorkers = onSnapshot(workersQuery, (snap) => {
      console.log('👷 Workers found:', snap.size);
      const workers = snap.docs.map(d => d.data());
      setStats(prev => ({
        ...prev,
        totalWorkers: snap.size,
        topListedWorkers: workers.filter(w => w.isTopListed).length,
      }));
    });

    // Active bookings
    const activeBookingsQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', 'in', ['assigned', 'in_progress', 'awaiting_confirmation'])
    );
    const unsubActive = onSnapshot(activeBookingsQuery, (snap) => {
      console.log('⚡ Active bookings:', snap.size);
      setStats(prev => ({ ...prev, activeBookings: snap.size }));
    });

    // Completed bookings + earnings
    const completedQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', '==', 'completed')
    );
    const unsubCompleted = onSnapshot(completedQuery, (snap) => {
      console.log('✅ Completed bookings:', snap.size);
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
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const dashboardCards = [
    { title: 'Workers', value: stats.totalWorkers, icon: '👨‍🔧', color: '#667eea', path: '/admin/workers' },
    { title: 'Top Listed', value: stats.topListedWorkers, icon: '⭐', color: '#f59e0b', path: '/admin/workers' },
    { title: 'Active Jobs', value: stats.activeBookings, icon: '⏳', color: '#f59e0b', path: '/admin/bookings' },
    { title: 'My Earnings', value: `₹${stats.totalEarnings}`, icon: '💰', color: '#8b5cf6', path: '#' },
    { title: 'Worker Payouts', value: `₹${stats.workerPayouts}`, icon: '💸', color: '#10b981', path: '#' },
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 10px 0', color: '#333' }}>
          👨‍💼 Admin Dashboard
        </h1>
        <p style={{ color: '#666', margin: 0 }}>Manage your service business and workers</p>
      </div>

      {/* ═══ Probation Alert Banner ═══ */}
      {regionPerf.probationStatus && (
        <div style={{
          padding: '16px 20px', marginBottom: '25px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #f59e0b',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 'bold', color: '#92400e', fontSize: '15px' }}>
              Probation Notice
            </div>
            <div style={{ color: '#a16207', fontSize: '13px' }}>
              Your dispute rate exceeds 15% in the last 30 days. New worker approvals are temporarily restricted.
              Resolve pending disputes promptly to improve your region score.
            </div>
          </div>
        </div>
      )}

      {regionPerf.regionStatus === 'suspended' && (
        <div style={{
          padding: '16px 20px', marginBottom: '25px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
          border: '2px solid #ef4444',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '28px' }}>🚫</span>
          <div>
            <div style={{ fontWeight: 'bold', color: '#991b1b', fontSize: '15px' }}>
              Region Suspended
            </div>
            <div style={{ color: '#b91c1c', fontSize: '13px' }}>
              Your region has been suspended by SuperAdmin. Contact support for reinstatement.
            </div>
          </div>
        </div>
      )}

      {/* ═══ Region Performance Score Card ═══ */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '24px',
        marginBottom: '30px', border: '1px solid #e2e8f0',
        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#475569' }}>
          📊 Region Performance Score
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
          {/* Score Gauge */}
          <div style={{ textAlign: 'center', minWidth: '100px' }}>
            <div style={{
              fontSize: '48px', fontWeight: 'bold',
              color: getScoreColor(regionPerf.regionScore),
              lineHeight: '1',
            }}>
              {regionPerf.regionScore}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>out of 100</div>
            {/* Progress bar */}
            <div style={{ width: '120px', height: '8px', background: '#f1f5f9', borderRadius: '4px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{
                width: `${regionPerf.regionScore}%`, height: '100%',
                background: getScoreColor(regionPerf.regionScore),
                borderRadius: '4px', transition: 'width 0.5s ease',
              }} />
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', flex: 1 }}>
            {[
              { label: 'Total Disputes', value: regionPerf.totalDisputes, color: regionPerf.totalDisputes > 5 ? '#ef4444' : '#475569' },
              { label: 'Fraud Cases', value: regionPerf.fraudCount, color: regionPerf.fraudCount > 0 ? '#ef4444' : '#475569' },
              { label: 'Avg Resolution', value: regionPerf.avgResolutionTime ? `${regionPerf.avgResolutionTime}h` : '—', color: regionPerf.avgResolutionTime > 24 ? '#ef4444' : '#475569' },
            ].map((m, i) => (
              <div key={i}>
                <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>{m.label}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '16px',
        marginBottom: '30px'
      }}>
        {dashboardCards.map((card, idx) => (
          <button
            key={idx}
            onClick={() => card.path !== '#' && navigate(card.path)}
            style={{
              padding: '20px',
              backgroundColor: 'white',
              border: `2px solid ${card.color}`,
              borderRadius: '12px',
              cursor: card.path !== '#' ? 'pointer' : 'default',
              textAlign: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              if (card.path !== '#') {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-5px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>{card.icon}</div>
            <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>
              {card.title}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: card.color }}>
              {card.value}
            </div>
          </button>
        ))}
      </div>

      {/* Account Status */}
      <div style={{
        backgroundColor: '#fff', padding: '20px', borderRadius: '12px',
        border: '1px solid #eee', marginBottom: '30px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            backgroundColor: regionPerf.regionStatus === 'active' && !regionPerf.probationStatus ? '#10b981' :
              regionPerf.probationStatus ? '#f59e0b' : '#ef4444'
          }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
              Account Status: {regionPerf.regionStatus === 'suspended' ? '🚫 Suspended' :
                regionPerf.probationStatus ? '⚠️ Probation' : '✅ Active'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {regionPerf.probationStatus ? 'Dispute rate exceeded 15%. Resolve disputes to exit probation.' :
                regionPerf.regionStatus === 'suspended' ? 'Contact SuperAdmin for reinstatement.' :
                  'Your admin account is in good standing'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin/super')}
              style={{
                padding: '8px 16px', backgroundColor: '#7c3aed',
                border: 'none', color: 'white', borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px', fontWeight: '600'
              }}
            >
              🛡️ SuperAdmin Panel
            </button>
          )}
          <button
            onClick={() => alert('Multi-admin hierarchy management coming soon!')}
            style={{
              padding: '8px 16px', backgroundColor: 'transparent',
              border: '1px solid #667eea', color: '#667eea',
              borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600'
            }}
          >
            🌐 Manage Hierarchy
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        backgroundColor: '#f0f4ff', padding: '30px', borderRadius: '12px',
        border: '1px solid #dde1ff', marginBottom: '30px'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#333' }}>
          ⚡ Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <button onClick={() => navigate('/admin/workers')}
            style={{ padding: '12px 20px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            👨‍🔧 Manage Workers
          </button>
          <button onClick={() => navigate('/admin/bookings')}
            style={{ padding: '12px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            📋 View All Bookings
          </button>
          <button onClick={() => navigate('/admin/workers')}
            style={{ padding: '12px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            ➕ Add New Worker
          </button>
        </div>
      </div>

      {/* Tips */}
      <div style={{
        backgroundColor: '#fff3cd', padding: '20px', borderRadius: '8px',
        border: '1px solid #ffeeba', borderLeft: '4px solid #ff9800'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>
          💡 Tips for managing your business:
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404', fontSize: '14px', lineHeight: '1.8' }}>
          <li>Resolve disputes within 24 hours to maintain your region score</li>
          <li>Workers get "Top Listed" status after 3 completed jobs</li>
          <li>Keep your dispute rate below 15% to avoid probation</li>
          <li>Log calls and visits for 1-star disputes immediately</li>
          <li>Monitor your region score — below 60 risks suspension</li>
        </ul>
      </div>
    </div>
  );
}
