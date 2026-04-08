import React, { useState } from 'react';

const CATEGORIES = ['All', 'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Driver', 'Helper'];

const MOCK_JOBS = [
  { id: '1', title: 'Plumbing Repair', category: 'Plumber', location: 'Kavali, AP', budget: '₹500–₹800', description: 'Leaking pipe in bathroom, urgent fix needed.' },
  { id: '2', title: 'Electrical Wiring', category: 'Electrician', location: 'Nellore, AP', budget: '₹1000–₹1500', description: 'Full house wiring for 2BHK.' },
  { id: '3', title: 'Furniture Build', category: 'Carpenter', location: 'Kavali, AP', budget: '₹2000–₹3000', description: 'Custom wardrobe needed.' },
  { id: '4', title: 'Interior Painting', category: 'Painter', location: 'Gudur, AP', budget: '₹4000–₹6000', description: '3BHK full interior with primer.' },
  { id: '5', title: 'Event Driver', category: 'Driver', location: 'Nellore, AP', budget: '₹800/day', description: 'Reliable driver for wedding, 2 days.' },
];

const purple = '#A259FF';

export default function WorkerOpenWork() {
  const [category, setCategory] = useState('All');
  const [loading] = useState(false);
  const [quoteJob, setQuoteJob] = useState(null);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState([]);

  const filtered = category === 'All' ? MOCK_JOBS : MOCK_JOBS.filter(j => j.category === category);

  const handleSubmitQuote = (e) => {
    e.preventDefault();
    setSubmitted(prev => [...prev, quoteJob.id]);
    setQuoteJob(null);
    setPrice('');
    setMessage('');
  };

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }} role="status">⏳ Loading available jobs...</div>;
  }

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }} aria-label="Available Jobs for Workers">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Open Work</h1>
      <p style={{ color: '#6b7280', marginBottom: 16 }}>Browse jobs and submit quotes</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }} role="group" aria-label="Category filter">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${category === c ? purple : '#e5e7eb'}`, background: category === c ? purple : '#fff', color: category === c ? '#fff' : '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }} role="status">
          <div style={{ fontSize: 40 }}>📋</div>
          <p>No open jobs in this category right now.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(job => (
            <article key={job.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }} aria-label={`Job: ${job.title}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{job.title}</h2>
                <span style={{ background: '#f3e8ff', color: '#7C3AED', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600 }}>{job.category}</span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>{job.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>📍 {job.location} · 💰 {job.budget}</span>
                {submitted.includes(job.id) ? (
                  <span style={{ color: '#065f46', fontWeight: 600, fontSize: 13 }}>✅ Quote Sent</span>
                ) : (
                  <button
                    onClick={() => setQuoteJob(job)}
                    style={{ padding: '8px 18px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                    aria-label={`Submit quote for ${job.title}`}
                  >
                    Quote
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {quoteJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} role="dialog" aria-modal="true" aria-labelledby="quote-modal-title">
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 440 }}>
            <h2 id="quote-modal-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Submit Quote</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>For: <strong>{quoteJob.title}</strong></p>
            <form onSubmit={handleSubmitQuote}>
              <label htmlFor="quote-price" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Your Price (₹)</label>
              <input
                id="quote-price"
                type="number"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 650"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 12, boxSizing: 'border-box' }}
              />
              <label htmlFor="quote-message" style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Message</label>
              <textarea
                id="quote-message"
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Briefly describe your approach..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, marginBottom: 16, boxSizing: 'border-box', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setQuoteJob(null)} style={{ flex: 1, padding: '10px 0', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '10px 0', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Send Quote</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
