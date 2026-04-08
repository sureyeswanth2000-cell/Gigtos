import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import JobCard from '../../components/worker/JobCard';
import QuoteModal from '../../components/worker/QuoteModal';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

const CATEGORIES = ['All', 'Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'Driving', 'Other'];

const MOCK_OPEN_JOBS = [
  { id: 'm1', title: 'Fix leaking pipe', serviceType: 'Plumbing', description: 'Kitchen sink pipe is leaking. Need urgent fix.', area: 'Adyar', budget: 800, createdAt: new Date(Date.now() - 2*3600000).toISOString(), category: 'Plumbing' },
  { id: 'm2', title: 'Install ceiling fan', serviceType: 'Electrical', description: 'Need 2 ceiling fans installed in bedroom.', area: 'Velachery', budget: 600, createdAt: new Date(Date.now() - 5*3600000).toISOString(), category: 'Electrical' },
  { id: 'm3', title: 'Deep clean apartment', serviceType: 'Cleaning', description: '2BHK apartment needs deep cleaning before move-in.', area: 'OMR', budget: 1500, createdAt: new Date(Date.now() - 1*86400000).toISOString(), category: 'Cleaning' },
  { id: 'm4', title: 'Repaint bedroom walls', serviceType: 'Painting', description: 'Bedroom walls need fresh coat. White/off-white color.', area: 'Porur', budget: 2000, createdAt: new Date(Date.now() - 3*3600000).toISOString(), category: 'Painting' },
];

export default function OpenWork() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedJob, setSelectedJob] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(collection(db, 'bookings'), where('status', '==', 'open')));
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setJobs(fetched.length > 0 ? fetched : MOCK_OPEN_JOBS);
      } catch {
        setJobs(MOCK_OPEN_JOBS);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const showToast = (msg, type = '') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendQuote = async () => {
    await new Promise(r => setTimeout(r, 500));
    showToast("✅ Quote sent! You'll be notified if accepted.", 'success');
  };

  const filtered = jobs
    .filter(j => activeCategory === 'All' || (j.category || j.gigType || j.serviceType) === activeCategory)
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'budget') return (b.budget || 0) - (a.budget || 0);
      return 0;
    });

  return (
    <div className="worker-page">
      <div className="worker-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/worker/dashboard" style={{ color: '#A259FF', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F1144' }}>📋 Open Work</h2>
        </div>

        {/* Category Filters */}
        <div className="filter-row">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#6B7280', paddingTop: 6 }}>Sort:</span>
          {[{v:'recent',l:'Recent'},{v:'budget',l:'Budget'}].map(s => (
            <button
              key={s.v}
              className={`filter-chip ${sortBy === s.v ? 'active' : ''}`}
              onClick={() => setSortBy(s.v)}
            >
              {s.l}
            </button>
          ))}
        </div>

        {loading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14, marginBottom: 12 }} />)
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No open jobs</h3>
            <p>No jobs available in your area right now. Check back soon!</p>
          </div>
        ) : (
          filtered.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onSendQuote={() => setSelectedJob(job)}
              onViewDetails={() => setSelectedJob(job)}
            />
          ))
        )}
      </div>

      {selectedJob && (
        <QuoteModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSubmit={handleSendQuote}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <WorkerBottomNav />
    </div>
  );
}
