import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { ALL_JOBS } from '../utils/jobListBuilder';
import { getServiceAvailability } from '../utils/availability';
import JobCard from './JobCard';
import LocationDetector from './LocationDetector';
import NearbyMessage from './NearbyMessage';

const GEO_RADIUS_KM = 20;

/**
 * JobList – geo-filtered list of available jobs.
 * Queries the backend for available jobs within 20km of the user's location.
 */
export default function JobList({ onBook }) {
  const navigate = useNavigate();
  const { location, locationLoading } = useLocation();
  const [availableJobIds, setAvailableJobIds] = useState(null); // null = loading
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!location || !location.city) return;

    setAvailableJobIds(null);
    setFetchError(null);

    // Extract area from displayName
    const area = location.displayName ? location.displayName.split(',')[0].trim() : null;

    getServiceAvailability(location.city, area)
      .then((data) => {
        setAvailableJobIds(data);
      })
      .catch((err) => {
        console.error('Availability check failed:', err);
        const fallback = {};
        ALL_JOBS.forEach(j => fallback[j.id] = 'city');
        setAvailableJobIds(fallback);
        setFetchError('Could not load location-based availability. Showing all jobs.');
      });
  }, [location]);

  const filteredJobs = ALL_JOBS.filter((job) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return job.name.toLowerCase().includes(q) || job.desc.toLowerCase().includes(q) || (job.category || '').toLowerCase().includes(q);
  });

  const noJobsInArea = availableJobIds !== null && availableJobIds.size === 0;

  if (locationLoading) {
    return (
      <div className="job-list-status">
        <span>⏳ Detecting your location…</span>
      </div>
    );
  }

  return (
    <div className="job-list">
      <div className="job-list-header">
        <LocationDetector />
        <input
          type="text"
          className="job-list-search"
          placeholder="Search jobs (driver, plumber, painter…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search jobs"
        />
      </div>

      {fetchError && (
        <div className="job-list-error">⚠️ {fetchError}</div>
      )}

      {noJobsInArea ? (
        <NearbyMessage />
      ) : (
        <div className="job-cards-scroll-wrapper">
          <div className="job-cards-grid">
            {filteredJobs.map((job) => {
              const availLevel = availableJobIds ? (availableJobIds[String(job.id)] || 'none') : null;
              return (
                <JobCard
                  key={job.id}
                  job={job}
                  available={availLevel}
                  onBook={onBook || ((j) => {
                    if (!j?.name) {
                      alert('Job information is incomplete. Please try again later.');
                      return;
                    }
                    navigate(`/service?type=${encodeURIComponent(j.name)}`);
                  })}
                />
              );
            })}
          </div>
          {filteredJobs.length > 2 && (
            <div className="job-cards-scroll-hint">
              <span>Swipe to see more jobs</span>
              <span className="job-cards-scroll-hint-arrow">→</span>
            </div>
          )}
        </div>
      )}

      {filteredJobs.length === 0 && search && (
        <div className="job-list-empty">No jobs match "{search}". Try a different keyword.</div>
      )}
    </div>
  );
}
