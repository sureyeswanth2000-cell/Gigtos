import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const MOCK_JOBS = {
  '1': { id: '1', title: 'Plumbing Repair Needed', category: 'Plumber', location: 'Kavali, AP', budget: '₹500–₹800', postedAt: '2 hours ago', description: 'Leaking pipe in bathroom needs urgent fix. Must have own tools.', requirements: ['Experience with residential plumbing', 'Available immediately', 'Own tools required'], postedBy: 'Ravi K.' },
  '2': { id: '2', title: 'House Wiring Work', category: 'Electrician', location: 'Nellore, AP', budget: '₹1000–₹1500', postedAt: '4 hours ago', description: 'Full wiring for 2BHK apartment. Must comply with local standards.', requirements: ['Licensed electrician preferred', '2+ years experience', 'Safety certified'], postedBy: 'Sravani M.' },
  '3': { id: '3', title: 'Furniture Carpentry', category: 'Carpenter', location: 'Kavali, AP', budget: '₹2000–₹3000', postedAt: '1 day ago', description: 'Need custom wardrobe built to specific dimensions.', requirements: ['Portfolio of previous work', 'Can source materials'], postedBy: 'Anand P.' },
};

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const found = MOCK_JOBS[jobId];
      if (found) {
        setJob(found);
      } else {
        setError('Job not found.');
      }
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [jobId]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }} role="status" aria-live="polite">
        ⏳ Loading job details...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '48px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <h2 style={{ color: '#b91c1c' }}>{error}</h2>
        <button onClick={() => navigate('/jobs')} style={{ marginTop: 16, padding: '10px 24px', background: '#A259FF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          Browse All Jobs
        </button>
      </div>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', padding: '0 16px' }} aria-label="Job Detail">
      <button onClick={() => navigate('/jobs')} style={{ background: 'none', border: 'none', color: '#A259FF', cursor: 'pointer', fontWeight: 600, marginBottom: 16, fontSize: 14 }}>
        ← Back to Jobs
      </button>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{job.title}</h1>
          <span style={{ background: '#f3e8ff', color: '#7C3AED', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>{job.category}</span>
        </div>

        <div style={{ display: 'flex', gap: 20, color: '#6b7280', fontSize: 13, marginBottom: 20, flexWrap: 'wrap' }}>
          <span>📍 {job.location}</span>
          <span>💰 {job.budget}</span>
          <span>🕒 {job.postedAt}</span>
          <span>👤 Posted by {job.postedBy}</span>
        </div>

        <section aria-labelledby="job-desc">
          <h2 id="job-desc" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Description</h2>
          <p style={{ color: '#374151', lineHeight: 1.6 }}>{job.description}</p>
        </section>

        <section aria-labelledby="job-req" style={{ marginTop: 20 }}>
          <h2 id="job-req" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Requirements</h2>
          <ul style={{ paddingLeft: 20, color: '#374151', lineHeight: 2 }}>
            {job.requirements.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>

        {applied ? (
          <div style={{ marginTop: 24, padding: '12px 16px', background: '#d1fae5', borderRadius: 8, color: '#065f46', fontWeight: 600 }} role="status">
            ✅ Your quote has been submitted! The client will contact you.
          </div>
        ) : (
          <button
            onClick={() => setApplied(true)}
            style={{ marginTop: 24, width: '100%', padding: '14px 0', background: '#A259FF', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            aria-label={`Apply or quote for ${job.title}`}
          >
            Apply / Quote
          </button>
        )}
      </div>
    </main>
  );
}
