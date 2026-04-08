import React, { useState } from 'react';
import { SERVICE_CATALOG } from '../utils/aiAssistant';

const MAX_SELECTIONS = 3;

/**
 * WorkerRegistration — lets workers select up to 3 job types.
 * Shows ALL job types (no geo-filter).
 *
 * Props:
 *  - initialSelected: string[] — pre-selected job ids
 *  - onSave: (selectedIds: string[]) => Promise<void>
 *  - pendingApproval: boolean — if true, show "Pending region lead approval" status
 */
export default function WorkerRegistration({ initialSelected = [], onSave, pendingApproval = false }) {
  const [selected, setSelected] = useState(new Set(initialSelected.map(String)));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const allJobs = SERVICE_CATALOG;

  const filtered = allJobs.filter((job) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      job.name.toLowerCase().includes(q) ||
      job.desc.toLowerCase().includes(q) ||
      job.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  const toggle = (jobId) => {
    const id = String(jobId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECTIONS) {
        next.add(id);
      } else {
        setError(`You can select up to ${MAX_SELECTIONS} job types only.`);
        return prev;
      }
      setError('');
      return next;
    });
  };

  const handleSave = async () => {
    if (selected.size === 0) {
      setError('Please select at least 1 job type.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (onSave) await onSave([...selected]);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.heading}>Select Your Job Types</h2>
      <p style={styles.subheading}>
        Choose up to <strong>{MAX_SELECTIONS}</strong> job types you want to work on.
        After selection, a region lead will approve your registration.
      </p>

      {pendingApproval && (
        <div style={styles.pendingBanner}>
          ⏳ <strong>Pending region lead approval.</strong> Your selected job types are under review.
        </div>
      )}

      {saved && !pendingApproval && (
        <div style={styles.successBanner}>
          ✅ Job types saved! <strong>Pending region lead approval.</strong>
        </div>
      )}

      <div style={styles.counter}>
        {selected.size} / {MAX_SELECTIONS} selected
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search job types…"
        style={styles.searchInput}
        aria-label="Search job types"
      />

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.list}>
        {filtered.map((job) => {
          const id = String(job.id);
          const isSelected = selected.has(id);
          const isDisabled = !isSelected && selected.size >= MAX_SELECTIONS;

          return (
            <label
              key={id}
              style={{
                ...styles.item,
                ...(isSelected ? styles.itemSelected : {}),
                ...(isDisabled ? styles.itemDisabled : {}),
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(job.id)}
                disabled={isDisabled}
                style={{ accentColor: 'var(--primary-purple)', width: 16, height: 16 }}
              />
              <span style={styles.itemIcon}>{job.icon || '🔧'}</span>
              <span style={styles.itemContent}>
                <span style={styles.itemName}>{job.name}</span>
                <span style={styles.itemDesc}>{job.desc}</span>
                <span style={styles.itemCategory}>{job.category}</span>
              </span>
            </label>
          );
        })}

        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: 12 }}>
            No job types match your search.
          </p>
        )}
      </div>

      <div style={styles.footer}>
        <button
          onClick={handleSave}
          disabled={saving || selected.size === 0}
          style={{
            ...styles.saveBtn,
            opacity: saving || selected.size === 0 ? 0.6 : 1,
          }}
        >
          {saving ? '⏳ Saving…' : '💾 Save Job Preferences'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '24px 20px 40px',
  },
  heading: {
    margin: '0 0 6px',
    color: 'var(--text-dark)',
  },
  subheading: {
    margin: '0 0 16px',
    color: 'var(--text-muted)',
    fontSize: 14,
    lineHeight: 1.6,
  },
  pendingBanner: {
    padding: '12px 16px',
    background: '#FFF7ED',
    border: '1px solid var(--warning)',
    borderRadius: 10,
    color: '#92400e',
    fontSize: 14,
    marginBottom: 12,
  },
  successBanner: {
    padding: '12px 16px',
    background: '#F0FDF4',
    border: '1px solid var(--success)',
    borderRadius: 10,
    color: '#15803d',
    fontSize: 14,
    marginBottom: 12,
  },
  counter: {
    display: 'inline-block',
    padding: '4px 12px',
    background: 'var(--primary-purple-light)',
    color: 'var(--primary-purple-dark)',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 12,
  },
  searchInput: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    fontSize: 14,
    color: 'var(--text-dark)',
    marginBottom: 8,
    boxSizing: 'border-box',
  },
  error: {
    color: 'var(--error)',
    fontSize: 13,
    margin: '4px 0 8px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 480,
    overflowY: 'auto',
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 14px',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    cursor: 'pointer',
    background: 'var(--card-bg)',
    transition: 'all 0.15s',
  },
  itemSelected: {
    borderColor: 'var(--primary-purple)',
    background: 'var(--bg-light)',
    boxShadow: '0 2px 8px rgba(162,89,255,0.12)',
  },
  itemDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  itemIcon: {
    fontSize: 22,
    lineHeight: 1,
    marginTop: 2,
  },
  itemContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  itemName: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--text-dark)',
  },
  itemDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  itemCategory: {
    fontSize: 11,
    color: 'var(--primary-purple)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  footer: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  saveBtn: {
    padding: '12px 28px',
    background: 'var(--primary-purple)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
};
