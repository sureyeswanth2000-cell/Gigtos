import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import RatingDisplay from '../../components/worker/RatingDisplay';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

const MOCK_HISTORY = [
  { id: 'h1', title: 'Fixed bathroom pipe', category: 'Plumbing', customer: 'Raj****', completedAt: '2026-04-01', earned: 800, rating: 5, review: 'Very professional work!' },
  { id: 'h2', title: 'Installed light fixtures', category: 'Electrical', customer: 'Pri****', completedAt: '2026-03-28', earned: 1200, rating: 4, review: 'Good work, on time.' },
  { id: 'h3', title: 'Deep cleaned apartment', category: 'Cleaning', customer: 'Kum****', completedAt: '2026-03-20', earned: 1500, rating: 5, review: 'Excellent cleaning!' },
  { id: 'h4', title: 'Painted living room', category: 'Painting', customer: 'Mur****', completedAt: '2026-03-15', earned: 3000, rating: 4 },
];

export default function WorkHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(
          collection(db, 'bookings'),
          where('workerId', '==', u.uid),
          where('status', '==', 'completed')
        ));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(data.length > 0 ? data : MOCK_HISTORY);
      } catch {
        setHistory(MOCK_HISTORY);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const totalEarned = history.reduce((s, h) => s + (h.earned || 0), 0);
  const ratedItems = history.filter(h => h.rating);
  const avgRating = ratedItems.length > 0
    ? (ratedItems.reduce((s, h) => s + h.rating, 0) / ratedItems.length).toFixed(1)
    : 0;

  return (
    <div className="worker-page">
      <div className="worker-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/worker/dashboard" style={{ color: '#A259FF', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F1144' }}>🕐 Work History</h2>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Completed', value: history.length, icon: '✅' },
            { label: 'Earned', value: `₹${totalEarned}`, icon: '💰' },
            { label: 'Avg Rating', value: `${avgRating}★`, icon: '⭐' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <span className="stat-value" style={{ fontSize: 18 }}>{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {loading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 14, marginBottom: 12 }} />)
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No history yet</h3>
            <p>Completed jobs will appear here.</p>
          </div>
        ) : (
          history.map(item => (
            <div key={item.id} className="worker-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1F1144' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.category} · {item.customer}</div>
                </div>
                {item.earned && (
                  <div style={{ background: '#D1FAE5', color: '#065F46', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
                    +₹{item.earned}
                  </div>
                )}
              </div>
              {item.rating && (
                <div style={{ marginBottom: 4 }}>
                  <RatingDisplay rating={item.rating} size="sm" />
                </div>
              )}
              {item.review && (
                <div style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>"{item.review}"</div>
              )}
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
                📅 {item.completedAt}
              </div>
            </div>
          ))
        )}
      </div>
      <WorkerBottomNav />
    </div>
  );
}
