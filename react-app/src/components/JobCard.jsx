import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isSpecialJob } from '../config/specialJobs';
import { useToast } from '../context/ToastContext';

/**
 * Reusable service/job card with availability state and guarded navigation.
 */
export default function JobCard({ job, available = null, onBook }) {
  const navigate = useNavigate();
  const toast = useToast();
  const safeJob = job || {};
  const jobId = safeJob.id != null ? String(safeJob.id) : '';
  const serviceName = typeof safeJob.name === 'string' ? safeJob.name.trim() : '';
  const hasSpecialPage = Boolean(jobId) && isSpecialJob(jobId);

  const handleClick = () => {
    if (available === 'none') return;

    if (hasSpecialPage) {
      navigate(`/jobs/${encodeURIComponent(jobId)}`);
      return;
    }

    if (!serviceName) {
      toast?.addToast?.('Job information is incomplete. Please try again later.', 'error');
      return;
    }

    if (onBook) {
      onBook({ ...safeJob, name: serviceName });
      return;
    }

    toast?.addToast?.('Booking is not available for this service yet.', 'info');
  };

  const isDisabled = (available === 'none' || available === false) && !hasSpecialPage;
  const isLoading = available === null;
  const isNearMe = available === 'area';

  return (
    <article className={`job-card${isDisabled ? ' job-card--disabled' : ''}${isLoading ? ' job-card--loading' : ''}`}>
      <div className="job-card-header">
        <span className="job-card-icon">{safeJob.icon || 'Service'}</span>
        {isNearMe && (
          <span className="job-badge job-badge--near">Near You</span>
        )}
        {available === 'city' && (
          <span className="job-badge job-badge--available">Verified</span>
        )}
        {(available === 'none' || available === false) && (
          <span className="job-badge job-badge--unavailable">Occupied</span>
        )}
      </div>
      <h3 className="job-card-title">{serviceName || 'Service unavailable'}</h3>
      <p className="job-card-desc">{safeJob.desc || 'This service is missing details right now.'}</p>
      {safeJob.category && (
        <span className="job-card-category">{safeJob.category}</span>
      )}
      <div className="job-card-actions">
        {isDisabled ? (
          <button className="btn-secondary" disabled>
            All workers occupied
          </button>
        ) : hasSpecialPage ? (
          <button
            className="btn-primary"
            onClick={handleClick}
            style={isNearMe ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : {}}
          >
            View Options -&gt;
          </button>
        ) : (
          <button className="btn-primary" onClick={handleClick} disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Book Service'}
          </button>
        )}
      </div>
    </article>
  );
}
