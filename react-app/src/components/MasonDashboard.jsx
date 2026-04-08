import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { SERVICE_CATALOG } from '../utils/aiAssistant';

/**
 * MasonDashboard — admin-level view of all jobs.
 * Mason can:
 *  - Browse all job types (no geo-filter)
 *  - View registered workers per job
 *  - Add new workers for any job type
 */
export default function MasonDashboard() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState('');

  // Add worker form state
  const [form, setForm] = useState({
    name: '',
    contact: '',
    jobRole: '',
    location: '',
    experience: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load workers for selected job
  useEffect(() => {
    if (!selectedJob) return;

    setLoadingWorkers(true);
    setWorkers([]);

    const q = query(
      collection(db, 'workers'),
      where('gigType', '==', selectedJob.name)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setWorkers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingWorkers(false);
      },
      (err) => {
        console.error(err);
        setLoadingWorkers(false);
      }
    );

    return () => unsub();
  }, [selectedJob]);

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    setShowAddForm(false);
    setSaveSuccess(false);
    setSaveError('');
    setForm({ name: '', contact: '', jobRole: job.name, location: '', experience: '', notes: '' });
  };

  const handleFormChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) {
      setSaveError('Name and contact are required.');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      await addDoc(collection(db, 'workers'), {
        name: form.name.trim(),
        contact: form.contact.trim(),
        gigType: form.jobRole || selectedJob?.name || '',
        area: form.location.trim(),
        experience: form.experience.trim(),
        notes: form.notes.trim(),
        approvalStatus: 'approved',
        status: 'active',
        createdAt: serverTimestamp(),
        addedByMason: true,
      });
      setSaveSuccess(true);
      setShowAddForm(false);
      setForm({ name: '', contact: '', jobRole: selectedJob?.name || '', location: '', experience: '', notes: '' });
    } catch (err) {
      setSaveError(err.message || 'Failed to add worker.');
    } finally {
      setSaving(false);
    }
  };

  const allJobs = SERVICE_CATALOG.filter((job) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      job.name.toLowerCase().includes(q) ||
      job.category.toLowerCase().includes(q)
    );
  });

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>🧱 Mason Dashboard</h1>
      <p style={styles.subheading}>
        View all job types and manage workers. You can see all jobs regardless of location.
      </p>

      <div style={styles.layout}>
        {/* Job list panel */}
        <div style={styles.jobPanel}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search job types…"
            style={styles.searchInput}
          />
          <div style={styles.jobList}>
            {allJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => handleSelectJob(job)}
                style={{
                  ...styles.jobItem,
                  ...(selectedJob?.id === job.id ? styles.jobItemActive : {}),
                }}
              >
                <span style={styles.jobItemIcon}>{job.icon}</span>
                <span style={styles.jobItemText}>
                  <strong>{job.name}</strong>
                  <span style={styles.jobItemCategory}>{job.category}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div style={styles.detailPanel}>
          {!selectedJob ? (
            <div style={styles.emptyState}>
              <p>← Select a job type to view workers</p>
            </div>
          ) : (
            <>
              <div style={styles.detailHeader}>
                <span style={styles.detailIcon}>{selectedJob.icon}</span>
                <div>
                  <h2 style={{ margin: 0 }}>{selectedJob.name}</h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
                    {selectedJob.category}
                  </p>
                </div>
                <button
                  onClick={() => { setShowAddForm(true); setSaveSuccess(false); }}
                  style={styles.addBtn}
                >
                  + Add Worker
                </button>
              </div>

              {saveSuccess && (
                <div style={styles.successBanner}>✅ Worker added successfully!</div>
              )}

              {showAddForm && (
                <form onSubmit={handleAddWorker} style={styles.form}>
                  <h3 style={{ margin: '0 0 14px' }}>Add New Worker</h3>

                  {saveError && <p style={styles.formError}>{saveError}</p>}

                  {[
                    { name: 'name', label: 'Full Name *', placeholder: 'e.g. Ravi Kumar' },
                    { name: 'contact', label: 'Contact / Phone *', placeholder: 'e.g. 9876543210' },
                    { name: 'location', label: 'Location / Area', placeholder: 'e.g. Kavali, Nellore' },
                    { name: 'experience', label: 'Experience', placeholder: 'e.g. 3 years' },
                  ].map((field) => (
                    <div key={field.name} style={styles.formRow}>
                      <label style={styles.formLabel}>{field.label}</label>
                      <input
                        type="text"
                        name={field.name}
                        value={form[field.name]}
                        onChange={handleFormChange}
                        placeholder={field.placeholder}
                        style={styles.formInput}
                        required={field.label.includes('*')}
                      />
                    </div>
                  ))}

                  <div style={styles.formRow}>
                    <label style={styles.formLabel}>Job Role</label>
                    <select
                      name="jobRole"
                      value={form.jobRole}
                      onChange={handleFormChange}
                      style={styles.formInput}
                    >
                      {SERVICE_CATALOG.map((j) => (
                        <option key={j.id} value={j.name}>{j.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.formRow}>
                    <label style={styles.formLabel}>Notes</label>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={handleFormChange}
                      placeholder="Any additional notes about the worker…"
                      style={{ ...styles.formInput, minHeight: 70, resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button type="submit" disabled={saving} style={styles.saveBtn}>
                      {saving ? '⏳ Saving…' : '💾 Add Worker'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      style={styles.cancelBtn}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Workers list */}
              <div style={styles.workersSection}>
                <h3 style={{ margin: '20px 0 12px', fontSize: 15 }}>
                  Registered Workers ({loadingWorkers ? '…' : workers.length})
                </h3>
                {loadingWorkers ? (
                  <p style={{ color: 'var(--text-muted)' }}>⏳ Loading…</p>
                ) : workers.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    No workers registered for this job type yet.
                  </p>
                ) : (
                  <div style={styles.workerGrid}>
                    {workers.map((w) => (
                      <div key={w.id} style={styles.workerCard}>
                        <div style={styles.workerName}>{w.name || 'Unnamed'}</div>
                        <div style={styles.workerDetail}>📞 {w.contact || '—'}</div>
                        <div style={styles.workerDetail}>📍 {w.area || '—'}</div>
                        <div style={styles.workerDetail}>
                          Status:{' '}
                          <span
                            style={{
                              color: w.status === 'active' ? 'var(--success)' : 'var(--warning)',
                              fontWeight: 600,
                            }}
                          >
                            {w.status || 'active'}
                          </span>
                        </div>
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

const styles = {
  page: {
    maxWidth: 1100,
    margin: '24px auto',
    padding: '0 20px 40px',
  },
  heading: {
    margin: '0 0 6px',
    color: 'var(--text-dark)',
  },
  subheading: {
    margin: '0 0 24px',
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '260px 1fr',
    gap: 20,
    alignItems: 'start',
  },
  jobPanel: {
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    overflow: 'hidden',
    background: 'var(--card-bg)',
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  jobList: {
    maxHeight: 600,
    overflowY: 'auto',
  },
  jobItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '12px 14px',
    background: 'none',
    border: 'none',
    borderBottom: '1px solid var(--border-color)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  jobItemActive: {
    background: 'var(--bg-light)',
    borderLeft: '3px solid var(--primary-purple)',
  },
  jobItemIcon: {
    fontSize: 20,
  },
  jobItemText: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 13,
    color: 'var(--text-dark)',
  },
  jobItemCategory: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 400,
  },
  detailPanel: {
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    background: 'var(--card-bg)',
    padding: '20px',
    minHeight: 300,
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    color: 'var(--text-muted)',
    fontSize: 15,
  },
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border-color)',
  },
  detailIcon: {
    fontSize: 36,
  },
  addBtn: {
    marginLeft: 'auto',
    padding: '9px 18px',
    background: 'var(--primary-purple)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  successBanner: {
    padding: '10px 14px',
    background: '#F0FDF4',
    border: '1px solid var(--success)',
    borderRadius: 8,
    color: '#15803d',
    fontSize: 13,
    marginBottom: 12,
  },
  form: {
    padding: '16px',
    background: 'var(--bg-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    marginBottom: 16,
  },
  formError: {
    color: 'var(--error)',
    fontSize: 13,
    margin: '0 0 10px',
  },
  formRow: {
    marginBottom: 10,
  },
  formLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-dark)',
    marginBottom: 4,
  },
  formInput: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  saveBtn: {
    padding: '10px 22px',
    background: 'var(--primary-purple)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 22px',
    background: 'transparent',
    color: 'var(--primary-purple)',
    border: '2px solid var(--primary-purple)',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  workersSection: {},
  workerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  },
  workerCard: {
    padding: '14px',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    background: '#fafafa',
  },
  workerName: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--text-dark)',
    marginBottom: 6,
  },
  workerDetail: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginBottom: 3,
  },
};
