import React from 'react';

/**
 * A friendly empty-state message shown when no jobs or workers are
 * available within the user's 20 km area.
 *
 * @param {object} props
 * @param {string} [props.message] - Custom message to display.
 * @param {boolean} [props.isSubtype] - True when shown inside a job detail page for a subtype.
 */
export default function NearbyMessage({ message, isSubtype = false }) {
  return (
    <div className="nearby-message">
      <span className="nearby-message-icon">{isSubtype ? '🔍' : '📍'}</span>
      <h3 className="nearby-message-title">
        {isSubtype ? 'Not available in your area' : 'No jobs available near you'}
      </h3>
      <p className="nearby-message-text">
        {message || "No jobs or workers available in your area yet. We're working hard to expand — check back soon!"}
      </p>
    </div>
  );
}
