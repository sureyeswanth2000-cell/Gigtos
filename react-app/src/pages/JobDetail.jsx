import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSpecialJob } from '../config/specialJobs';
import { useLocation } from '../context/LocationContext';
import SubtypeSelector from '../components/SubtypeSelector';
import NearbyMessage from '../components/NearbyMessage';
import LocationDetector from '../components/LocationDetector';

const RADIUS_KM = 20;

/**
 * Dedicated page for a special job category (e.g. /jobs/driver).
 * Shows sub-options filtered by worker availability within 20 km.
 */
export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { location, locationLoading } = useLocation();

  const job = getSpecialJob(jobId);

  const [availableSubtypeIds, setAvailableSubtypeIds] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [selectedSubtype, setSelectedSubtype] = useState(null);

  useEffect(() => {
    if (!location || !job) return;

    let cancelled = false;
    setFetching(true);

    fetch(
      `/api/workers?job=${jobId}&lat=${location.lat}&lng=${location.lng}&radius=${RADIUS_KM}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          // Backend returns { subtypeIds: [...] } or an array of subtype ids
          const ids = Array.isArray(data) ? data : data.subtypeIds || [];
          setAvailableSubtypeIds(new Set(ids));
        }
      })
      .catch(() => {
        // If API fails, show all subtypes (null = all available)
        if (!cancelled) setAvailableSubtypeIds(null);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [location, jobId, job]);

  if (!job) {
    return (
      <div className="job-detail-page">
        <div className="job-detail-shell">
          <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
          <h2>Job category not found.</h2>
        </div>
      </div>
    );
  }

  const handleSubtypeSelect = (subtype) => {
    setSelectedSubtype(subtype);
  };

  const handleBookSubtype = () => {
    if (!selectedSubtype) return;
    navigate(`/service?type=${encodeURIComponent(job.label)}&subtype=${encodeURIComponent(selectedSubtype.label)}`);
  };

  const allUnavailable =
    availableSubtypeIds !== null &&
    availableSubtypeIds.size === 0 &&
    !locationLoading &&
    !fetching;

  return (
    <div className="job-detail-page">
      <div className="job-detail-shell">
        <button className="back-btn" onClick={() => navigate('/')}>← Back to Jobs</button>

        <div className="job-detail-header">
          <span className="job-detail-icon" aria-hidden="true">{job.icon}</span>
          <div>
            <h1 className="job-detail-title">{job.label}</h1>
            <p className="job-detail-desc">{job.desc}</p>
          </div>
        </div>

        <LocationDetector />

        {(locationLoading || fetching) && (
          <div className="job-detail-loading">⏳ Checking worker availability near you…</div>
        )}

        {!locationLoading && !fetching && (
          <>
            {allUnavailable ? (
              <NearbyMessage
                isSubtype
                message={`No ${job.label.toLowerCase()} workers are available in your area yet. We're expanding soon!`}
              />
            ) : (
              <>
                <h2 className="subtype-section-title">Select a service type</h2>
                <SubtypeSelector
                  subtypes={job.subtypes}
                  availableIds={availableSubtypeIds}
                  onSelect={handleSubtypeSelect}
                />

                {selectedSubtype && (
                  <div className="subtype-booking-bar">
                    <span>
                      Selected: <strong>{selectedSubtype.icon} {selectedSubtype.label}</strong>
                    </span>
                    <button className="primary-btn" onClick={handleBookSubtype}>
                      Book Now
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
