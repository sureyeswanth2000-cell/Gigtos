import React from 'react';

/**
 * SubtypeSelector – renders a list of job subtypes as clickable cards/buttons.
 *
 * Props:
 *   subtypes     – [{ id, label, icon, desc }]
 *   available    – Set of available subtype IDs, or null (all enabled)
 *   onSelect     – callback(subtype) when a subtype is selected
 *   loading      – boolean, show loading state
 */
export default function SubtypeSelector({ subtypes = [], available = null, onSelect, loading = false }) {
  if (loading) {
    return (
      <div className="subtype-grid">
        {subtypes.map((subtype) => (
          <div key={subtype.id} className="subtype-card subtype-card--loading">
            <span className="subtype-icon">{subtype.icon}</span>
            <span className="subtype-label">{subtype.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="subtype-grid">
      {subtypes.map((subtype) => {
        const isNearby = available === null || available.has(subtype.id);
        const isUnavailable = subtype.comingSoon === true;
        const isDisabled = !isNearby || isUnavailable;
        return (
          <button
            key={subtype.id}
            className={`subtype-card${isDisabled ? ' subtype-card--disabled' : ''}`}
            onClick={() => !isDisabled && onSelect && onSelect(subtype)}
            disabled={isDisabled}
            title={isNearby && !isUnavailable ? subtype.desc : 'All workers are occupied. Please check again shortly.'}
          >
            <span className="subtype-icon">{subtype.icon}</span>
            <span className="subtype-label">{subtype.label}</span>
            {isUnavailable || !isNearby ? (
              <span className="job-badge job-badge--upcoming">Occupied</span>
            ) : (
              <span className="job-badge job-badge--available">Available</span>
            )}
            <span className="subtype-desc">{subtype.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
