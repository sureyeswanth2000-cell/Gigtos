import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { SPECIAL_JOBS } from '../config/specialJobs';
import './MasonDashboard.css';

function buildAllJobOptions() {
  const options = [];
  const seen = new Set();
  for (const sj of SPECIAL_JOBS) {
    if (!seen.has(sj.id)) {
      options.push({ id: sj.id, name: sj.label, icon: sj.icon, category: sj.category });
      seen.add(sj.id);
    }
  }
  for (const svc of SERVICE_CATALOG) {
    const normalizedId = svc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!seen.has(normalizedId)) {
      options.push({ id: normalizedId, name: svc.name, icon: svc.icon, category: svc.category });
      seen.add(normalizedId);
    }
  }
  return options;
}

const ALL_JOBS = buildAllJobOptions();

const EMPTY_WORKER_FORM = {
  name: '',
  contact: '',
  jobRole: '',
  location: '',
  email: '',
  notes: '',
};

/**
 * MasonDashboard – admin-level view for masons.
 * Shows ALL jobs (not geo-filtered), list of registered workers, and allows adding new workers.
 */
export default function MasonDashboard() {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_WORKER_FORM);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [jobFilter, setJobFilter] = useState('');

  const adminId = auth.currentUser?.uid;

  useEffect(() => {
    if (!adminId) return;
    const q = query(collection(db, 'gig_workers'), where('adminId', '==', adminId));
    const unsub = onSnapshot(q, (snap) => {
      setWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingWorkers(false);
    });
    return unsub;
  }, [adminId]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.name.trim() || !form.contact.trim() || !form.jobRole.trim()) {
      setFormError('Name, contact, and job role are required.');
      return;
    }

    setSubmitting(true);
    try {
      const workerId = `mason-worker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(db, 'gig_workers', workerId), {
        name: form.name.trim(),
        contact: form.contact.trim(),
        gigType: form.jobRole.trim(),
        area: form.location.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
        adminId,
        approvalStatus: 'approved',
        status: 'active',
        addedBy: 'mason',
        createdAt: serverTimestamp(),
      });
      setFormSuccess(`Worker "${form.name}" added successfully.`);
      setForm(EMPTY_WORKER_FORM);
      setShowAddForm(false);
    } catch (err) {
      setFormError(err.message || 'Failed to add worker.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredJobs = ALL_JOBS.filter((job) => {
    if (!jobFilter.trim()) return true;
    const q = jobFilter.toLowerCase();
    return job.name.toLowerCase().includes(q) || (job.category || '').toLowerCase().includes(q);
  });

  const workersForJob = (jobId) =>
    workers.filter((w) => {
      const gigType = (w.gigType || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      return gigType === jobId || (w.gigType || '').toLowerCase().includes(jobId.replace(/-/g, ' ').toLowerCase());
    });

  return (
    <div className="mason-dashboard">
      <div className="mason-dashboard-header PremiumHeader">
        <div className="header-content">
          <h1>🧱 Mason Dashboard</h1>
          <p>Orchestrate job roles and field workers with precision.</p>
        </div>
        <div className="header-stats">
          <div className="h-stat">
            <span className="h-stat-label">Total Workers</span>
            <span className="h-stat-value">{workers.length}</span>
          </div>
          <div className="h-stat">
            <span className="h-stat-label">Active Gigs</span>
            <span className="h-stat-value">{ALL_JOBS.length}</span>
          </div>
        </div>
      </div>

      <div className="mason-dashboard-body">
        {/* Modern Sidebar for Job Types */}
        <div className="mason-jobs-panel GlassCard">
          <div className="mason-panel-header">
            <h2 style={{ color: 'var(--text-main)', fontSize: '18px', fontWeight: '800' }}>Job Categories</h2>
            <div className="mason-search-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Find a role..."
                value={jobFilter}
                onChange={(e) => setJobFilter(e.target.value)}
                className="mason-search"
                aria-label="Search job types"
              />
            </div>
          </div>

          <div className="mason-jobs-list thin-scrollbar">
            {filteredJobs.map((job) => {
              const workerCount = workersForJob(job.id).length;
              const isActive = selectedJob?.id === job.id;
              return (
                <button
                  key={job.id}
                  className={`mason-job-item${isActive ? ' mason-job-item--active' : ''}`}
                  onClick={() => {
                    setSelectedJob(job);
                    setShowAddForm(false);
                    setFormSuccess('');
                    setFormError('');
                  }}
                >
                  <span className="mason-job-icon" style={{ 
                    filter: isActive ? 'none' : 'grayscale(0.5)',
                    opacity: isActive ? 1 : 0.7
                  }}>{job.icon}</span>
                  <div className="mason-job-info">
                    <span className="mason-job-name">{job.name}</span>
                    <span className="mason-job-cat">{job.category}</span>
                  </div>
                  {workerCount > 0 && (
                    <span className="mason-job-count-badge">
                      {workerCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="mason-detail-panel">
          {!selectedJob ? (
            <div className="mason-detail-empty">
              <span>👈 Select a job type to view workers</span>
            </div>
          ) : (
            <>
              <div className="mason-detail-header">
                <div className="mason-detail-title">
                  <span className="mason-detail-icon">{selectedJob.icon}</span>
                  <div>
                    <h2>{selectedJob.name}</h2>
                    <p className="mason-detail-cat">{selectedJob.category}</p>
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setShowAddForm(true);
                    setForm({ ...EMPTY_WORKER_FORM, jobRole: selectedJob.name });
                  }}
                >
                  + Add Worker
                </button>
              </div>

              {formSuccess && (
                <div className="mason-form-success">✅ {formSuccess}</div>
              )}

              {showAddForm && (
                <form className="mason-add-worker-form" onSubmit={handleAddWorker}>
                  <h3>Add New Worker – {selectedJob.name}</h3>
                  {formError && <div className="mason-form-error">⚠️ {formError}</div>}
                  <div className="mason-form-grid">
                    <div className="mason-form-field">
                      <label>Name *</label>
                      <input name="name" value={form.name} onChange={handleFormChange} required placeholder="Worker's full name" />
                    </div>
                    <div className="mason-form-field">
                      <label>Contact *</label>
                      <input name="contact" value={form.contact} onChange={handleFormChange} required placeholder="Phone number" />
                    </div>
                    <div className="mason-form-field">
                      <label>Job Role *</label>
                      <input name="jobRole" value={form.jobRole} onChange={handleFormChange} required placeholder="Specific role/skill" />
                    </div>
                    <div className="mason-form-field">
                      <label>Location / Area</label>
                      <input name="location" value={form.location} onChange={handleFormChange} placeholder="Area or address" />
                    </div>
                    <div className="mason-form-field">
                      <label>Email</label>
                      <input name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="Email (optional)" />
                    </div>
                    <div className="mason-form-field mason-form-field--full">
                      <label>Notes</label>
                      <textarea name="notes" value={form.notes} onChange={handleFormChange} placeholder="Any notes about this worker…" rows={3} />
                    </div>
                  </div>
                  <div className="mason-form-actions">
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {submitting ? 'Adding…' : 'Add Worker'}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="mason-workers-section">
                <h3>Registered Workers ({workersForJob(selectedJob.id).length})</h3>
                {loadingWorkers ? (
                  <p>⏳ Loading…</p>
                ) : workersForJob(selectedJob.id).length === 0 ? (
                  <p className="mason-no-workers">No workers registered for this job type yet.</p>
                ) : (
                  <div className="mason-workers-list">
                    {workersForJob(selectedJob.id).map((worker) => (
                      <div key={worker.id} className="mason-worker-card">
                        <div className="mason-worker-info">
                          <strong>{worker.name}</strong>
                          <span>{worker.contact}</span>
                          {worker.area && <span className="mason-worker-area">📍 {worker.area}</span>}
                        </div>
                        <span className={`mason-worker-status mason-worker-status--${worker.status || 'inactive'}`}>
                          {worker.status || 'inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
