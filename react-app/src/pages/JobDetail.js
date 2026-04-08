import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSpecialJob } from '../config/specialJobs';
import { useLocation as useAppLocation } from '../context/LocationContext';
import SubtypeSelector from '../components/SubtypeSelector';
import NearbyMessage from '../components/NearbyMessage';
import LocationDetector from '../components/LocationDetector';

const RADIUS_KM = 20;

export default function JobDetail() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { location, locationLoading } = useAppLocation();

  const jobConfig = getSpecialJob(jobId);

  const [availableSubtypeIds, setAvailableSubtypeIds] = useState(null);
  const [loadingSubtypes, setLoadingSubtypes] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchAvailableSubtypes = useCallback(() => {
    if (!location || !jobConfig) return;
    setLoadingSubtypes(true);
    setAvailableSubtypeIds(null);

    fetch(
      `/api/workers?job=${jobId}&lat=${location.lat}&lng=${location.lng}&radius=${RADIUS_KM}`
    )
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data) => {
        // Expect: { subtypeIds: ['driver-car', ...] } or { workers: [{subtypeId:..}] }
        if (data.subtypeIds) {
          setAvailableSubtypeIds(new Set(data.subtypeIds));
        } else if (data.workers) {
          setAvailableSubtypeIds(new Set(data.workers.map((w) => w.subtypeId)));
        } else {
          // Fallback: show all subtypes
          setAvailableSubtypeIds(null);
        }
      })
      .catch(() => {
        // Graceful fallback: show all subtypes when API not available
        setAvailableSubtypeIds(null);
      })
      .finally(() => setLoadingSubtypes(false));
  }, [location, jobConfig, jobId]);

  useEffect(() => {
    fetchAvailableSubtypes();
  }, [fetchAvailableSubtypes]);

  if (!jobConfig) {
    return (
      <div style={styles.page}>
        <p style={{ color: 'var(--error)' }}>Job category not found.</p>
        <button onClick={() => navigate('/')} style={styles.backBtn}>
          ← Back to Home
        </button>
      </div>
    );
  }

  const availableSubtypes = jobConfig.subtypes.filter(
    (s) => availableSubtypeIds === null || availableSubtypeIds.has(s.id)
  );

  const isLoading = locationLoading || loadingSubtypes;

  return (
    <div style={styles.page}>
      {/* Breadcrumb */}
      <button onClick={() => navigate('/')} style={styles.backBtn}>
        ← Back
      </button>

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerIcon}>{jobConfig.icon}</span>
        <div>
          <h1 style={styles.title}>{jobConfig.label}</h1>
          <p style={styles.desc}>{jobConfig.desc}</p>
        </div>
      </div>

      <LocationDetector />

      {isLoading ? (
        <div style={styles.loading}>⏳ Checking worker availability near you…</div>
      ) : (
        <>
          {availableSubtypes.length === 0 ? (
            <NearbyMessage
              message={`No ${jobConfig.label.toLowerCase()} workers are available in your area yet.`}
            />
          ) : (
            <>
              <h2 style={styles.sectionTitle}>Select a service type</h2>
              <SubtypeSelector
                subtypes={jobConfig.subtypes}
                availableIds={availableSubtypeIds}
                onSelect={(sub) => setSelected(sub)}
              />
            </>
          )}
        </>
      )}

      {/* Booking confirmation */}
      {selected && (
        <div style={styles.selectedBanner}>
          <p style={{ margin: 0 }}>
            <strong>{selected.icon} {selected.label}</strong> selected — proceed to book this service.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button
              style={styles.primaryBtn}
              onClick={() => navigate(`/service?type=${jobConfig.label} - ${selected.label}`)}
            >
              Book Now
            </button>
            <button
              style={styles.secondaryBtn}
              onClick={() => setSelected(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 900,
    margin: '24px auto',
    padding: '0 20px 40px',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary-purple)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: '0 0 16px',
    textDecoration: 'underline',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 18,
    padding: '20px 24px',
    background: 'var(--bg-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    marginBottom: 20,
  },
  headerIcon: {
    fontSize: 44,
  },
  title: {
    margin: 0,
    color: 'var(--text-dark)',
  },
  desc: {
    margin: '4px 0 0',
    color: 'var(--text-muted)',
    fontSize: 14,
  },
  sectionTitle: {
    margin: '24px 0 4px',
    color: 'var(--text-dark)',
    fontSize: 17,
  },
  loading: {
    padding: '32px 0',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
  selectedBanner: {
    marginTop: 24,
    padding: '18px 20px',
    background: 'var(--primary-purple-light)',
    border: '1px solid var(--primary-purple)',
    borderRadius: 12,
    color: 'var(--text-dark)',
  },
  primaryBtn: {
    padding: '10px 22px',
    background: 'var(--primary-purple)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 22px',
    background: 'transparent',
    color: 'var(--primary-purple)',
    border: '2px solid var(--primary-purple)',
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
  },
};
