import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { useToast } from '../context/ToastContext';
import { ALL_JOBS } from '../utils/jobListBuilder';
import { getServiceAvailability } from '../utils/availability';
import JobCard from './JobCard';
import LocationDetector from './LocationDetector';
import NearbyMessage from './NearbyMessage';

function isMaidOrCoreHelp(job) {
  const text = `${job?.name || ''} ${job?.category || ''} ${(job?.keywords || []).join(' ')}`.toLowerCase();
  return /(maid|helper|household|home help|kitchen|clean|bathroom|bedroom|laundry|cook)/.test(text);
}

function shouldShowConsumerJob(job, availabilityMap) {
  if (!job) return false;
  if (!availabilityMap) return !job.isUpcoming || isMaidOrCoreHelp(job);
  const level = availabilityMap[String(job.id)] || 'none';
  return level === 'area' || level === 'city' || isMaidOrCoreHelp(job);
}

function buildCityFallbackAvailability() {
  return ALL_JOBS.reduce((fallback, job) => {
    if (job?.id != null) fallback[String(job.id)] = 'city';
    return fallback;
  }, {});
}

/**
 * Geo-filtered service list with safe fallbacks when location or service data is incomplete.
 */
export default function JobList({ onBook }) {
  const navigate = useNavigate();
  const { location, locationLoading, locationError } = useLocation();
  const toast = useToast();
  const [availableJobIds, setAvailableJobIds] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!location || !location.city) {
      if (!locationLoading && locationError) {
        setAvailableJobIds(buildCityFallbackAvailability());
        setFetchError('Location is unavailable. Showing city-level service options.');
      }
      return;
    }

    setAvailableJobIds(null);
    setFetchError(null);

    const area = location.displayName ? location.displayName.split(',')[0].trim() : null;

    getServiceAvailability(location.city, area)
      .then((data) => {
        setAvailableJobIds(data);
      })
      .catch((err) => {
        console.error('Availability check failed:', err);
        setAvailableJobIds(buildCityFallbackAvailability());
        setFetchError('Could not load location-based availability. Showing all jobs.');
      });
  }, [location, locationLoading, locationError]);

  const filteredJobs = ALL_JOBS
    .filter((job) => shouldShowConsumerJob(job, availableJobIds))
    .filter((job) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (job?.name || '').toLowerCase().includes(q)
        || (job?.desc || '').toLowerCase().includes(q)
        || (job?.category || '').toLowerCase().includes(q);
    });

  const noJobsInArea = availableJobIds !== null
    && Object.values(availableJobIds).length > 0
    && Object.values(availableJobIds).every((level) => level === 'none');

  if (locationLoading) {
    return (
      <div className="job-list-status">
        <span>Detecting your location...</span>
      </div>
    );
  }

  const handleBook = onBook || ((job) => {
    const serviceName = typeof job?.name === 'string' ? job.name.trim() : '';
    if (!serviceName) {
      toast?.addToast?.('Job information is incomplete. Please try again later.', 'error');
      return;
    }
    navigate(`/service?type=${encodeURIComponent(serviceName)}`);
  });

  return (
    <div className="job-list">
      <div className="job-list-header">
        <LocationDetector />
        <input
          type="text"
          className="job-list-search"
          placeholder="Search jobs (driver, plumber, painter...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search jobs"
        />
      </div>

      {fetchError && (
        <div className="job-list-error">Warning: {fetchError}</div>
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
                  key={job.id || job.name}
                  job={job}
                  available={availLevel}
                  onBook={handleBook}
                />
              );
            })}
          </div>
          {filteredJobs.length > 2 && (
            <div className="job-cards-scroll-hint">
              <span>Swipe to see more jobs</span>
              <span className="job-cards-scroll-hint-arrow">-&gt;</span>
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
