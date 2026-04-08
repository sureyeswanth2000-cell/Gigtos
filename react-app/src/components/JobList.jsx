import React, { useEffect, useState } from 'react';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { useLocation } from '../context/LocationContext';
import JobCard from './JobCard';
import LocationDetector from './LocationDetector';
import NearbyMessage from './NearbyMessage';

const RADIUS_KM = 20;

/**
 * Geo-filtered job listings.
 * - Fetches available jobs from the backend based on the user's location.
 * - Falls back to showing all jobs with an "isUpcoming" flag if no location.
 * - Special jobs route to /jobs/:id; regular jobs call onBook.
 *
 * @param {object} props
 * @param {Function} [props.onBook] - Called when a non-special job card is booked
 */
export default function JobList({ onBook }) {
  const { location, locationLoading } = useLocation();
  const [availableJobIds, setAvailableJobIds] = useState(null); // null = not yet fetched
  const [fetchError, setFetchError] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!location) return;

    let cancelled = false;
    setFetching(true);
    setFetchError(null);

    fetch(
      `/api/available-jobs?lat=${location.lat}&lng=${location.lng}&radius=${RADIUS_KM}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          // Backend returns { jobIds: [...] } or an array of ids
          const ids = Array.isArray(data) ? data : data.jobIds || [];
          setAvailableJobIds(new Set(ids.map(String)));
        }
      })
      .catch(() => {
        // If the API call fails (e.g., emulator not running) show all jobs
        if (!cancelled) {
          setAvailableJobIds(null);
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location]);

  const visibleJobs = SERVICE_CATALOG.filter((job) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return (
        job.name.toLowerCase().includes(q)
        || job.desc.toLowerCase().includes(q)
        || job.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Determine if a job is "available" in the user's area
  const isJobAvailable = (job) => {
    if (availableJobIds === null) return !job.isUpcoming; // fallback: show active jobs
    return availableJobIds.has(String(job.id));
  };

  const availableJobs = visibleJobs.filter(isJobAvailable);
  const showNoJobs = !locationLoading && !fetching && location && availableJobs.length === 0;

  return (
    <section className="job-list-section">
      <LocationDetector />

      <div className="job-list-tools">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search services (plumber, driver, painter...)"
          aria-label="Search services"
          className="job-list-search"
        />
      </div>

      {(locationLoading || fetching) && (
        <div className="job-list-loading">⏳ Finding workers near you…</div>
      )}

      {fetchError && (
        <div className="job-list-error">⚠️ {fetchError}</div>
      )}

      {showNoJobs ? (
        <NearbyMessage />
      ) : (
        <div className="services-grid">
          {visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              available={isJobAvailable(job)}
              onBook={onBook}
            />
          ))}
        </div>
      )}

      {visibleJobs.length === 0 && searchQuery && (
        <div className="no-services-note">
          No services found for "{searchQuery}". Try another keyword.
        </div>
      )}
    </section>
  );
}
