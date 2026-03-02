import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function Admin() {
  const navigate = useNavigate();
  // State to hold comprehensive dashboard statistics
  const [stats, setStats] = useState({
    totalWorkers: 0, // Total number of service providers
    activeBookings: 0, // Bookings currently in progress or assigned
    completedBookings: 0, // Total successfully finished jobs
    totalEarnings: 0, // Sum of local admin commissions (₹20 per job)
    workerPayouts: 0, // Sum of worker shares (₹80 per job)
    gigtoShare: 0 // Sum of platform fees (₹50 per job)
  });
  const [loading, setLoading] = useState(true); // Loading state for initial data fetch

  useEffect(() => {
    // Current authenticated user session
    const user = auth.currentUser;
    if (!user) return; // Exit if not logged in

    // Subscription for workers count assigned to this admin
    const workersQuery = query(collection(db, 'gig_workers'), where('adminId', '==', user.uid));
    const unsubWorkers = onSnapshot(workersQuery, (snap) => {
      // Update worker count in state
      setStats(prev => ({ ...prev, totalWorkers: snap.size }));
    });

    // Subscription for active bookings management
    const activeBookingsQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', 'in', ['assigned', 'in_progress', 'awaiting_confirmation'])
    );
    const unsubActive = onSnapshot(activeBookingsQuery, (snap) => {
      // Update active bookings count in state
      setStats(prev => ({ ...prev, activeBookings: snap.size }));
    });

    // Subscription for completed bookings and commission tracking
    const completedQuery = query(
      collection(db, 'bookings'),
      where('adminId', '==', user.uid),
      where('status', '==', 'completed')
    );
    const unsubCompleted = onSnapshot(completedQuery, (snap) => {
      const count = snap.size; // Total completed jobs
      setStats(prev => ({
        ...prev,
        completedBookings: count,
        totalEarnings: count * 20, // Local admin gets ₹20 per ₹150 job
        workerPayouts: count * 80, // Worker gets ₹80 per ₹150 job
        gigtoShare: count * 50 // Gigto platform gets ₹50 per ₹150 job
      }));
    });

    setLoading(false); // Mark loading as finished

    // Cleanup listeners on component unmount
    return () => {
      unsubWorkers();
      unsubActive();
      unsubCompleted();
    };
  }, []);

  // Configuration for dashboard stats display
  const dashboardCards = [
    { title: 'Workers', value: stats.totalWorkers, icon: '👨‍🔧', color: '#667eea', path: '/admin/workers' }, // Link to worker management
    { title: 'Active Jobs', value: stats.activeBookings, icon: '⏳', color: '#f59e0b', path: '/admin/bookings' }, // Link to booking flow
    { title: 'My Earnings', value: `₹${stats.totalEarnings}`, icon: '💰', color: '#8b5cf6', path: '#' }, // Local admin share
    { title: 'Worker Payouts', value: `₹${stats.workerPayouts}`, icon: '💸', color: '#10b981', path: '#' }, // Total paid to workers
    { title: 'Gigto Share', value: `₹${stats.gigtoShare}`, icon: '🏢', color: '#ef4444', path: '#' } // Platform cut
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {/* Dashboard Main Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 10px 0', color: '#333' }}>
          👨‍💼 Admin Dashboard
        </h1>
        <p style={{ color: '#666', margin: 0 }}>Manage your service business and workers</p>
      </div>

      {/* Grid for Interactive Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '20px',
        marginBottom: '40px'
      }}>
        {dashboardCards.map((card, idx) => (
          <button
            key={idx}
            onClick={() => card.path !== '#' && navigate(card.path)} // Trigger navigation if path is set
            style={{
              padding: '20px',
              backgroundColor: 'white',
              border: `2px solid ${card.color}`,
              borderRadius: '12px',
              cursor: card.path !== '#' ? 'pointer' : 'default', // Only show pointer for actionable cards
              textAlign: 'center',
              transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={(e) => {
              if (card.path !== '#') {
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-5px)'; // Hover lift effect
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)'; // Reset lift effect
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

      {/* Admin Account Status & Hierarchy Overview */}
      <div style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #eee',
        marginBottom: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Left side: Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#10b981' // Green circle for active status
          }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Account Status: Active</div>
            <div style={{ fontSize: '12px', color: '#666' }}>Your admin account is in good standing</div>
          </div>
        </div>

        {/* Right side: Hierarchy link */}
        <button
          onClick={() => alert('Multi-admin hierarchy management coming soon!')} // Placeholder for zone management
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: '1px solid #667eea',
            color: '#667eea',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          🌐 Manage Hierarchy
        </button>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div style={{
        backgroundColor: '#f0f4ff', // Light blue background for emphasis
        padding: '30px',
        borderRadius: '12px',
        border: '1px solid #dde1ff',
        marginBottom: '30px'
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#333' }}>
          ⚡ Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Navigate to worker database */}
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
          {/* Navigate to booking management */}
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
          {/* Shortcut to add new worker */}
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
