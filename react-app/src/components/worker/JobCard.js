import React from 'react';

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function JobCard({ job, onSendQuote, onViewDetails }) {
  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="job-title">{job.title || job.serviceType || 'Job'}</div>
        <span className="job-category-badge">{job.category || job.gigType || 'General'}</span>
      </div>
      {job.description && (
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 8px', lineHeight: 1.4 }}>
          {job.description}
        </p>
      )}
      <div className="job-meta">
        {job.area && <span className="job-meta-item">📍 {job.area}</span>}
        {job.distance && <span className="job-meta-item">🗺️ {job.distance}</span>}
        {job.createdAt && <span className="job-meta-item">🕐 {timeAgo(job.createdAt)}</span>}
        {job.budget && <span className="job-meta-item">💰 ₹{job.budget}</span>}
      </div>
      <div className="job-actions">
        <button className="btn-secondary" onClick={() => onViewDetails && onViewDetails(job)}>
          View Details
        </button>
        <button className="btn-primary" onClick={() => onSendQuote && onSendQuote(job)}>
          Send Quote
        </button>
      </div>
    </div>
  );
}
