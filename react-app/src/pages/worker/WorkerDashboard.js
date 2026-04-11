import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { WorkerLocationProvider } from '../../context/WorkerLocationContext';
import { USER_BUDGET_MARKUP_PERCENT } from '../../utils/aiBudgetSuggestion';
import ActiveStatusButton from '../../components/worker/ActiveStatusButton';
import WorkerFixedRateForm from '../../components/worker/WorkerFixedRateForm';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import WorkerLocationTracker from '../../components/worker/WorkerLocationTracker';
import QuoteModal from '../../components/worker/QuoteModal';
import '../../styles/worker-dashboard.css';

const NAV_CARDS = [
  { to: '/worker/open-work', icon: '📋', label: 'Open Work' },
  { to: '/worker/history', icon: '🕐', label: 'History' },
  { to: '/worker/future-work', icon: '📅', label: 'Future Work' },
  { to: '/worker/profile', icon: '👤', label: 'My Profile' },
  { to: '/worker/job-selection', icon: '✏️', label: 'Edit Jobs' },
  { to: '/worker/support', icon: '💬', label: 'Support' },
];

/**
 * Calculate AI suggested quote for workers.
 * Uses USER_BUDGET_MARKUP_PERCENT to reverse the markup applied to user budgets,
 * giving workers the actual market rate (currently 25% less than what users see).
 */
function getAiSuggestedAmount(userBudget) {
  const budget = Number(userBudget);
  if (!budget || budget <= 0) return null;
  return Math.round(budget / (1 + USER_BUDGET_MARKUP_PERCENT / 100));
}

/**
 * Open Google Maps directions to a job's location.
 * Falls back to area-based search if lat/lng not available.
 */
function openDirections(job) {
  if (job.lat && job.lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`, '_blank', 'noopener');
  } else if (job.locationLat && job.locationLng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${job.locationLat},${job.locationLng}`, '_blank', 'noopener');
  } else if (job.area || job.address) {
    const dest = encodeURIComponent(job.address || job.area);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank', 'noopener');
  }
}

/** Workflow step config for live job action buttons */
const WORKFLOW_STEPS = {
  assigned: { next: 'in_progress', label: '▶ Start Work', style: 'btn-primary' },
  in_progress: { next: 'completed', label: '✅ Mark Complete', style: 'btn-success' },
};

export default function WorkerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [liveJobs, setLiveJobs] = useState([]);
  const [futureJobs, setFutureJobs] = useState([]);
  const [nearbyJobs, setNearbyJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [updatingJobId, setUpdatingJobId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { navigate('/auth'); return; }
      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (!snap.exists()) {
          setError('Worker account not found.');
          setLoading(false);
          return;
        }
        setWorker({ ...snap.data(), uid: u.uid });

        // Fetch live (in-progress/assigned) jobs for this worker
        const liveSnap = await getDocs(query(
          collection(db, 'bookings'),
          where('workerId', '==', u.uid),
          where('status', 'in', ['assigned', 'in_progress'])
        ));
        setLiveJobs(liveSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch future (pending/confirmed) scheduled jobs for this worker
        const futureSnap = await getDocs(query(
          collection(db, 'bookings'),
          where('workerId', '==', u.uid),
          where('status', 'in', ['pending', 'confirmed'])
        ));
        setFutureJobs(futureSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch open jobs (available to quote on)
        const openSnap = await getDocs(query(
          collection(db, 'bookings'),
          where('status', '==', 'open')
        ));
        setNearbyJobs(openSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
        setJobsLoading(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleStatusChange = useCallback((active) => {
    setIsActive(active);
  }, []);

  const showToast = useCallback((msg, type = '') => {
    setToast({ msg, type });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    return () => clearTimeout(toastTimeoutRef.current);
  }, []);

  const handleSendQuote = async () => {
    await new Promise(r => setTimeout(r, 500));
    showToast("✅ Quote sent! You'll be notified if accepted.", 'success');
  };

  /** Update a live job's status (Start → In Progress → Complete) */
  const handleJobStatusUpdate = useCallback(async (job, nextStatus) => {
    setUpdatingJobId(job.id);
    try {
      await updateDoc(doc(db, 'bookings', job.id), { status: nextStatus });
      if (nextStatus === 'completed') {
        // Move from live to neither (completed)
        setLiveJobs(prev => prev.filter(j => j.id !== job.id));
        showToast('🎉 Job completed! Great work.', 'success');
      } else {
        // Update status in local state
        setLiveJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: nextStatus } : j));
        showToast('▶ Work started! Keep it up.', 'success');
      }
    } catch {
      showToast('❌ Failed to update status. Try again.', 'error');
    } finally {
      setUpdatingJobId(null);
    }
  }, [showToast]);

  if (loading) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div className="worker-header-section">
            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 140, height: 20, marginBottom: 6 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
          </div>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14, marginBottom: 12 }} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😔</div>
            <p style={{ color: '#b91c1c' }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const initials = (worker?.name || 'W').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isPending = worker?.approvalStatus !== 'approved';

  return (
    <WorkerLocationProvider>
    <div className="worker-page">
      <div className="worker-container">

        {/* ─── CLEAN HEADER ─── */}
        <div className="worker-header-section" style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 20px 24px' }}>
          <div className="worker-avatar" style={{ width: 48, height: 48, fontSize: 20, marginBottom: 0, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{worker?.name || 'Worker'}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 2 }}>
              📍 {worker?.area || 'Unknown Area'}
            </div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isActive ? '#34D399' : '#FCD34D',
                boxShadow: isActive ? '0 0 0 3px rgba(52,211,153,0.3)' : '0 0 0 3px rgba(252,211,77,0.3)'
              }} />
              <span style={{ fontSize: 12, opacity: 0.9 }}>
                {isActive ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
          {/* Quick map access */}
          <Link
            to="/worker/map"
            style={{
              background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '8px 12px',
              color: '#fff', textDecoration: 'none', fontSize: 20, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Open Map"
          >
            🗺️
          </Link>
        </div>

        {isPending && (
          <div className="worker-card" style={{ background: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: 14 }}>
            <div style={{ color: '#C2410C', fontWeight: 600, fontSize: 14 }}>
              ⏳ Approval Pending
            </div>
            <p style={{ color: '#9A3412', fontSize: 13, margin: '4px 0 0' }}>
              Your account is pending approval by your region lead. Some features may be limited.
            </p>
          </div>
        )}

        {/* ─── Active Status ─── */}
        <ActiveStatusButton onStatusChange={handleStatusChange} />

        {/* ═══ 1. IN-PROGRESS SERVICES — with workflow buttons ═══ */}
        {!jobsLoading && liveJobs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <h3 className="section-title" style={{ fontSize: 16 }}>🔧 In-Progress Services</h3>
            {liveJobs.map(job => {
              const step = WORKFLOW_STEPS[job.status];
              const isUpdating = updatingJobId === job.id;
              return (
                <div key={job.id} className="worker-card live-job-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1F1144' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                        {job.area && <span>📍 {job.area}</span>}
                        {job.customerName && <span> · 👤 {job.customerName}</span>}
                      </div>
                    </div>
                    {/* Navigate icon */}
                    {(job.lat || job.locationLat || job.area) && (
                      <button
                        onClick={() => openDirections(job)}
                        title="Navigate"
                        className="icon-btn-navigate"
                      >
                        🧭
                      </button>
                    )}
                  </div>

                  {/* Workflow progress bar */}
                  <div className="workflow-progress">
                    <div className={`workflow-step ${job.status === 'assigned' || job.status === 'in_progress' ? 'done' : ''}`}>
                      <div className="workflow-dot" />
                      <span>Assigned</span>
                    </div>
                    <div className="workflow-line" />
                    <div className={`workflow-step ${job.status === 'in_progress' ? 'done' : ''}`}>
                      <div className="workflow-dot" />
                      <span>In Progress</span>
                    </div>
                    <div className="workflow-line" />
                    <div className="workflow-step">
                      <div className="workflow-dot" />
                      <span>Complete</span>
                    </div>
                  </div>

                  {/* Action button */}
                  {step && (
                    <button
                      className={step.style}
                      disabled={isUpdating}
                      onClick={() => handleJobStatusUpdate(job, step.next)}
                      style={{ width: '100%', marginTop: 10, padding: 10, fontSize: 14 }}
                    >
                      {isUpdating ? 'Updating...' : step.label}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 2. UPCOMING WORK ═══ */}
        {!jobsLoading && futureJobs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 className="section-title" style={{ margin: 0, fontSize: 16 }}>📅 Upcoming</h3>
              <Link to="/worker/future-work" style={{ fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
                View All →
              </Link>
            </div>
            {futureJobs.slice(0, 3).map(job => {
              const schedDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
              return (
                <div key={job.id} className="worker-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1F1144', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {schedDate
                          ? `${schedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · ${schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Date TBD'
                        }
                        {job.area && ` · 📍 ${job.area}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {(job.lat || job.locationLat || job.area) && (
                        <button onClick={() => openDirections(job)} title="Navigate" className="icon-btn-navigate">
                          🧭
                        </button>
                      )}
                      <span style={{
                        background: job.status === 'confirmed' ? '#D1FAE5' : '#FEF3C7',
                        color: job.status === 'confirmed' ? '#065F46' : '#92400E',
                        padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700
                      }}>
                        {job.status === 'confirmed' ? '✅' : '⏳'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ 3. AVAILABLE SERVICES — nearby open jobs ═══ */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 className="section-title" style={{ margin: 0, fontSize: 16 }}>💼 Available Services</h3>
            <Link to="/worker/open-work" style={{ fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
              See All →
            </Link>
          </div>

          {jobsLoading ? (
            [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14, marginBottom: 10 }} />)
          ) : nearbyJobs.length > 0 ? (
            nearbyJobs.slice(0, 5).map(job => {
              const aiAmount = getAiSuggestedAmount(job.budget || job.estimatedBudget || job.amount);
              return (
                <div key={job.id} className="worker-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1F1144' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {job.area && <span>📍 {job.area}</span>}
                      </div>
                      {/* AI Suggested Amount — 25% less than user's budget */}
                      <div style={{ fontSize: 13, marginTop: 5 }}>
                        {aiAmount ? (
                          <span style={{ color: '#7C3AED', fontWeight: 700 }}>
                            🤖 AI suggests ₹{aiAmount.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>🤖 Quote on request</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                      <button
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: 12, minWidth: 'auto', width: 'auto', whiteSpace: 'nowrap' }}
                        onClick={() => setSelectedJob(job)}
                      >
                        Send Quote
                      </button>
                      {(job.lat || job.locationLat || job.area) && (
                        <button onClick={() => openDirections(job)} className="icon-btn-navigate" style={{ alignSelf: 'center' }}>
                          🧭
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#6B7280' }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>📭</div>
              <div style={{ fontSize: 13 }}>No open services around you right now</div>
            </div>
          )}
        </div>

        {/* Worker Location Tracker */}
        <WorkerLocationTracker />

        {/* Fixed Day Rate */}
        <WorkerFixedRateForm workerData={worker} />

        {/* Quick Access */}
        <h3 className="section-title" style={{ fontSize: 16 }}>⚡ Quick Access</h3>
        <div className="nav-cards-grid">
          {NAV_CARDS.map(card => (
            <Link key={card.to} to={card.to} className="nav-card">
              <span className="nav-card-icon">{card.icon}</span>
              <span className="nav-card-label">{card.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quote Modal */}
      {selectedJob && (
        <QuoteModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSubmit={handleSendQuote}
        />
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <WorkerBottomNav />
    </div>
    </WorkerLocationProvider>
  );
}
