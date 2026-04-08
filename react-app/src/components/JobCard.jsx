import React from 'react';
import { useNavigate } from 'react-router-dom';
import { specialJobIds } from '../config/specialJobs';

/**
 * Reusable card for displaying a single job/service.
 *
 * @param {object} props
 * @param {{ id, name, icon, desc, isUpcoming, category }} props.job
 * @param {boolean} props.available - Whether workers are available in user's area
 * @param {Function} [props.onBook] - Called when user clicks Book (non-special jobs)
 */
export default function JobCard({ job, available = true, onBook }) {
  const navigate = useNavigate();
  // Map the job name to a special-job id if applicable
  const specialId = resolveSpecialId(job);

  const handleClick = () => {
    if (!available) return;
    if (specialId) {
      navigate(`/jobs/${specialId}`);
    } else if (onBook) {
      onBook(job);
    }
  };

  return (
    <article className={`job-card${available ? '' : ' job-card--unavailable'}`}>
      <div className="job-card-top">
        <span className="job-card-icon" aria-hidden="true">{job.icon || '🔧'}</span>
        {job.isUpcoming && <span className="job-card-badge job-card-badge--upcoming">Coming Soon</span>}
        {!job.isUpcoming && available && <span className="job-card-badge job-card-badge--available">Available</span>}
        {!available && <span className="job-card-badge job-card-badge--unavailable">Not in area</span>}
      </div>
      <h3 className="job-card-name">{job.name}</h3>
      <p className="job-card-desc">{job.desc}</p>
      {job.category && <span className="job-card-category">{job.category}</span>}
      <div className="job-card-actions">
        {available && !job.isUpcoming ? (
          <button className="primary-btn" onClick={handleClick}>
            {specialId ? 'View Options' : 'Book Service'}
          </button>
        ) : (
          <button className="secondary-btn" disabled={!available}>
            {job.isUpcoming ? 'Notify Me' : 'Unavailable'}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Maps a SERVICE_CATALOG entry to a specialJobs id where applicable.
 * We match by name keywords since the catalog doesn't use the same ids.
 */
function resolveSpecialId(job) {
  const name = (job.name || '').toLowerCase();
  if (name.includes('driver') || name.includes('chauffeur')) return 'driver';
  if (name.includes('painter') || name.includes('painting') || name.includes('paint')) return 'painter';
  if (name.includes('kitchen') || name.includes('cook') || name.includes('chef')) return 'kitchen-work';
  if (name.includes('garden') || name.includes('gardener')) return 'garden-work';
  if (name.includes('heavy vehicle') || name.includes('bulldozer') || name.includes('crane') || name.includes('excavator') || name.includes('jcb')) return 'construction-heavy';
  if (name.includes('electrician')) return 'electrician';
  if (name.includes('plumber')) return 'plumber';
  if (name.includes('cleaner') || name.includes('cleaning') || name.includes('sanitiz')) return 'cleaner';
  if (name.includes('security') || name.includes('guard')) return 'security';
  if (name.includes('delivery') || name.includes('courier')) return 'delivery';
  // Check against explicit specialJobIds set for any direct id matches
  if (specialJobIds.has(job.id)) return job.id;
  return null;
}
