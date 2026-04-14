import React from 'react';
import { useNavigate } from 'react-router-dom';
import { isSpecialJob } from '../config/specialJobs';
import { useToast } from '../context/ToastContext';

/**
 * JobCard – reusable card for displaying a job/service with availability indicator.
 *
 * Props:
 *   job          – { id, name, icon, desc, category, isUpcoming }
 *   available    – boolean | null (null = unknown/loading)
 *   onBook       – callback when "Book" is clicked (for regular jobs)
 *   showUpcoming – whether to show upcoming badge
 */
export default function JobCard({ job, available = null, onBook, showUpcoming = true }) {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const hasSpecialPage = isSpecialJob(job.id);

  const handleClick = () => {
    if (available === 'none') return; // disabled
    if (!job?.id) {
      addToast('Job information is incomplete. Please try again later.', 'error');
      return;
    }
    if (hasSpecialPage) {
      navigate(`/jobs/${job.id}`);
    } else if (onBook) {
      onBook(job);
    }
  };

  // For special jobs (like 'driver'), always allow navigation to options page
  const isDisabled = (available === 'none' || available === false) && !hasSpecialPage;
  const isLoading = available === null;
  const isNearMe = available === 'area';

  return (
    <article className={`job-card${isDisabled ? ' job-card--disabled' : ''}${isLoading ? ' job-card--loading' : ''}`}>
      <div className="job-card-header">
        <span className="job-card-icon">{job.icon || '🔧'}</span>
        {showUpcoming && job.isUpcoming && (
          <span className="job-badge job-badge--upcoming">Coming Soon</span>
        )}
        {isNearMe && (
          <span className="job-badge job-badge--near">Near You</span>
        )}
        {available === 'city' && (
          <span className="job-badge job-badge--available">Verified</span>
        )}
        {(available === 'none' || available === false) && (
          <span className="job-badge job-badge--unavailable">Coming Soon</span>
        )}
      </div>
      <h3 className="job-card-title">{job.name}</h3>
      <p className="job-card-desc">{job.desc}</p>
      {job.category && (
        <span className="job-card-category">{job.category}</span>
      )}
      <div className="job-card-actions">
        {isDisabled ? (
          <button className="btn-secondary" disabled>
            Coming Soon in Your Area
          </button>
        ) : hasSpecialPage ? (
          <button 
            className="btn-primary" 
            onClick={handleClick}
            style={isNearMe ? { background: 'linear-gradient(135deg, #10b981, #059669)' } : {}}
          >
            View Options →
          </button>
        ) : (
          <button className="btn-primary" onClick={handleClick} disabled={isLoading}>
            {isLoading ? 'Checking…' : 'Book Service'}
          </button>
        )}
      </div>
    </article>
  );
}
