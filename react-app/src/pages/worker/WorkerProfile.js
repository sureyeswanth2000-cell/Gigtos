import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import RatingDisplay from '../../components/worker/RatingDisplay';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

const MOCK_REVIEWS = [
  { id: 1, reviewer: 'Raj****', rating: 5, comment: "Excellent work! Very professional.", date: '2026-04-01' },
  { id: 2, reviewer: 'Pri****', rating: 4, comment: 'Good job, arrived on time.', date: '2026-03-28' },
  { id: 3, reviewer: 'Kum****', rating: 5, comment: "Best service I've had!", date: '2026-03-20' },
];

export default function WorkerProfile() {
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (snap.exists()) setWorker({ ...snap.data(), uid: u.uid });
      } catch {}
      finally { setLoading(false); }
    });
    return () => unsub();
  }, []);

  const rating = worker?.rating || 4.5;
  const totalReviews = worker?.reviewCount || MOCK_REVIEWS.length;
  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: MOCK_REVIEWS.filter(r => r.rating === star).length,
    pct: Math.round((MOCK_REVIEWS.filter(r => r.rating === star).length / totalReviews) * 100)
  }));

  const initials = (worker?.name || 'W').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div className="skeleton" style={{ height: 200, borderRadius: 14, marginBottom: 14 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 14, marginBottom: 14 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="worker-page">
      <div className="worker-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/worker/dashboard" style={{ color: '#A259FF', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F1144' }}>👤 My Profile</h2>
        </div>

        {/* Profile Header */}
        <div className="worker-card" style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #7C3AED, #A259FF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, fontWeight: 700, color: 'white',
            margin: '0 auto 12px'
          }}>
            {initials}
          </div>
          <h3 style={{ margin: '0 0 4px', fontSize: 20, color: '#1F1144' }}>{worker?.name || 'Worker'}</h3>
          <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 8 }}>
            {(worker?.gigTypes && worker.gigTypes.length > 0)
              ? worker.gigTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')).join(', ')
              : (worker?.gigType || 'General Worker')
            }
          </div>
          <RatingDisplay rating={rating} size="md" />
          <div style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>({totalReviews} reviews)</div>
          <Link
            to="/profile"
            style={{
              display: 'inline-block',
              marginTop: 14,
              padding: '8px 20px',
              background: '#F5F3FF',
              color: '#7C3AED',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              border: '1px solid #E9D5FF'
            }}
          >
            ✏️ Edit Profile
          </Link>
        </div>

        {/* Info */}
        <div className="worker-card">
          <h4 style={{ margin: '0 0 12px', color: '#1F1144' }}>📋 Details</h4>
          {[
            { label: 'Phone', value: worker?.phone },
            { label: 'Email', value: worker?.email },
            { label: 'Area', value: worker?.area },
            { label: 'Status', value: worker?.approvalStatus },
            { label: 'Member Since', value: worker?.createdAt ? new Date(worker.createdAt).getFullYear() : '2026' },
          ].map(row => row.value ? (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F3F4F6', fontSize: 14 }}>
              <span style={{ color: '#6B7280' }}>{row.label}</span>
              <span style={{ fontWeight: 600, color: '#1F1144' }}>{row.value}</span>
            </div>
          ) : null)}
          {(worker?.gigTypes?.length > 0 || worker?.gigType) && (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 6 }}>Skills/Job Types</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(worker.gigTypes?.length > 0 ? worker.gigTypes : [worker.gigType]).filter(Boolean).map(t => (
                  <span key={t} style={{ background: '#EDE9FE', color: '#7C3AED', padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                    {t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')}
                  </span>
                ))}
              </div>
              <Link to="/worker/job-selection" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
                ✏️ Edit Job Types
              </Link>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Completed', value: worker?.completedJobs || 0, icon: '✅' },
            { label: 'Active Hours\nThis Week', value: '24h', icon: '⏱️' },
            { label: 'Rating', value: `${rating}★`, icon: '⭐' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <span className="stat-value" style={{ fontSize: 18 }}>{s.value}</span>
              <span className="stat-label" style={{ whiteSpace: 'pre-line' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Rating Breakdown */}
        <div className="worker-card">
          <h4 style={{ margin: '0 0 12px', color: '#1F1144' }}>⭐ Rating Breakdown</h4>
          {ratingBreakdown.map(({ star, count, pct }) => (
            <div key={star} className="rating-bar-row">
              <span style={{ fontSize: 13, color: '#6B7280', width: 20 }}>{star}★</span>
              <div className="rating-bar-track">
                <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span style={{ fontSize: 13, color: '#6B7280', width: 24, textAlign: 'right' }}>{count}</span>
            </div>
          ))}
        </div>

        {/* Recent Reviews */}
        <h3 className="section-title">💬 Recent Reviews</h3>
        {MOCK_REVIEWS.map(review => (
          <div key={review.id} className="worker-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1F1144' }}>{review.reviewer}</div>
              <RatingDisplay rating={review.rating} size="sm" showNumber={false} />
            </div>
            {review.comment && <div style={{ fontSize: 14, color: '#6B7280', fontStyle: 'italic' }}>"{review.comment}"</div>}
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>📅 {review.date}</div>
          </div>
        ))}
      </div>
      <WorkerBottomNav />
    </div>
  );
}
