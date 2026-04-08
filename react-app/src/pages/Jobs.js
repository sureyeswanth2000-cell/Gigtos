import React from 'react';
import { useNavigate } from 'react-router-dom';
import JobList from '../components/JobList';
import './Jobs.css';

/**
 * Jobs – geo-filtered job browse page.
 * Shows all available jobs within 20km of the user's location.
 */
export default function Jobs() {
  const navigate = useNavigate();

  const handleBook = (job) => {
    navigate(`/service?type=${encodeURIComponent(job.name)}`);
  };

  return (
    <div className="jobs-page">
      <div className="jobs-page-header">
        <h1>Browse Available Jobs</h1>
        <p>Jobs and workers are filtered to your location (20km radius).</p>
      </div>
      <JobList onBook={handleBook} />
    </div>
  );
}
