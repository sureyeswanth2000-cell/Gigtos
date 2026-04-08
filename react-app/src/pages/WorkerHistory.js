import React from 'react';

const MOCK_HISTORY = [
  { id: 'h1', title: 'Plumbing Repair', client: 'Ravi K.', date: '10 Jan 2025', earned: '₹650', rating: 5, review: 'Very professional and fast.' },
  { id: 'h2', title: 'Electrical Wiring', client: 'Sravani M.', date: '22 Jan 2025', earned: '₹1200', rating: 4, review: 'Good work, arrived on time.' },
  { id: 'h3', title: 'Door Repair', client: 'Anand P.', date: '5 Feb 2025', earned: '₹450', rating: 5, review: 'Excellent, very tidy work.' },
];

const TOTAL_EARNINGS = MOCK_HISTORY.reduce((s, h) => s + parseInt(h.earned.replace(/[₹,]/g, '')), 0);
const AVG_RATING = (MOCK_HISTORY.reduce((s, h) => s + h.rating, 0) / MOCK_HISTORY.length).toFixed(1);

const purple = '#A259FF';

function Stars({ rating }) {
  return (
    <span aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function WorkerHistory() {
  return (
    <main style={{ maxWidth: 780, margin: '24px auto', padding: '0 16px' }} aria-label="Work History">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Work History</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Your completed jobs and earnings</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Jobs Done', value: MOCK_HISTORY.length },
          { label: 'Total Earned', value: `₹${TOTAL_EARNINGS.toLocaleString()}` },
          { label: 'Avg Rating', value: `${AVG_RATING} ★` },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: purple }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {MOCK_HISTORY.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }} role="status">
          <div style={{ fontSize: 40 }}>📋</div>
          <p>No completed jobs yet. Start accepting work to build your history!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MOCK_HISTORY.map(job => (
            <article key={job.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 16 }} aria-label={`Completed job: ${job.title}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{job.title}</h2>
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Client: {job.client} · {job.date}</p>
                </div>
                <span style={{ fontWeight: 700, color: '#065f46', fontSize: 15 }}>{job.earned}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>"{job.review}"</p>
                <span style={{ color: '#f59e0b', fontSize: 14 }}><Stars rating={job.rating} /></span>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
