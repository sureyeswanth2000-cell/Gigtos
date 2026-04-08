import React, { useState } from 'react';

const purple = '#A259FF';

const MOCK_FUTURE_JOBS = [
  { id: 'f1', title: 'Plumbing Installation', client: 'Ravi K.', date: '2025-03-15', time: '10:00 AM', location: 'Kavali, AP', budget: '₹800', accepted: false },
  { id: 'f2', title: 'Electrical Repair', client: 'Sravani M.', date: '2025-03-18', time: '9:00 AM', location: 'Nellore, AP', budget: '₹1200', accepted: true },
  { id: 'f3', title: 'Door Fitting', client: 'Anand P.', date: '2025-03-22', time: '11:00 AM', location: 'Gudur, AP', budget: '₹600', accepted: false },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

export default function WorkerFutureWork() {
  const [jobs, setJobs] = useState(MOCK_FUTURE_JOBS);

  const handleAccept = (id) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, accepted: true } : j));
    try {
      const stored = JSON.parse(localStorage.getItem('accepted_jobs') || '[]');
      localStorage.setItem('accepted_jobs', JSON.stringify([...stored, id]));
    } catch (_) {}
  };

  return (
    <main style={{ maxWidth: 780, margin: '24px auto', padding: '0 16px' }} aria-label="Future and Scheduled Work">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📅 Upcoming Work</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Your scheduled and pending jobs</p>

      {jobs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }} role="status">
          <div style={{ fontSize: 40 }}>📅</div>
          <p>No upcoming jobs scheduled.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {jobs.map(job => (
            <article key={job.id} style={{ background: '#fff', borderRadius: 12, border: `2px solid ${job.accepted ? '#a7f3d0' : '#e5e7eb'}`, padding: 16 }} aria-label={`Scheduled job: ${job.title}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{job.title}</h2>
                {job.accepted && (
                  <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>✓ Accepted</span>
                )}
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f3e8ff', borderRadius: 8, padding: '6px 12px', marginBottom: 10, gap: 8 }}>
                <span style={{ fontSize: 20 }}>📅</span>
                <div>
                  <div style={{ fontWeight: 700, color: '#7C3AED', fontSize: 14 }}>{formatDate(job.date)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{job.time}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', marginBottom: 10, flexWrap: 'wrap' }}>
                <span>👤 {job.client}</span>
                <span>📍 {job.location}</span>
                <span>💰 {job.budget}</span>
              </div>

              {!job.accepted && (
                <button
                  onClick={() => handleAccept(job.id)}
                  style={{ padding: '8px 20px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                  aria-label={`Accept job: ${job.title}`}
                >
                  Accept Job
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
