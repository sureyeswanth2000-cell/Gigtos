import React, { useState, useEffect } from 'react';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

/**
 * Mason Dashboard — admin-level view for a Mason role.
 *
 * - Shows ALL jobs always (no geo-filter).
 * - For each job, Mason can view registered workers and add new ones.
 * - Add Worker form includes: name, contact, job role, location.
 *
 * In a real implementation the form would write to Firestore.
 * Here we keep the UI fully functional with local state so the component
 * works without a live backend.
 */
export default function MasonDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mason, setMason] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [addWorkerJobId, setAddWorkerJobId] = useState(null);
  const [workersByJob, setWorkersByJob] = useState({}); // jobId -> [worker]
  const [newWorker, setNewWorker] = useState(defaultWorkerForm());
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // --- Auth guard ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not logged in'); setLoading(false); return; }
      try {
        const adminDoc = await getDoc(doc(db, 'admins', u.uid));
        if (!adminDoc.exists()) { setError('Access denied — not an admin account.'); setLoading(false); return; }
        setMason({ uid: u.uid, email: u.email, ...adminDoc.data() });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // --- Load workers for expanded job ---
  useEffect(() => {
    if (!expandedJobId) return;
    if (workersByJob[expandedJobId]) return; // already loaded
    getDocs(collection(db, 'worker_auth'))
      .then((snap) => {
        const workers = [];
        snap.forEach((d) => {
          const data = d.data();
          if (String(data.gigTypeId) === String(expandedJobId) || data.gigType === expandedJobId) {
            workers.push({ id: d.id, ...data });
          }
        });
        setWorkersByJob((prev) => ({ ...prev, [expandedJobId]: workers }));
      })
      .catch(() => {
        setWorkersByJob((prev) => ({ ...prev, [expandedJobId]: [] }));
      });
  }, [expandedJobId, workersByJob]);

  const allJobs = SERVICE_CATALOG;
  const visible = allJobs.filter((job) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return job.name.toLowerCase().includes(q) || job.category.toLowerCase().includes(q);
  });

  const handleAddWorkerSubmit = (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    const { name, contact, jobRole, location } = newWorker;
    if (!name.trim() || !contact.trim() || !jobRole.trim() || !location.trim()) {
      setFormError('All fields are required.');
      return;
    }
    // In a real app: write to Firestore here
    setFormSuccess(`Worker "${name}" added for "${jobRole}". Pending approval.`);
    // Optimistically add to local state
    setWorkersByJob((prev) => ({
      ...prev,
      [addWorkerJobId]: [
        ...(prev[addWorkerJobId] || []),
        { id: Date.now(), name, contact, gigType: jobRole, area: location, approvalStatus: 'pending', status: 'inactive' },
      ],
    }));
    setNewWorker(defaultWorkerForm());
    setAddWorkerJobId(null);
  };

  if (loading) return <div style={{ padding: 24 }}>⏳ Loading Mason Dashboard…</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>❌ {error}</div>;

  return (
    <div className="mason-dashboard">
      <div className="mason-header">
        <h1 className="mason-title">🧱 Mason Dashboard</h1>
        <p className="mason-subtitle">Welcome, {mason?.name || mason?.email}. Manage all workers and job categories.</p>
      </div>

      <input
        className="mason-search"
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search job categories…"
        aria-label="Search jobs"
      />

      <div className="mason-job-list">
        {visible.map((job) => {
          const isExpanded = expandedJobId === String(job.id);
          const workers = workersByJob[String(job.id)] || [];
          return (
            <div key={job.id} className="mason-job-card">
              <div className="mason-job-row">
                <span className="mason-job-icon">{job.icon}</span>
                <div className="mason-job-info">
                  <strong>{job.name}</strong>
                  <span className="mason-job-category">{job.category}</span>
                </div>
                <div className="mason-job-actions">
                  <button
                    className="secondary-btn mason-toggle-btn"
                    onClick={() => setExpandedJobId(isExpanded ? null : String(job.id))}
                  >
                    {isExpanded ? 'Hide Workers' : 'View Workers'}
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => { setAddWorkerJobId(String(job.id)); setFormSuccess(''); setFormError(''); }}
                  >
                    + Add Worker
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mason-workers-list">
                  {workers.length === 0 ? (
                    <p className="mason-no-workers">No workers registered for this job yet.</p>
                  ) : (
                    <table className="mason-workers-table">
                      <thead>
                        <tr>
                          <th>Name</th><th>Contact</th><th>Area</th><th>Status</th><th>Approval</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workers.map((w) => (
                          <tr key={w.id}>
                            <td>{w.name || '-'}</td>
                            <td>{w.phone || w.contact || '-'}</td>
                            <td>{w.area || '-'}</td>
                            <td>
                              <span className={`badge-status ${w.status === 'active' ? 'badge-status--active' : 'badge-status--inactive'}`}>
                                {w.status || 'inactive'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge-approval ${w.approvalStatus === 'approved' ? 'badge-approval--approved' : 'badge-approval--pending'}`}>
                                {w.approvalStatus || 'pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Worker Modal */}
      {addWorkerJobId && (
        <div className="mason-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setAddWorkerJobId(null); }}>
          <div className="mason-modal">
            <h2 className="mason-modal-title">Add Worker</h2>
            <p className="mason-modal-subtitle">
              Job: <strong>{allJobs.find((j) => String(j.id) === addWorkerJobId)?.name || addWorkerJobId}</strong>
            </p>
            {formSuccess && <div className="mason-form-success">✅ {formSuccess}</div>}
            {formError && <div className="mason-form-error">❌ {formError}</div>}
            <form className="mason-add-worker-form" onSubmit={handleAddWorkerSubmit}>
              <label>
                Full Name *
                <input type="text" value={newWorker.name} onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })} placeholder="e.g. Ravi Kumar" required />
              </label>
              <label>
                Contact Number *
                <input type="tel" value={newWorker.contact} onChange={(e) => setNewWorker({ ...newWorker, contact: e.target.value })} placeholder="e.g. +91 9876543210" required />
              </label>
              <label>
                Job Role *
                <input type="text" value={newWorker.jobRole} onChange={(e) => setNewWorker({ ...newWorker, jobRole: e.target.value })} placeholder="e.g. Plumber" required />
              </label>
              <label>
                Location / Area *
                <input type="text" value={newWorker.location} onChange={(e) => setNewWorker({ ...newWorker, location: e.target.value })} placeholder="e.g. Kavali, Nellore" required />
              </label>
              <div className="mason-form-actions">
                <button type="button" className="secondary-btn" onClick={() => setAddWorkerJobId(null)}>Cancel</button>
                <button type="submit" className="primary-btn">Add Worker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gigto Lite — job browsing view */}
      <div className="mason-gigto-lite">
        <h2 className="mason-section-title">📋 All Available Gig Listings (Gigto Lite)</h2>
        <p className="mason-section-desc">Browse the full catalogue of job types available on the platform.</p>
        <div className="mason-gigto-grid">
          {allJobs.map((job) => (
            <div key={job.id} className="mason-gigto-card">
              <span className="mason-gigto-icon">{job.icon}</span>
              <span className="mason-gigto-name">{job.name}</span>
              <span className="mason-gigto-category">{job.category}</span>
              {job.isUpcoming && <span className="badge-upcoming">Upcoming</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function defaultWorkerForm() {
  return { name: '', contact: '', jobRole: '', location: '' };
}
