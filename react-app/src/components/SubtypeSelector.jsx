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
        const isAvailable = available === null || available.has(subtype.id);
        return (
          <button
            key={subtype.id}
            className={`subtype-card${isAvailable ? '' : ' subtype-card--disabled'}`}
            onClick={() => isAvailable && onSelect && onSelect(subtype)}
            disabled={!isAvailable}
            title={isAvailable ? subtype.desc : 'Not available in your area'}
          >
            <span className="subtype-icon">{subtype.icon}</span>
            <span className="subtype-label">{subtype.label}</span>
            <span className="subtype-desc">{subtype.desc}</span>
            {!isAvailable && (
              <span className="subtype-unavailable-tag">Not nearby</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
