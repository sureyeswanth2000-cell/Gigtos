import React from 'react';

export default function FutureJobCard({ job, onAccept, onViewDetails }) {
  const isPending = job.status === 'pending';

  const statusColors = {
    pending: { bg: '#FEF3C7', color: '#92400E' },
    confirmed: { bg: '#D1FAE5', color: '#065F46' },
    accepted: { bg: '#D1FAE5', color: '#065F46' },
  };
  const sc = statusColors[job.status] || statusColors.pending;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="job-title">{job.title || job.serviceType}</div>
        <span style={{ background: sc.bg, color: sc.color, padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
          {job.status === 'accepted' || job.status === 'confirmed' ? 'Confirmed' : 'Pending'}
        </span>
      </div>
      <div className="job-meta">
        <span className="job-meta-item">📅 {formatDate(job.scheduledAt)}</span>
        {job.scheduledAt && <span className="job-meta-item">🕐 {formatTime(job.scheduledAt)}</span>}
        {job.area && <span className="job-meta-item">📍 {job.area}</span>}
      </div>
      <div className="job-actions">
        <button className="btn-secondary" onClick={() => onViewDetails && onViewDetails(job)}>
          View Details
        </button>
        {isPending && (
          <button className="btn-primary" onClick={() => onAccept && onAccept(job)}>
            ✅ Accept
          </button>
        )}
      </div>
    </div>
  );
}
