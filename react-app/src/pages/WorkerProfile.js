import React, { useState } from 'react';

const purple = '#A259FF';

function Stars({ rating, max = 5 }) {
  return (
    <span aria-label={`${rating} out of ${max} stars`} style={{ color: '#f59e0b', fontSize: 18 }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(max - Math.round(rating))}
    </span>
  );
}

const MOCK_PROFILE = {
  name: 'Suresh Reddy',
  phone: '+91 98765 00001',
  area: 'Kavali, AP',
  gigType: 'Electrician',
  bio: 'Experienced electrician with 5+ years in residential and commercial work.',
  totalWorks: 42,
  earnings: '₹38,500',
  rating: 4.8,
  reviews: [
    { name: 'Ravi K.', stars: 5, comment: 'Excellent work!' },
    { name: 'Sravani M.', stars: 4, comment: 'Good service.' },
  ],
};

export default function WorkerProfile() {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: MOCK_PROFILE.name,
    phone: MOCK_PROFILE.phone,
    area: MOCK_PROFILE.area,
    gigType: MOCK_PROFILE.gigType,
    bio: MOCK_PROFILE.bio,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <main style={{ maxWidth: 780, margin: '24px auto', padding: '0 16px' }} aria-label="Worker Profile">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>Worker Profile</h1>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }} aria-hidden="true">👷</div>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{form.name}</h2>
              <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>{form.gigType} · {form.area}</p>
              <Stars rating={MOCK_PROFILE.rating} />
            </div>
          </div>
          <button onClick={() => setEditing(e => !e)} style={{ padding: '8px 16px', background: editing ? '#e5e7eb' : purple, color: editing ? '#374151' : '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} aria-label={editing ? 'Cancel editing profile' : 'Edit profile'}>
            {editing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[{ label: 'Total Works', value: MOCK_PROFILE.totalWorks }, { label: 'Earnings', value: MOCK_PROFILE.earnings }, { label: 'Rating', value: `${MOCK_PROFILE.rating}/5` }].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: 12, background: '#f9fafb', borderRadius: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: purple }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {saved && (
          <div style={{ padding: '10px 14px', background: '#d1fae5', borderRadius: 8, color: '#065f46', fontWeight: 600, marginBottom: 12 }} role="status">
            ✅ Profile updated successfully!
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSave}>
            {[
              { id: 'name', label: 'Full Name', type: 'text' },
              { id: 'phone', label: 'Phone', type: 'tel' },
              { id: 'area', label: 'Area / Location', type: 'text' },
              { id: 'gigType', label: 'Service Type', type: 'text' },
            ].map(f => (
              <div key={f.id} style={{ marginBottom: 12 }}>
                <label htmlFor={`wp-${f.id}`} style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{f.label}</label>
                <input id={`wp-${f.id}`} type={f.type} value={form[f.id]} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="wp-bio" style={{ display: 'block', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>Bio</label>
              <textarea id="wp-bio" value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <button type="submit" style={{ padding: '10px 24px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Save Changes</button>
          </form>
        ) : (
          <p style={{ color: '#374151', fontSize: 14, margin: 0 }}>{form.bio}</p>
        )}
      </div>

      <section aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Reviews</h2>
        {MOCK_PROFILE.reviews.map((r, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <strong style={{ fontSize: 14 }}>{r.name}</strong>
              <Stars rating={r.stars} />
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{r.comment}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
