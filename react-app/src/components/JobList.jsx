import React, { useState, useEffect, useCallback } from 'react';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import JobCard from './JobCard';
import LocationDetector from './LocationDetector';
import NearbyMessage from './NearbyMessage';

const RADIUS_KM = 20;

/**
 * JobList — displays geo-filtered job cards.
 *
 * Props:
 *  - onBook: (job) => void — called when user clicks "Book Service" on a non-special job
 */
export default function JobList({ onBook }) {
  const { location, locationLoading } = useAppLocation();
  const [availableJobIds, setAvailableJobIds] = useState(null); // null = loading
  const [fetchError, setFetchError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchAvailableJobs = useCallback(() => {
    if (!location) return;

    setAvailableJobIds(null);
    setFetchError(null);

    fetch(
      `/api/available-jobs?lat=${location.lat}&lng=${location.lng}&radius=${RADIUS_KM}`
    )
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // Expect: { jobIds: [1, 2, 3, ...] } or { jobs: [{id:..}, ..] }
        const ids = data.jobIds
          ? new Set(data.jobIds.map(String))
          : data.jobs
          ? new Set(data.jobs.map((j) => String(j.id)))
          : null;
        setAvailableJobIds(ids);
      })
      .catch(() => {
        // If the API isn't available yet, show all jobs (graceful fallback)
        setAvailableJobIds(new Set(SERVICE_CATALOG.map((j) => String(j.id))));
      });
  }, [location]);

  useEffect(() => {
    fetchAvailableJobs();
  }, [fetchAvailableJobs]);

  const filteredCatalog = SERVICE_CATALOG.filter((job) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      job.name.toLowerCase().includes(q) ||
      job.desc.toLowerCase().includes(q) ||
      job.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  const isAvailable = (job) =>
    availableJobIds === null || availableJobIds.has(String(job.id));

  const visibleJobs = filteredCatalog.filter(isAvailable);
  const unavailableJobs = filteredCatalog.filter((j) => !isAvailable(j));

  const isLoading = locationLoading || (location && availableJobIds === null);

  return (
    <div>
      <LocationDetector />

      <div style={styles.toolbar}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search jobs (plumber, driver, painter…)"
          style={styles.searchInput}
          aria-label="Search jobs"
        />
      </div>

      {fetchError && (
        <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 8 }}>
          ⚠️ {fetchError}
        </p>
      )}

      {isLoading ? (
        <div style={styles.loading}>⏳ Checking worker availability in your area…</div>
      ) : (
        <>
          {visibleJobs.length === 0 && !location ? (
            <NearbyMessage message="Please allow location access or enter your address to see available jobs." />
          ) : visibleJobs.length === 0 ? (
            <NearbyMessage message="No jobs or workers available in your area yet. Try a different location or check back soon." />
          ) : (
            <div style={styles.grid}>
              {visibleJobs.map((job) => (
                <JobCard key={job.id} job={job} onBook={onBook} available />
              ))}
            </div>
          )}

          {unavailableJobs.length > 0 && (
            <details style={styles.unavailableSection}>
              <summary style={styles.unavailableSummary}>
                + {unavailableJobs.length} more job types (not available in your area)
              </summary>
              <div style={styles.grid}>
                {unavailableJobs.map((job) => (
                  <JobCard key={job.id} job={job} onBook={onBook} available={false} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  toolbar: {
    marginBottom: 16,
  },
  searchInput: {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    fontSize: 14,
    color: 'var(--text-dark)',
    background: 'var(--card-bg)',
    boxSizing: 'border-box',
  },
  loading: {
    textAlign: 'center',
    padding: '32px 16px',
    color: 'var(--text-muted)',
    fontSize: 15,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
    marginTop: 8,
  },
  unavailableSection: {
    marginTop: 24,
    padding: '12px 0',
    borderTop: '1px dashed var(--border-color)',
  },
  unavailableSummary: {
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 12,
  },
};
