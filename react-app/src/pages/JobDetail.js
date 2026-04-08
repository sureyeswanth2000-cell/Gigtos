import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { getSpecialJob } from '../config/specialJobs';
import SubtypeSelector from '../components/SubtypeSelector';
import NearbyMessage from '../components/NearbyMessage';
import LocationDetector from '../components/LocationDetector';
import './JobDetail.css';

const GEO_RADIUS_KM = 20;

/**
 * JobDetail – dedicated page for special job categories (e.g. /jobs/driver).
 * Loads subtypes from config and filters by worker availability in 20km.
 */
export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { location, locationLoading } = useLocation();
  const job = getSpecialJob(jobId);

  const [availableSubtypeIds, setAvailableSubtypeIds] = useState(null); // null = loading
  const [fetchError, setFetchError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!job || !location) return;

    const { lat, lng } = location;
    setAvailableSubtypeIds(null);
    setFetchError(null);

    fetch(`/api/workers?job=${jobId}&lat=${lat}&lng=${lng}&radius=${GEO_RADIUS_KM}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch available workers');
        return res.json();
      })
      .then((data) => {
        // Expect { subtypes: ['driver-with-car', ...] } or array of subtype IDs
        const ids = Array.isArray(data) ? data : data.subtypes || data.subTypeIds || [];
        setAvailableSubtypeIds(new Set(ids.map(String)));
      })
      .catch((err) => {
        console.warn('Worker availability API unavailable, showing all subtypes:', err.message);
        // Graceful degradation: show all subtypes when API unavailable
        if (job) {
          setAvailableSubtypeIds(new Set(job.subtypes.map((s) => s.id)));
        }
        setFetchError('Could not load worker availability. Showing all options.');
      });
  }, [job, jobId, location]);

  if (!job) {
    return (
      <div className="job-detail-not-found">
        <h2>Job category not found</h2>
        <button className="btn-secondary" onClick={() => navigate('/jobs')}>← Back to Jobs</button>
      </div>
    );
  }

  const hasAvailableSubtypes = availableSubtypeIds === null || availableSubtypeIds.size > 0;

  const handleSubtypeSelect = (subtype) => {
    setSelected(subtype);
  };

  const handleBookSubtype = () => {
    if (selected) {
      navigate(`/service?type=${encodeURIComponent(selected.label)}`);
    }
  };

  return (
    <div className="job-detail-page">
      <div className="job-detail-shell">
        <button className="job-detail-back btn-link" onClick={() => navigate('/jobs')}>
          ← Back to all jobs
        </button>

        <div className="job-detail-header">
          <span className="job-detail-icon">{job.icon}</span>
          <div>
            <h1 className="job-detail-title">{job.label}</h1>
            <p className="job-detail-desc">{job.desc}</p>
          </div>
        </div>

        <div className="job-detail-location">
          <LocationDetector />
        </div>

        {locationLoading ? (
          <div className="job-detail-status">⏳ Detecting your location to check availability…</div>
        ) : !hasAvailableSubtypes ? (
          <NearbyMessage
            message={`No ${job.label.toLowerCase()} workers available in your area yet.`}
          />
        ) : (
          <>
            <h2 className="job-detail-subtypes-title">Select a Service Type</h2>
            <SubtypeSelector
              subtypes={job.subtypes}
              available={availableSubtypeIds}
              onSelect={handleSubtypeSelect}
              loading={availableSubtypeIds === null}
            />

            {selected && (
              <div className="job-detail-selected">
                <div className="job-detail-selected-info">
                  <span className="job-detail-selected-icon">{selected.icon}</span>
                  <div>
                    <strong>{selected.label}</strong>
                    <p>{selected.desc}</p>
                  </div>
                </div>
                <button className="btn-primary" onClick={handleBookSubtype}>
                  Book {selected.label} →
                </button>
              </div>
            )}
          </>
        )}

        {fetchError && (
          <p className="job-detail-error">⚠️ {fetchError}</p>
        )}
      </div>
    </div>
  );
}
