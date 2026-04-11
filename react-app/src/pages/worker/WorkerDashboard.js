import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { WorkerLocationProvider } from '../../context/WorkerLocationContext';
import { USER_BUDGET_MARKUP_PERCENT } from '../../utils/aiBudgetSuggestion';
import ActiveStatusButton from '../../components/worker/ActiveStatusButton';
import WorkerFixedRateForm from '../../components/worker/WorkerFixedRateForm';
import WorkerStatsCard from '../../components/worker/WorkerStatsCard';
import RatingDisplay from '../../components/worker/RatingDisplay';
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
  { to: '/worker/map', icon: '🗺️', label: 'Map' },
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

  if (loading) {
    return (
      <div className="worker-page">
        <div className="worker-container">
          <div className="worker-header-section">
            <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 160, height: 20, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 100, height: 14 }} />
          </div>
          <div className="skeleton" style={{ height: 60, borderRadius: 12, marginBottom: 10 }} />
          <div className="stats-row">
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
          </div>
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

  const stats = {
    completed: worker?.completedJobs || 0,
    pending: worker?.pendingJobs || 0,
    rating: worker?.rating || 0,
    earnings: worker?.totalEarnings || 0,
  };

  return (
    <WorkerLocationProvider>
    <div className="worker-page">
      <div className="worker-container">
        {/* Header */}
        <div className="worker-header-section">
          <div className="worker-avatar">{initials}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{worker?.name || 'Worker'}</div>
          <RatingDisplay rating={stats.rating} size="sm" />
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
            {(worker?.gigTypes && worker.gigTypes.length > 0)
              ? worker.gigTypes.map(t => t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')).join(', ')
              : (worker?.gigType || 'General Worker')
            } · {worker?.area || 'Unknown Area'}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isActive ? '#34D399' : '#FCD34D',
              boxShadow: isActive ? '0 0 0 3px rgba(52,211,153,0.3)' : '0 0 0 3px rgba(252,211,77,0.3)'
            }} />
            <span style={{ fontSize: 13, opacity: 0.9 }}>
              {isActive ? 'Active & visible to customers' : 'Offline'}
            </span>
          </div>
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

        {/* ═══ LIVE WORK — before active button ═══ */}
        {!jobsLoading && liveJobs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <h3 className="section-title">🔴 Live Work</h3>
            {liveJobs.map(job => (
              <div key={job.id} className="worker-card" style={{ border: '2px solid #10B981', background: '#F0FDF4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1F1144' }}>
                      {job.title || job.serviceType || 'Service'}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      {job.area && <span>📍 {job.area}</span>}
                      {job.customerName && <span> · 👤 {job.customerName}</span>}
                    </div>
                  </div>
                  <span style={{
                    background: '#D1FAE5', color: '#065F46', padding: '3px 10px',
                    borderRadius: 20, fontSize: 11, fontWeight: 700
                  }}>
                    {job.status === 'in_progress' ? '🔧 In Progress' : '📌 Assigned'}
                  </span>
                </div>
                {job.phone && (
                  <div style={{ fontSize: 12, color: '#059669', marginTop: 6 }}>📞 {job.phone}</div>
                )}
                {(job.lat || job.locationLat || job.area) && (
                  <button
                    onClick={() => openDirections(job)}
                    style={{
                      marginTop: 8, padding: '6px 12px', background: '#EDE9FE', color: '#7C3AED',
                      border: '1px solid #C4B5FD', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4
                    }}
                  >
                    🧭 Navigate to Location
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ═══ FUTURE SCHEDULED WORK — before active button ═══ */}
        {!jobsLoading && futureJobs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 className="section-title" style={{ margin: 0 }}>📅 Upcoming Work</h3>
              <Link to="/worker/future-work" style={{ fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
                View All →
              </Link>
            </div>
            {futureJobs.slice(0, 3).map(job => {
              const schedDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
              return (
                <div key={job.id} className="worker-card" style={{ border: '1px solid #C4B5FD', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#1F1144' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {schedDate
                          ? `📅 ${schedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · 🕐 ${schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                          : 'Date TBD'
                        }
                        {job.area && ` · 📍 ${job.area}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {(job.lat || job.locationLat || job.area) && (
                        <button
                          onClick={() => openDirections(job)}
                          title="Get directions"
                          style={{
                            padding: '4px 8px', background: '#EDE9FE', color: '#7C3AED',
                            border: '1px solid #C4B5FD', borderRadius: 8, fontSize: 14,
                            cursor: 'pointer', lineHeight: 1
                          }}
                        >
                          🧭
                        </button>
                      )}
                      <span style={{
                        background: job.status === 'confirmed' ? '#D1FAE5' : '#FEF3C7',
                        color: job.status === 'confirmed' ? '#065F46' : '#92400E',
                        padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700
                      }}>
                        {job.status === 'confirmed' ? '✅ Confirmed' : '⏳ Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active Status */}
        <ActiveStatusButton onStatusChange={handleStatusChange} />

        {/* ═══ NEARBY OPEN JOBS — after active button ═══ */}
        {!jobsLoading && nearbyJobs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 className="section-title" style={{ margin: 0 }}>💼 Jobs Around You</h3>
              <Link to="/worker/open-work" style={{ fontSize: 12, color: '#7C3AED', textDecoration: 'none', fontWeight: 600 }}>
                See All →
              </Link>
            </div>
            {nearbyJobs.slice(0, 5).map(job => {
              const aiAmount = getAiSuggestedAmount(job.budget || job.estimatedBudget || job.amount);
              return (
                <div key={job.id} className="worker-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1F1144' }}>
                        {job.title || job.serviceType || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                        {job.area && <span>📍 {job.area} </span>}
                        <span className="job-category-badge" style={{ fontSize: 10 }}>
                          {job.category || job.gigType || job.serviceType || 'General'}
                        </span>
                      </div>
                      {/* AI Suggested Amount — 25% less than user's budget */}
                      {aiAmount ? (
                        <div style={{
                          fontSize: 13, color: '#7C3AED', fontWeight: 700, marginTop: 6,
                          display: 'flex', alignItems: 'center', gap: 4
                        }}>
                          🤖 AI suggests ₹{aiAmount.toLocaleString('en-IN')}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
                          🤖 AI suggests: Quote on request
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn-primary"
                        style={{ padding: '8px 14px', fontSize: 12, minWidth: 'auto', width: 'auto', whiteSpace: 'nowrap' }}
                        onClick={() => setSelectedJob(job)}
                      >
                        Send Quote
                      </button>
                      {(job.lat || job.locationLat || job.area) && (
                        <button
                          onClick={() => openDirections(job)}
                          style={{
                            padding: '6px 12px', background: '#EDE9FE', color: '#7C3AED',
                            border: '1px solid #C4B5FD', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3
                          }}
                        >
                          🧭 Directions
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!jobsLoading && nearbyJobs.length === 0 && (
          <div className="worker-card" style={{ textAlign: 'center', padding: '20px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>No open jobs around you right now. Check back soon!</div>
          </div>
        )}

        {/* Fixed Day Rate */}
        <WorkerFixedRateForm workerData={worker} />

        {/* Worker Location Tracker — shown when worker is active */}
        <WorkerLocationTracker />

        {/* Stats */}
        <WorkerStatsCard stats={stats} />

        {/* Navigation Cards */}
        <h3 className="section-title">Quick Access</h3>
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
