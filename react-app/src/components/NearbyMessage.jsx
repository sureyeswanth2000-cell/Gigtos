import React from 'react';

/**
 * NearbyMessage — displayed when no workers / jobs are available in the user's area.
 */
export default function NearbyMessage({ message }) {
  return (
    <div style={styles.wrapper}>
      <span style={styles.icon}>📍</span>
      <div>
        <p style={styles.heading}>No workers available nearby</p>
        <p style={styles.body}>
          {message ||
            'No jobs or workers are available in your area yet. Check back soon or expand your search.'}
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '18px 20px',
    background: 'var(--bg-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 14,
    marginTop: 16,
  },
  icon: {
    fontSize: 28,
    lineHeight: 1,
  },
  heading: {
    margin: '0 0 4px',
    fontWeight: 700,
    color: 'var(--text-dark)',
    fontSize: 15,
  },
  body: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: 14,
    lineHeight: 1.5,
  },
};
