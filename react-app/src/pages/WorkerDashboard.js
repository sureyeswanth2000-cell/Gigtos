import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { SERVICE_CATALOG } from '../utils/aiAssistant';

export default function WorkerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [gigSearch, setGigSearch] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setError('Not logged in');
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (!snap.exists()) {
          setError('Worker account not found. Please activate your worker login.');
          setLoading(false);
          return;
        }

        setWorker(snap.data());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>⏳ Loading worker dashboard...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: '#b91c1c' }}>❌ {error}</div>;
  }

  const statusColor = worker?.status === 'active' ? '#065f46' : '#92400e';
  const statusBg = worker?.status === 'active' ? '#d1fae5' : '#fef3c7';
  const isPending = worker?.approvalStatus !== 'approved' || worker?.status !== 'active';

  const visibleGigs = SERVICE_CATALOG.filter((job) => {
    const q = gigSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      job.name.toLowerCase().includes(q)
      || job.desc.toLowerCase().includes(q)
      || job.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: 20 }}>
      <h2 style={{ marginBottom: 14 }}>👷 Worker Dashboard</h2>

      {isPending && (
        <div
          style={{
            marginBottom: 14,
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412',
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          ⏳ Worker Pending Approval: Your account is not fully active yet. Please contact your mason/region lead.
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{worker?.name || 'Worker'}</h3>
          <span style={{ background: statusBg, color: statusColor, padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
            {worker?.status || 'inactive'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><strong>Phone:</strong> {worker?.phone || '-'}</div>
          <div><strong>Email:</strong> {worker?.email || '-'}</div>
          <div><strong>Service:</strong> {worker?.gigType || '-'}</div>
          <div><strong>Area:</strong> {worker?.area || '-'}</div>
          <div><strong>Approval:</strong> {worker?.approvalStatus || 'pending'}</div>
          <div><strong>Admin ID:</strong> {worker?.adminId || '-'}</div>
        </div>
      </div>

      {/* Add/change job types */}
      <div style={{ marginTop: 16, background: '#f5f0ff', border: '1px solid #e5d8ff', borderRadius: 10, padding: 14 }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#2d1836', fontSize: 14 }}>
          Want to register for additional job types?
        </p>
        <Link to="/worker/register">
          <button className="primary-btn" style={{ fontSize: 13 }}>
            📝 Register / Update Job Types
          </button>
        </Link>
      </div>

      {/* Gigto Lite — Browse all available gigs */}
      <div style={{ marginTop: 28 }}>
        <h3 style={{ marginBottom: 8, color: '#2d1836' }}>📋 Browse All Available Gig Listings</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
          Explore all job types on the Gigtos platform. (Gigto Lite view)
        </p>
        <input
          type="text"
          value={gigSearch}
          onChange={(e) => setGigSearch(e.target.value)}
          placeholder="Search gigs…"
          style={{
            width: '100%', maxWidth: 420, padding: '8px 12px',
            border: '1px solid #e5d8ff', borderRadius: 8, fontSize: 14,
            marginBottom: 12, display: 'block'
          }}
          aria-label="Search gigs"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {visibleGigs.map((job) => (
            <div
              key={job.id}
              style={{
                background: '#fff', border: '1px solid #e5d8ff', borderRadius: 10,
                padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4
              }}
            >
              <span style={{ fontSize: 22 }}>{job.icon}</span>
              <strong style={{ fontSize: 13, color: '#2d1836' }}>{job.name}</strong>
              <span style={{ fontSize: 11, color: '#a259ff', fontWeight: 600 }}>{job.category}</span>
              {job.isUpcoming && (
                <span style={{
                  background: '#fef9c3', color: '#854d0e',
                  fontSize: 10, fontWeight: 700,
                  padding: '2px 7px', borderRadius: 999,
                  alignSelf: 'flex-start', marginTop: 2
                }}>Upcoming</span>
              )}
            </div>
          ))}
        </div>
        {visibleGigs.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: 13 }}>No gigs match your search.</p>
        )}
      </div>
    </div>
  );
}
