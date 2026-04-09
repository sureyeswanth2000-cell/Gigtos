import React, { useState } from 'react';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { SPECIAL_JOBS } from '../config/specialJobs';
import './WorkerRegistration.css';

const MAX_SELECTIONS = 3;

// Combine SERVICE_CATALOG + SPECIAL_JOBS into one unified list for worker selection
function buildAllJobOptions() {
  const options = [];
  const seen = new Set();

  // Add special jobs first (they have dedicated pages)
  for (const sj of SPECIAL_JOBS) {
    if (!seen.has(sj.id)) {
      options.push({ id: sj.id, name: sj.label, icon: sj.icon, category: sj.category });
      seen.add(sj.id);
    }
  }

  // Add remaining catalog items
  for (const svc of SERVICE_CATALOG) {
    const normalizedId = svc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!seen.has(normalizedId)) {
      options.push({ id: normalizedId, name: svc.name, icon: svc.icon, category: svc.category });
      seen.add(normalizedId);
    }
  }

  return options;
}

const ALL_JOB_OPTIONS = buildAllJobOptions();

/**
 * WorkerRegistration – allows workers to select up to 3 job types.
 * Shows all job types (NOT geo-filtered).
 * After selection, shows "Pending region lead approval" status.
 */
export default function WorkerRegistration({ onSubmit }) {
  const [selected, setSelected] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [search, setSearch] = useState('');
  const [validationMsg, setValidationMsg] = useState('');

  const toggleJob = (job) => {
    setValidationMsg('');
    setSelected((prev) => {
      const alreadySelected = prev.find((j) => j.id === job.id);
      if (alreadySelected) {
        return prev.filter((j) => j.id !== job.id);
      }
      if (prev.length >= MAX_SELECTIONS) {
        setValidationMsg(`You can only select up to ${MAX_SELECTIONS} job types.`);
        return prev;
      }
      return [...prev, job];
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      setValidationMsg('Please select at least one job type.');
      return;
    }
    setSubmitted(true);
    if (onSubmit) onSubmit(selected);
  };

  const filteredOptions = ALL_JOB_OPTIONS.filter((job) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return job.name.toLowerCase().includes(q) || (job.category || '').toLowerCase().includes(q);
  });

  if (submitted) {
    return (
      <div className="worker-reg-page">
        <div className="worker-reg-shell">
          <div className="worker-reg-success">
            <div className="worker-reg-success-icon">⏳</div>
            <h2>Registration Submitted</h2>
            <p>Your selected job types are pending region lead approval.</p>
            <div className="worker-reg-selected-list">
              {selected.map((job) => (
                <span key={job.id} className="worker-reg-job-chip">
                  {job.icon} {job.name}
                </span>
              ))}
            </div>
            <div className="worker-reg-status-badge">
              🕐 Pending Region Lead Approval
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="worker-reg-page">
      <div className="worker-reg-shell">
        <h1 className="worker-reg-title">👷 Worker Job Registration</h1>
        <p className="worker-reg-subtitle">
          Select up to <strong>{MAX_SELECTIONS}</strong> job types you want to work in.
          Your selections will be sent to your region lead for approval.
        </p>

        <div className="worker-reg-counter">
          <span className={`worker-reg-count ${selected.length >= MAX_SELECTIONS ? 'worker-reg-count--full' : ''}`}>
            {selected.length}/{MAX_SELECTIONS} selected
          </span>
          {selected.length > 0 && (
            <div className="worker-reg-chips">
              {selected.map((job) => (
                <button
                  key={job.id}
                  className="worker-reg-chip"
                  onClick={() => toggleJob(job)}
                  title="Remove"
                >
                  {job.icon} {job.name} ✕
                </button>
              ))}
            </div>
          )}
        </div>

        {validationMsg && (
          <div className="worker-reg-validation">{validationMsg}</div>
        )}

        <input
          type="text"
          className="worker-reg-search"
          placeholder="Search job types…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search job types"
        />

        <form onSubmit={handleSubmit}>
          <div className="worker-reg-grid">
            {filteredOptions.map((job) => {
              const isChecked = !!selected.find((j) => j.id === job.id);
              const isDisabled = !isChecked && selected.length >= MAX_SELECTIONS;
              return (
                <label
                  key={job.id}
                  className={`worker-reg-job-item${isChecked ? ' worker-reg-job-item--checked' : ''}${isDisabled ? ' worker-reg-job-item--disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => toggleJob(job)}
                  />
                  <span className="worker-reg-job-icon">{job.icon}</span>
                  <span className="worker-reg-job-name">{job.name}</span>
                  {job.category && (
                    <span className="worker-reg-job-cat">{job.category}</span>
                  )}
                </label>
              );
            })}
          </div>

          {filteredOptions.length === 0 && (
            <p className="worker-reg-empty">No job types found for "{search}".</p>
          )}

          <div className="worker-reg-footer">
            <button
              type="submit"
              className="btn-primary worker-reg-submit"
              disabled={selected.length === 0}
            >
              Submit for Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
