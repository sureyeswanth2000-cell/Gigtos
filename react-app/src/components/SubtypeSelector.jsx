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
        const isComingSoon = subtype.comingSoon === true;
        const isDisabled = !isNearby || isComingSoon;
        return (
          <button
            key={subtype.id}
            className={`subtype-card${isDisabled ? ' subtype-card--disabled' : ''}`}
            onClick={() => !isDisabled && onSelect && onSelect(subtype)}
            disabled={isDisabled}
            title={isComingSoon ? 'Coming soon' : isNearby ? subtype.desc : 'Not available in your area'}
          >
            <span className="subtype-icon">{subtype.icon}</span>
            <span className="subtype-label">{subtype.label}</span>
            {isComingSoon ? (
              <span className="job-badge job-badge--upcoming">Coming Soon</span>
            ) : isNearby ? (
              <span className="job-badge job-badge--available">Available</span>
            ) : (
              <span className="job-badge job-badge--unavailable">Coming Soon</span>
            )}
            <span className="subtype-desc">{subtype.desc}</span>
            {!isNearby && !isComingSoon && (
              <span className="subtype-unavailable-tag">Not nearby</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
