import React, { useState } from 'react';

const MOCK_PROFILE = {
  name: 'Ravi Kumar',
  email: 'ravi.kumar@example.com',
  phone: '+91 98765 43210',
  location: 'Kavali, Andhra Pradesh',
  joinedAt: 'January 2024',
};

const MOCK_POSTED_JOBS = [
  { id: '1', title: 'Plumbing Repair', status: 'Open', postedAt: '2 days ago' },
  { id: '2', title: 'Wall Painting', status: 'Completed', postedAt: '1 week ago' },
];

const MOCK_SAVED_WORKERS = [
  { id: 'w1', name: 'Suresh Reddy', service: 'Electrician', rating: 4.8 },
  { id: 'w2', name: 'Prasad M.', service: 'Plumber', rating: 4.5 },
];

const MOCK_REVIEWS = [
  { id: 'r1', worker: 'Suresh Reddy', rating: 5, comment: 'Excellent work, very professional.', date: '2 weeks ago' },
  { id: 'r2', worker: 'Prasad M.', rating: 4, comment: 'Good service, came on time.', date: '1 month ago' },
];

const TABS = ['Posted Jobs', 'Saved Workers', 'Reviews'];

const purple = '#A259FF';

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading] = useState(false);
  const [error] = useState('');

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }} role="status">⏳ Loading profile...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: '#b91c1c' }} role="alert">❌ {error}</div>;
  }

  return (
    <main style={{ maxWidth: 780, margin: '24px auto', padding: '0 16px' }} aria-label="User Profile">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>My Profile</h1>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }} aria-hidden="true">👤</div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{MOCK_PROFILE.name}</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Member since {MOCK_PROFILE.joinedAt}</p>
          </div>
        </div>
        <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 14 }}>
          <div><dt style={{ color: '#9ca3af', fontSize: 12 }}>Email</dt><dd style={{ margin: 0, fontWeight: 500 }}>{MOCK_PROFILE.email}</dd></div>
          <div><dt style={{ color: '#9ca3af', fontSize: 12 }}>Phone</dt><dd style={{ margin: 0, fontWeight: 500 }}>{MOCK_PROFILE.phone}</dd></div>
          <div><dt style={{ color: '#9ca3af', fontSize: 12 }}>Location</dt><dd style={{ margin: 0, fontWeight: 500 }}>{MOCK_PROFILE.location}</dd></div>
        </dl>
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', marginBottom: 20 }} role="tablist" aria-label="Profile sections">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === i}
            aria-controls={`tab-panel-${i}`}
            onClick={() => setActiveTab(i)}
            style={{ padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === i ? purple : '#6b7280', borderBottom: activeTab === i ? `2px solid ${purple}` : '2px solid transparent', marginBottom: -2 }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tab-panel-${activeTab}`}>
        {activeTab === 0 && (
          MOCK_POSTED_JOBS.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No posted jobs yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MOCK_POSTED_JOBS.map(j => (
                <div key={j.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{j.title}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{j.postedAt}</p>
                  </div>
                  <span style={{ background: j.status === 'Open' ? '#d1fae5' : '#f3f4f6', color: j.status === 'Open' ? '#065f46' : '#6b7280', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>{j.status}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 1 && (
          MOCK_SAVED_WORKERS.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No saved workers yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MOCK_SAVED_WORKERS.map(w => (
                <div key={w.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{w.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{w.service}</p>
                  </div>
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>★ {w.rating}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 2 && (
          MOCK_REVIEWS.length === 0 ? (
            <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>No reviews yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MOCK_REVIEWS.map(r => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <strong>{r.worker}</strong>
                    <span style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{r.comment}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{r.date}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </main>
  );
}
