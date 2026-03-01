import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Admin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalWorkers: 0,
    activeBookings: 0,
    completedBookings: 0,
    totalEarnings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Get workers count
    const workersQuery = query(collection(db, 'gig_workers'), where('adminId', '==', user.uid));
    const unsubWorkers = onSnapshot(workersQuery, (snap) => {
      setStats(prev => ({ ...prev, totalWorkers: snap.size }));
    });

    // Get active bookings
    const activeBookingsQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', 'in', ['assigned', 'in_progress', 'awaiting_confirmation'])
    );
    const unsubActive = onSnapshot(activeBookingsQuery, (snap) => {
      setStats(prev => ({ ...prev, activeBookings: snap.size }));
    });

    // Get completed bookings
    const completedQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', '==', 'completed')
    );
    const unsubCompleted = onSnapshot(completedQuery, (snap) => {
      setStats(prev => ({ ...prev, completedBookings: snap.size }));
      setStats(prev => ({ ...prev, totalEarnings: snap.size * 200 }));
    });

    setLoading(false);

    return () => {
      unsubWorkers();
      unsubActive();
      unsubCompleted();
    };
  }, []);

  const dashboardCards = [
    { title: 'Workers', value: stats.totalWorkers, icon: '👨‍🔧', color: '#667eea', path: '/admin/workers' },
    { title: 'Active Jobs', value: stats.activeBookings, icon: '⏳', color: '#f59e0b', path: '/admin/bookings' },
    { title: 'Completed', value: stats.completedBookings, icon: '✓', color: '#10b981', path: '#' },
    { title: 'Earnings', value: `₹${stats.totalEarnings}`, icon: '💰', color: '#8b5cf6', path: '#' }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 10px 0', color: '#333' }}>
          👨‍💼 Admin Dashboard
        </h1>
        <p style={{ color: '#666', margin: 0 }}>Manage your service business and workers</p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        {dashboardCards.map((card, idx) => (
          <button
            key={idx}
            onClick={() => card.path !== '#' && navigate(card.path)}
            style={{
              padding: '25px',
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
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>{card.icon}</div>
            <div style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>
              {card.title}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: card.color }}>
              {card.value}
            </div>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{
        backgroundColor: '#f0f4ff',
        padding: '30px',
        borderRadius: '12px',
        border: '1px solid #dde1ff',
        marginBottom: '30px'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#333' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <button
            onClick={() => navigate('/admin/workers')}
            style={{
              padding: '12px 20px',
              backgroundColor: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            👨‍🔧 Manage Workers
          </button>
          <button
            onClick={() => navigate('/admin/bookings')}
            style={{
              padding: '12px 20px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            📋 View All Bookings
          </button>
          <button
            onClick={() => navigate('/admin/workers')}
            style={{
              padding: '12px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            ➕ Add New Worker
          </button>
        </div>
      </div>

      {/* Tips Section */}
      <div style={{
        backgroundColor: '#fff3cd',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #ffeeba',
        borderLeft: '4px solid #ff9800'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>
          💡 Tips for managing your business:
        </h4>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404', fontSize: '14px', lineHeight: '1.8' }}>
          <li>Create workers with their phone numbers and specialties</li>
          <li>Assign bookings to available workers quickly</li>
          <li>Track job progress in real-time</li>
          <li>Mark jobs as complete and track earnings</li>
          <li>Disable workers when they're unavailable</li>
        </ul>
      </div>
    </div>
  );
}
