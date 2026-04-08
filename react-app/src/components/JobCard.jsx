import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getSpecialJobByName } from '../config/specialJobs';

/**
 * JobCard — reusable card for displaying a single job/service.
 *
 * Props:
 *  - job: { id, name, icon, desc, isUpcoming, category }
 *  - onBook: (job) => void — called for non-special jobs
 *  - available: boolean — whether workers are available in the user's area
 */
export default function JobCard({ job, onBook, available = true }) {
  const navigate = useNavigate();

  const specialJob = getSpecialJobByName(job.name);
  const isSpecial = !!specialJob;

  const handleClick = () => {
    if (!available) return;
    if (isSpecial) {
      navigate(`/jobs/${specialJob.id}`);
    } else if (onBook) {
      onBook(job);
    }
  };

  return (
    <article style={{ ...styles.card, opacity: available ? 1 : 0.55 }}>
      <div style={styles.top}>
        <span style={styles.icon}>{job.icon || '🔧'}</span>
        {available ? (
          <span style={styles.availablePill}>✓ Available</span>
        ) : (
          <span style={styles.unavailablePill}>Not in your area</span>
        )}
      </div>

      <h3 style={styles.title}>{job.name}</h3>
      <p style={styles.desc}>{job.desc}</p>

      {job.category && (
        <span style={styles.category}>{job.category}</span>
      )}

      <button
        onClick={handleClick}
        disabled={!available}
        style={{
          ...styles.btn,
          ...(available ? styles.btnActive : styles.btnDisabled),
        }}
      >
        {isSpecial ? 'View Options →' : available ? 'Book Service' : 'Unavailable'}
      </button>
    </article>
  );
}

const styles = {
  card: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    transition: 'box-shadow 0.2s',
  },
  top: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
  },
  availablePill: {
    background: '#dcfce7',
    color: '#15803d',
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 999,
  },
  unavailablePill: {
    background: '#f3f4f6',
    color: '#6b7280',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 999,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-dark)',
  },
  desc: {
    margin: 0,
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    flexGrow: 1,
  },
  category: {
    fontSize: 11,
    color: 'var(--primary-purple)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  btn: {
    marginTop: 4,
    padding: '9px 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.15s',
  },
  btnActive: {
    background: 'var(--primary-purple)',
    color: '#fff',
  },
  btnDisabled: {
    background: '#f3f4f6',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
};
