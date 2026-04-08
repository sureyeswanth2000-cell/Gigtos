import React from 'react';
import WorkerRegistration from '../components/WorkerRegistration';

/**
 * WorkerJobSelection – page for workers to select their job types.
 * Shows all job types (not geo-filtered), allows selecting up to 3.
 */
export default function WorkerJobSelection() {
  const handleSubmit = (selectedJobs) => {
    // In production this would save to Firestore
    console.log('Worker job selection submitted:', selectedJobs);
  };

  return <WorkerRegistration onSubmit={handleSubmit} />;
}
