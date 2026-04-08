import React from 'react';

/**
 * Renders a row of clickable subtype buttons/cards for a special job category.
 *
 * @param {object} props
 * @param {Array<{id, label, icon, desc}>} props.subtypes - All subtypes for this job
 * @param {Set<string>|null} props.availableIds - Set of available subtype ids (null = all)
 * @param {Function} props.onSelect - Called with subtype object when user clicks
 */
export default function SubtypeSelector({ subtypes, availableIds, onSelect }) {
  return (
    <div className="subtype-grid">
      {subtypes.map((subtype) => {
        const isAvailable = availableIds === null || availableIds.has(subtype.id);
        return (
          <button
            key={subtype.id}
            className={`subtype-card${isAvailable ? '' : ' subtype-card--unavailable'}`}
            onClick={() => isAvailable && onSelect && onSelect(subtype)}
            disabled={!isAvailable}
            aria-disabled={!isAvailable}
          >
            <span className="subtype-card-icon" aria-hidden="true">{subtype.icon}</span>
            <span className="subtype-card-label">{subtype.label}</span>
            <span className="subtype-card-desc">{subtype.desc}</span>
            {!isAvailable && (
              <span className="subtype-card-unavailable-tag">Not in your area</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
