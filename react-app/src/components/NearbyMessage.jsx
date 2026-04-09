import React from 'react';

/**
 * NearbyMessage – shown when no workers or jobs are available in the user's area.
 */
export default function NearbyMessage({ message, onRetry }) {
  return (
    <div className="nearby-message">
      <div className="nearby-message-icon">🗺️</div>
      <h3 className="nearby-message-title">
        {message || 'No jobs or workers available in your area yet.'}
      </h3>
      <p className="nearby-message-body">
        We're expanding to more areas soon. Check back later or try a different location.
      </p>
      {onRetry && (
        <button className="btn-secondary" onClick={onRetry}>
          🔄 Try Again
        </button>
      )}
    </div>
  );
}
