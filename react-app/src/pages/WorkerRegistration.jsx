import React, { useState } from 'react';
import { SERVICE_CATALOG } from '../utils/aiAssistant';

const MAX_SELECTIONS = 3;

/**
 * Worker Registration page — allows a worker to select up to 3 job types.
 * Shows ALL job types (not geo-filtered) in a scrollable, searchable list.
 * After selection, shows a "Pending region lead approval" status.
 *
 * In a real app this would write to Firestore; here we keep it self-contained
 * and call the optional `onSubmit` prop with the selected jobs.
 *
 * @param {object} props
 * @param {Function} [props.onSubmit] - Called with selected jobs array
 * @param {string[]} [props.initialSelected] - Pre-selected job ids (for editing)
 */
export default function WorkerRegistration({ onSubmit, initialSelected = [] }) {
  const [selected, setSelected] = useState(new Set(initialSelected));
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [validationMsg, setValidationMsg] = useState('');

  const allJobs = SERVICE_CATALOG; // all 39+ job types, no geo-filter

  const visible = allJobs.filter((job) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      job.name.toLowerCase().includes(q)
      || job.desc.toLowerCase().includes(q)
      || job.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  const toggleJob = (jobId) => {
    const id = String(jobId);
    if (selected.has(id)) {
      const next = new Set(selected);
      next.delete(id);
      setSelected(next);
      setValidationMsg('');
    } else {
      if (selected.size >= MAX_SELECTIONS) {
        setValidationMsg(`You can only select up to ${MAX_SELECTIONS} job types.`);
        return;
      }
      const next = new Set(selected);
      next.add(id);
      setSelected(next);
      setValidationMsg('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selected.size === 0) {
      setValidationMsg('Please select at least one job type.');
      return;
    }
    const selectedJobs = allJobs.filter((j) => selected.has(String(j.id)));
    if (onSubmit) onSubmit(selectedJobs);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="worker-reg-page">
        <div className="worker-reg-shell">
          <div className="worker-reg-success">
            <span className="worker-reg-success-icon">⏳</span>
            <h2>Application Submitted!</h2>
            <p>Your selected job types have been sent for <strong>region lead approval</strong>.</p>
            <p className="worker-reg-pending-note">
              Status: <span className="badge-pending">Pending region lead approval</span>
            </p>
            <p>You will be notified once your application is reviewed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="worker-reg-page">
      <div className="worker-reg-shell">
        <h1 className="worker-reg-title">Register as a Worker</h1>
        <p className="worker-reg-subtitle">
          Select up to <strong>{MAX_SELECTIONS} job types</strong> you want to work in.
          Your selections will be reviewed and approved by your region lead.
        </p>

        <div className="worker-reg-counter">
          {selected.size} / {MAX_SELECTIONS} selected
        </div>

        <input
          className="worker-reg-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search job types…"
          aria-label="Search job types"
        />

        {validationMsg && (
          <div className="worker-reg-validation">{validationMsg}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="worker-reg-job-list">
            {visible.map((job) => {
              const id = String(job.id);
              const isChecked = selected.has(id);
              const isDisabled = !isChecked && selected.size >= MAX_SELECTIONS;
              return (
                <label
                  key={id}
                  className={`worker-reg-job-item${isChecked ? ' worker-reg-job-item--selected' : ''}${isDisabled ? ' worker-reg-job-item--disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => toggleJob(id)}
                    aria-label={job.name}
                  />
                  <span className="worker-reg-job-icon">{job.icon}</span>
                  <span className="worker-reg-job-info">
                    <strong>{job.name}</strong>
                    <span>{job.desc}</span>
                  </span>
                  <span className="worker-reg-job-category">{job.category}</span>
                </label>
              );
            })}
          </div>

          {visible.length === 0 && (
            <p className="worker-reg-no-results">No job types match your search.</p>
          )}

          <div className="worker-reg-actions">
            <button
              type="submit"
              className="primary-btn"
              disabled={selected.size === 0}
            >
              Submit for Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
