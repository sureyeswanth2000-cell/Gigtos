import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { ALL_JOBS } from '../utils/jobListBuilder';
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
    if (!location) return;

    const { lat, lng } = location;
    setAvailableJobIds(null);
    setFetchError(null);

    fetch(`/api/available-jobs?lat=${lat}&lng=${lng}&radius=${GEO_RADIUS_KM}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch available jobs');
        return res.json();
      })
      .then((data) => {
        // Expect data to be an array of job IDs or { jobs: [...] }
        const ids = Array.isArray(data) ? data : data.jobs || data.jobIds || [];
        setAvailableJobIds(new Set(ids.map(String)));
      })
      .catch((err) => {
        console.warn('Available jobs API unavailable, showing all jobs:', err.message);
        // If API is unavailable, show all jobs (graceful degradation)
        setAvailableJobIds(new Set(ALL_JOBS.map((j) => j.id)));
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
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                available={availableJobIds === null ? null : availableJobIds.has(job.id)}
                onBook={onBook || ((j) => navigate(`/service?type=${encodeURIComponent(j.name)}`))}
              />
            ))}
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
