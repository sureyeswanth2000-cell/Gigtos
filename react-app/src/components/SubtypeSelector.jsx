import React from 'react';

/**
 * SubtypeSelector — renders a grid of clickable subtype buttons/cards.
 *
 * Props:
 *  - subtypes: Array<{ id, label, icon, desc }>
 *  - availableIds: Set<string> | null — if null, show all as available
 *  - onSelect: (subtype) => void
 */
export default function SubtypeSelector({ subtypes = [], availableIds = null, onSelect }) {
  return (
    <div style={styles.grid}>
      {subtypes.map((sub) => {
        const available = availableIds === null || availableIds.has(sub.id);
        return (
          <button
            key={sub.id}
            onClick={() => available && onSelect && onSelect(sub)}
            disabled={!available}
            style={{
              ...styles.card,
              ...(available ? styles.cardActive : styles.cardDisabled),
            }}
            title={available ? sub.desc : 'Not available in your area'}
          >
            <span style={styles.icon}>{sub.icon}</span>
            <span style={styles.label}>{sub.label}</span>
            <span style={styles.desc}>{sub.desc}</span>
            {!available && (
              <span style={styles.unavailable}>Not in your area</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 14,
    marginTop: 16,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '18px 12px',
    borderRadius: 14,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
  },
  cardActive: {
    borderColor: 'var(--primary-purple)',
    boxShadow: '0 2px 12px rgba(162,89,255,0.12)',
  },
  cardDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    background: '#f9f9f9',
  },
  icon: {
    fontSize: 28,
  },
  label: {
    fontWeight: 700,
    fontSize: 14,
    color: 'var(--text-dark)',
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  unavailable: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: 600,
    marginTop: 2,
  },
};
