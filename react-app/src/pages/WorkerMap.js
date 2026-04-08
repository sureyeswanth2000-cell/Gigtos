import React from 'react';
import { useNavigate } from 'react-router-dom';

const NEARBY_JOBS = [
  { id: '1', title: 'Plumbing Repair', location: '1.2 km away', category: 'Plumber', budget: '₹600' },
  { id: '2', title: 'Electrical Wiring', location: '2.5 km away', category: 'Electrician', budget: '₹1200' },
  { id: '3', title: 'Furniture Repair', location: '3.1 km away', category: 'Carpenter', budget: '₹800' },
  { id: '4', title: 'House Painting', location: '4.0 km away', category: 'Painter', budget: '₹4500' },
];

const purple = '#A259FF';

export default function WorkerMap() {
  const navigate = useNavigate();

  return (
    <main style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }} aria-label="Worker Map">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>📍 Jobs Near You</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Showing available jobs in your area</p>

      <div
        style={{ width: '100%', height: 320, background: 'linear-gradient(135deg, #e9d5ff 0%, #ddd6fe 50%, #bfdbfe 100%)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', overflow: 'hidden', border: '1px solid #d8b4fe' }}
        role="img"
        aria-label="Map placeholder showing your location and nearby jobs"
      >
        <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
        <p style={{ fontWeight: 700, color: '#7C3AED', fontSize: 16 }}>Interactive Map</p>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Your location · Kavali, AP</p>
        {[
          { top: '20%', left: '30%' }, { top: '50%', left: '60%' },
          { top: '70%', left: '25%' }, { top: '35%', left: '70%' },
        ].map((pos, i) => (
          <div key={i} style={{ position: 'absolute', top: pos.top, left: pos.left, width: 16, height: 16, background: purple, borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }} aria-hidden="true" />
        ))}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 24, background: '#ef4444', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} aria-label="Your location" />
      </div>

      <section aria-labelledby="nearby-jobs-heading">
        <h2 id="nearby-jobs-heading" style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Nearby Jobs ({NEARBY_JOBS.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NEARBY_JOBS.map(job => (
            <div key={job.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{job.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{job.location} · {job.category}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: '#374151', fontSize: 13 }}>{job.budget}</span>
                <button
                  onClick={() => navigate(`/jobs/${job.id}`)}
                  style={{ padding: '6px 14px', background: purple, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                  aria-label={`View job: ${job.title}`}
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
