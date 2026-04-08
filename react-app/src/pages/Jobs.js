import React, { useState } from 'react';
import { getABGroup, AB_JOB_CARD_LAYOUT } from '../utils/abTest';

const CATEGORIES = ['All', 'Plumber', 'Electrician', 'Carpenter', 'Painter', 'Driver', 'Helper', 'Cleaner', 'Mason'];

const MOCK_JOBS = [
  { id: '1', title: 'Plumbing Repair Needed', category: 'Plumber', location: 'Kavali, AP', budget: '₹500–₹800', postedAt: '2 hours ago', description: 'Leaking pipe in bathroom needs urgent fix.' },
  { id: '2', title: 'House Wiring Work', category: 'Electrician', location: 'Nellore, AP', budget: '₹1000–₹1500', postedAt: '4 hours ago', description: 'Full wiring for 2BHK apartment.' },
  { id: '3', title: 'Furniture Carpentry', category: 'Carpenter', location: 'Kavali, AP', budget: '₹2000–₹3000', postedAt: '1 day ago', description: 'Need custom wardrobe built.' },
  { id: '4', title: 'Wall Painting – 3BHK', category: 'Painter', location: 'Gudur, AP', budget: '₹4000–₹6000', postedAt: '2 days ago', description: 'Full interior painting with primer.' },
  { id: '5', title: 'Driver for Wedding Event', category: 'Driver', location: 'Nellore, AP', budget: '₹800/day', postedAt: '3 hours ago', description: 'Need reliable driver for 2 days.' },
  { id: '6', title: 'House Shifting Helper', category: 'Helper', location: 'Kavali, AP', budget: '₹600', postedAt: '5 hours ago', description: 'Help with moving furniture to new flat.' },
];

const cardBase = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
};

export default function Jobs() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const layout = getABGroup(AB_JOB_CARD_LAYOUT) === 'A' ? 'grid' : 'list';

  const filtered = MOCK_JOBS.filter(j => {
    const matchCat = category === 'All' || j.category === category;
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) || j.category.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <main style={{ maxWidth: 960, margin: '24px auto', padding: '0 16px' }} aria-label="Find Jobs">
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>Find Jobs Near You</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Browse available gigs in your area</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="search"
          aria-label="Search jobs"
          placeholder="Search jobs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af' }} role="status">
          <div style={{ fontSize: 40 }}>🔍</div>
          <p>No jobs found matching your search.</p>
        </div>
      ) : (
        <div
          style={layout === 'grid'
            ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }
            : { display: 'flex', flexDirection: 'column', gap: 12 }
          }
          aria-label={`Jobs list – ${layout} view`}
        >
          {filtered.map(job => (
            <article key={job.id} style={cardBase} aria-label={`Job: ${job.title}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{job.title}</h2>
                <span style={{ background: '#f3e8ff', color: '#7C3AED', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{job.category}</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0' }}>{job.description}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                <span>📍 {job.location}</span>
                <span>💰 {job.budget}</span>
                <span>🕒 {job.postedAt}</span>
              </div>
              <a
                href={`/Gigtos/jobs/${job.id}`}
                style={{ display: 'block', marginTop: 12, padding: '8px 0', background: '#A259FF', color: '#fff', borderRadius: 8, textAlign: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                aria-label={`View details for ${job.title}`}
              >
                View Details
              </a>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
