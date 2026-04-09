import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import FutureJobCard from '../../components/worker/FutureJobCard';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

const MOCK_FUTURE = [
  { id: 'f1', title: 'AC Service', category: 'AC Technician', area: 'Adyar', budget: 1500, scheduledAt: new Date(Date.now() + 86400000).toISOString(), status: 'pending' },
  { id: 'f2', title: 'Plumbing repair', category: 'Plumbing', area: 'Velachery', budget: 900, scheduledAt: new Date(Date.now() + 2*86400000).toISOString(), status: 'confirmed' },
  { id: 'f3', title: 'House painting', category: 'Painting', area: 'OMR', budget: 4000, scheduledAt: new Date(Date.now() + 5*86400000).toISOString(), status: 'pending' },
];

function groupByDate(jobs) {
  const groups = {};
  jobs.forEach(job => {
    const d = new Date(job.scheduledAt);
    const key = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(job);
  });
  return groups;
}

export default function FutureWork() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(
          collection(db, 'bookings'),
          where('workerId', '==', u.uid),
          where('status', 'in', ['pending', 'confirmed'])
        ));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setJobs(data.length > 0 ? data : MOCK_FUTURE);
      } catch {
        setJobs(MOCK_FUTURE);
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

  const handleAccept = (job) => {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'confirmed' } : j));
    showToast('✅ Job accepted! Customer will be notified.', 'success');
  };

  const tomorrowJobs = jobs.filter(j => {
    const d = new Date(j.scheduledAt);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString();
  });

  const grouped = groupByDate([...jobs].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));

  return (
    <div className="worker-page">
      <div className="worker-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/worker/dashboard" style={{ color: '#A259FF', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F1144' }}>📅 Future Work</h2>
        </div>

        {tomorrowJobs.length > 0 && (
          <div style={{ background: '#EDE9FE', border: '1px solid #C4B5FD', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: '#7C3AED', fontSize: 14 }}>
              🔔 You have {tomorrowJobs.length} job{tomorrowJobs.length > 1 ? 's' : ''} tomorrow!
            </div>
          </div>
        )}

        {loading ? (
          [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14, marginBottom: 12 }} />)
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>No future jobs</h3>
            <p>Accepted future jobs will appear here. You can accept jobs even when offline!</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, dateJobs]) => (
            <div key={date}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#7C3AED',
                background: '#EDE9FE', padding: '6px 12px', borderRadius: 8,
                marginBottom: 8
              }}>
                📅 {date}
              </div>
              {dateJobs.map(job => (
                <FutureJobCard
                  key={job.id}
                  job={job}
                  onAccept={handleAccept}
                  onViewDetails={(j) => alert(`Job: ${j.title}\nArea: ${j.area}\nBudget: ₹${j.budget}`)}
                />
              ))}
            </div>
          ))
        )}
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <WorkerBottomNav />
    </div>
  );
}
