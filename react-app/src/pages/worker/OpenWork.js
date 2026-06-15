import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functionsInstance } from '../../firebase';
import JobCard from '../../components/worker/JobCard';
import CompleteJobModal from '../../components/worker/CompleteJobModal';
import QuoteModal from '../../components/worker/QuoteModal';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

const CATEGORIES = ['All', 'Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'Driving', 'Other'];

export default function OpenWork() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedJob, setSelectedJob] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [completeJob, setCompleteJob] = useState(null);

  const showToast = (msg, type = '') => {
    setToast({ msg, type });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      try {
        const result = await httpsCallable(functionsInstance, 'listOpenWork')({});
        setJobs(result.data?.jobs || []);
      } catch (err) {
        showToast(err.message || 'Could not load open jobs.', 'error');
        setJobs([]);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => () => clearTimeout(toastTimeoutRef.current), []);

  const handleSubmitQuote = async ({ price, message, jobId }) => {
    await httpsCallable(functionsInstance, 'submitQuote')({
      bookingId: jobId,
      price: Number(price),
      finalPrice: Number(price),
      message: message || '',
    });
    setJobs(prev => prev.filter(job => job.id !== jobId));
    showToast("Quote sent. You'll be notified if accepted.", 'success');
  };

  const filtered = jobs
    .filter(j => activeCategory === 'All' || (j.category || j.gigType || j.serviceType) === activeCategory)
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return 0;
    });

  return (
    <div className="worker-page">
      <div className="worker-container">
        <div className="worker-page-topbar">
          <Link to="/worker/dashboard" className="worker-back-link" aria-label="Back to worker dashboard">Back</Link>
          <h2 className="worker-page-title">Open Work</h2>
        </div>

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

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: '#6B7280', paddingTop: 6 }}>Sort:</span>
          {[{ v: 'recent', l: 'Recent' }].map(s => (
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
          [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14, marginBottom: 12 }} />)
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">No jobs</div>
            <h3>No open jobs</h3>
            <p>No jobs available in your area right now. Please check again shortly.</p>
          </div>
        ) : (
          filtered.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onSendQuote={() => setSelectedJob(job)}
              onViewDetails={() => setSelectedJob(job)}
              onCompleteJob={() => setCompleteJob(job)}
            />
          ))
        )}
      </div>

      {selectedJob && (
        <QuoteModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSubmit={handleSubmitQuote}
        />
      )}

      {completeJob && (
        <CompleteJobModal
          job={completeJob}
          onClose={() => setCompleteJob(null)}
          onCompleted={() => {
            setCompleteJob(null);
            showToast('Job marked as complete.', 'success');
          }}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <WorkerBottomNav />
    </div>
  );
}
