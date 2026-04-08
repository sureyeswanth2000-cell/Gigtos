import React, { useState } from 'react';

const purple = '#A259FF';

const MOCK_WORKERS = [
  { id: 'w1', name: 'Suresh Reddy', service: 'Electrician', status: 'active', area: 'Kavali', joinedAt: '10 Jan 2025' },
  { id: 'w2', name: 'Prasad M.', service: 'Plumber', status: 'pending', area: 'Nellore', joinedAt: '15 Jan 2025' },
  { id: 'w3', name: 'Ganesh K.', service: 'Carpenter', status: 'active', area: 'Gudur', joinedAt: '20 Jan 2025' },
];

const STATS = [
  { label: 'Total Workers', value: 3 },
  { label: 'Active Workers', value: 2 },
  { label: 'Pending Approval', value: 1 },
];

export default function MasonDashboard() {
  const [workers, setWorkers] = useState(MOCK_WORKERS);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', service: '', area: '' });
  const [added, setAdded] = useState(false);

  const handleAddWorker = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) return;
    const newWorker = { id: `w${Date.now()}`, name: form.name, service: form.service || 'General', status: 'pending', area: form.area || '-', joinedAt: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) };
    setWorkers(prev => [...prev, newWorker]);
    setForm({ name: '', phone: '', service: '', area: '' });
    setShowForm(false);
    setAdded(true);
    setTimeout(() => setAdded(false), 3000);
  };

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }} aria-label="Mason Dashboard">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Mason Dashboard</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Manage your worker team</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {STATS.map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: purple }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {added && (
        <div style={{ padding: '10px 14px', background: '#d1fae5', borderRadius: 8, color: '#065f46', fontWeight: 600, marginBottom: 14 }} role="status">
          ✅ Worker added successfully! Pending approval.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Workers ({workers.length})</h2>
        <button onClick={() => setShowForm(f => !f)} style={{ padding: '8px 18px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }} aria-label={showForm ? 'Cancel adding worker' : 'Add new worker'}>
          {showForm ? 'Cancel' : '+ Add Worker'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddWorker} style={{ background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb', padding: 20, marginBottom: 16 }} aria-label="Add Worker Form">
          <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>Add New Worker</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { id: 'name', label: 'Full Name *', type: 'text', required: true },
              { id: 'phone', label: 'Phone *', type: 'tel', required: true },
              { id: 'service', label: 'Service Type', type: 'text', required: false },
              { id: 'area', label: 'Area', type: 'text', required: false },
            ].map(f => (
              <div key={f.id}>
                <label htmlFor={`md-${f.id}`} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</label>
                <input id={`md-${f.id}`} type={f.type} required={f.required} value={form[f.id]} onChange={e => setForm(p => ({ ...p, [f.id]: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <button type="submit" style={{ marginTop: 14, padding: '10px 24px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Add Worker</button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {workers.map(w => (
          <div key={w.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{w.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{w.service} · {w.area} · Joined {w.joinedAt}</p>
            </div>
            <span style={{ background: w.status === 'active' ? '#d1fae5' : '#fef3c7', color: w.status === 'active' ? '#065f46' : '#92400e', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {w.status}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}
