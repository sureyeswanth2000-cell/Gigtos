import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Plumber', 'Electrician', 'Carpenter', 'Painter', 'Driver', 'Helper', 'Mason', 'Cleaner'];

const MOCK_BOOKINGS = [
  { id: 'b1', service: 'Plumbing', worker: 'Suresh R.', date: '15 Jan 2025', status: 'Completed', amount: '₹650' },
  { id: 'b2', service: 'Electrical', worker: 'Prasad M.', date: '22 Jan 2025', status: 'Scheduled', amount: '₹1200' },
  { id: 'b3', service: 'Carpentry', worker: 'Ganesh K.', date: '2 Feb 2025', status: 'Pending', amount: '₹2500' },
];

const STATS = [
  { label: 'Total Bookings', value: '8' },
  { label: 'Completed', value: '6' },
  { label: 'Pending', value: '2' },
];

const purple = '#A259FF';

const statusColors = {
  Completed: { bg: '#d1fae5', text: '#065f46' },
  Scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
  Pending: { bg: '#fef3c7', text: '#92400e' },
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const [lastWorkType, setLastWorkType] = useState('');
  const [loading] = useState(false);

  useEffect(() => {
    setLastWorkType(localStorage.getItem('last_work_type') || '');
  }, []);

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }} role="status">⏳ Loading dashboard...</div>;
  }

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }} aria-label="User Dashboard">
      {lastWorkType && (
        <div style={{ background: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#7C3AED' }}>🔧 Last service: <strong>{lastWorkType}</strong></span>
          <button onClick={() => navigate('/service')} style={{ background: purple, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }} aria-label={`Book another ${lastWorkType} service`}>
            Book Again
          </button>
        </div>
      )}

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>My Dashboard</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Welcome back! Here's your activity.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: purple }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <section aria-labelledby="browse-categories" style={{ marginBottom: 24 }}>
        <h2 id="browse-categories" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Browse Categories</h2>
        <div
          style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 8 }}
          role="list"
          aria-label="Service categories"
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              role="listitem"
              onClick={() => { localStorage.setItem('last_work_type', cat); navigate('/service'); }}
              style={{ flexShrink: 0, scrollSnapAlign: 'start', padding: '12px 20px', background: '#fff', border: `2px solid ${purple}`, borderRadius: 10, cursor: 'pointer', fontWeight: 600, color: purple, fontSize: 13 }}
              aria-label={`Browse ${cat} services`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-bookings">
        <h2 id="recent-bookings" style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Recent Bookings</h2>
        {MOCK_BOOKINGS.length === 0 ? (
          <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No bookings yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {MOCK_BOOKINGS.map(b => (
              <div key={b.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{b.service} – {b.worker}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{b.date} · {b.amount}</p>
                </div>
                <span style={{ background: (statusColors[b.status] || {}).bg, color: (statusColors[b.status] || {}).text, borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
