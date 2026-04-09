import React, { useEffect, useState, useRef, useCallback } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import './WorkerDashboard.css';

const LAST_JOB_KEY = 'gigtos_worker_last_job';
const ACTIVE_KEY = 'gigtos_worker_active';
const ACTIVE_UNTIL_KEY = 'gigtos_worker_active_until';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

// --- Demo data ---
const OPEN_JOBS = [
  { id: 'j1', type: 'Plumber', location: 'Sector 12, Delhi', distance: '1.2 km', postedAt: '10 min ago', budget: '₹500–800', status: 'open' },
  { id: 'j2', type: 'Electrician', location: 'MG Road, Bengaluru', distance: '3.4 km', postedAt: '32 min ago', budget: '₹600–1000', status: 'open' },
  { id: 'j3', type: 'Painter', location: 'Andheri, Mumbai', distance: '5 km', postedAt: '1 hr ago', budget: '₹2000–3500', status: 'quoted' },
];

const FUTURE_JOBS = [
  { id: 'f1', type: 'Carpenter', location: 'Koramangala, Bengaluru', date: '2026-04-12', budget: '₹1500', status: 'future', accepted: false },
  { id: 'f2', type: 'Plumber', location: 'Salt Lake, Kolkata', date: '2026-04-15', budget: '₹700', status: 'future', accepted: true },
];

const HISTORY = [
  { id: 'h1', type: 'Plumber', location: 'Jayanagar, Bengaluru', date: '2026-04-05', earning: '₹650', rating: 5, review: 'Quick and professional!' },
  { id: 'h2', type: 'Electrician', location: 'Banjara Hills, Hyderabad', date: '2026-03-28', earning: '₹900', rating: 4, review: 'Good work, came on time.' },
  { id: 'h3', type: 'Painter', location: 'Connaught Place, Delhi', date: '2026-03-15', earning: '₹2800', rating: 5, review: 'Excellent finish!' },
];

const SUPPORT_MSGS = [
  { id: 1, from: 'support', text: 'Hello! How can we help you today? 👋' },
  { id: 2, from: 'support', text: 'You can ask us about payments, job disputes, or account issues.' },
];

const TABS = ['Home', 'Jobs', 'Map', 'Future', 'History', 'Chat', 'Profile'];
const TAB_ICONS = { Home: '🏠', Jobs: '📋', Map: '🗺️', Future: '📅', History: '🕐', Chat: '💬', Profile: '👤' };

function StarRow({ rating, size = 14 }) {
  return (
    <span style={{ fontSize: size, color: '#f59e0b' }}>
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  );
}

function formatCountdown(ms) {
  if (ms <= 0) return '0h 0m left';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

export default function WorkerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [activeTab, setActiveTab] = useState('Home');

  // Active status
  const [isActive, setIsActive] = useState(() => {
    const until = parseInt(localStorage.getItem(ACTIVE_UNTIL_KEY) || '0', 10);
    return Date.now() < until;
  });
  const [activeUntil, setActiveUntil] = useState(() =>
    parseInt(localStorage.getItem(ACTIVE_UNTIL_KEY) || '0', 10)
  );
  const [, forceUpdate] = useState(0);
  const timerRef = useRef(null);

  // Last job banner
  const [lastJob, setLastJob] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LAST_JOB_KEY)); } catch { return null; }
  });

  // Quote modal
  const [quoteJob, setQuoteJob] = useState(null);
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteMsg, setQuoteMsg] = useState('');
  const [quoteSent, setQuoteSent] = useState({});

  // Future jobs state
  const [futureJobs, setFutureJobs] = useState(FUTURE_JOBS);

  // Chat
  const [chatMsgs, setChatMsgs] = useState(SUPPORT_MSGS);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Toast
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }, []);

  // Persist last completed job type from history on mount
  useEffect(() => {
    if (!lastJob && HISTORY.length > 0) {
      const latest = HISTORY[0];
      const lj = { type: latest.type, date: latest.date };
      localStorage.setItem(LAST_JOB_KEY, JSON.stringify(lj));
      setLastJob(lj);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Active countdown ticker
  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        const remaining = activeUntil - Date.now();
        if (remaining <= 0) {
          setIsActive(false);
          localStorage.removeItem(ACTIVE_UNTIL_KEY);
          showToast('Active status expired after 12 hours');
        }
        forceUpdate((n) => n + 1);
      }, 60000);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive, activeUntil, showToast]);

  // Auth + worker data load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { setError('Not logged in'); setLoading(false); return; }
      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (!snap.exists()) { setError('Worker account not found.'); setLoading(false); return; }
        setWorker(snap.data());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleActive = () => {
    if (isActive) {
      setIsActive(false);
      setActiveUntil(0);
      localStorage.removeItem(ACTIVE_UNTIL_KEY);
      showToast('You are now offline');
    } else {
      const until = Date.now() + TWELVE_HOURS;
      setIsActive(true);
      setActiveUntil(until);
      localStorage.setItem(ACTIVE_UNTIL_KEY, String(until));
      showToast('You are active for 12 hours! 🚀');
    }
  };

  const handleSendQuote = () => {
    if (!quotePrice) { showToast('Enter your quote price'); return; }
    setQuoteSent((prev) => ({ ...prev, [quoteJob.id]: true }));
    const lj = { type: quoteJob.type, date: new Date().toISOString().slice(0, 10) };
    localStorage.setItem(LAST_JOB_KEY, JSON.stringify(lj));
    setLastJob(lj);
    setQuoteJob(null);
    setQuotePrice('');
    setQuoteMsg('');
    showToast('Quote sent successfully! ✅');
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const msg = { id: Date.now(), from: 'worker', text: chatInput.trim() };
    setChatMsgs((prev) => [...prev, msg]);
    setChatInput('');
    setTimeout(() => {
      setChatMsgs((prev) => [...prev, {
        id: Date.now() + 1, from: 'support',
        text: 'Thanks for reaching out! Our support team will respond within 2 hours.',
      }]);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 1000);
  };

  const handleAcceptFuture = (jobId) => {
    setFutureJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, accepted: true } : j));
    showToast('Future job accepted! ✅');
  };

  const openMapForJob = (job) => {
    const q = encodeURIComponent(job.location + ', India');
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  if (loading) return <div style={{ padding: 24, textAlign: 'center', color: '#7C3AED' }}>⏳ Loading...</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>❌ {error}</div>;

  const workerName = worker?.name || 'Worker';
  const workerService = worker?.gigType || 'Service';
  const workerRating = worker?.rating || 4.7;
  const totalJobs = HISTORY.length;
  const isPending = worker?.approvalStatus !== 'approved' || worker?.status !== 'active';

  const remaining = isActive ? Math.max(0, activeUntil - Date.now()) : 0;
  const pct = isActive ? Math.round((remaining / TWELVE_HOURS) * 100) : 0;

  const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: HISTORY.filter((h) => h.rating === stars).length,
    pct: Math.round((HISTORY.filter((h) => h.rating === stars).length / Math.max(HISTORY.length, 1)) * 100),
  }));

  return (
    <div className="wd-page">

      {/* Last Job Banner */}
      {lastJob && (
        <div className="wd-last-job-banner" onClick={() => setActiveTab('History')}>
          <span style={{ fontSize: 24 }}>⚡</span>
          <div className="lj-text">
            <div className="lj-label">Last Worked</div>
            <div className="lj-name">{lastJob.type}</div>
            <div className="lj-sub">{lastJob.date}</div>
          </div>
          <span className="lj-arrow">›</span>
        </div>
      )}

      {/* Pending approval banner */}
      {isPending && (
        <div style={{
          background: '#fff7ed', borderBottom: '1px solid #fdba74',
          color: '#9a3412', padding: '10px 18px', fontSize: 13, fontWeight: 600,
        }}>
          ⏳ Pending Approval — Contact your mason or region lead to activate your account.
        </div>
      )}

      {/* Profile Header */}
      <div className="wd-profile-card">
        <div className="wd-avatar">{workerName[0]?.toUpperCase()}</div>
        <div className="wd-profile-info">
          <h3>{workerName}</h3>
          <span className="wd-service-badge">{workerService}</span>
          <div className="wd-stars">
            <StarRow rating={workerRating} /> <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>{workerRating}/5</span>
          </div>
        </div>
      </div>

      {/* Active Toggle */}
      <div className="wd-active-section">
        <div className="wd-active-row">
          <div>
            <div className="wd-active-label">{isActive ? '🟢 You are Active' : '⚫ You are Offline'}</div>
            <div className="wd-active-sub">
              {isActive ? 'Workers near you can see your profile' : 'Go active to receive job requests'}
            </div>
          </div>
          <button
            className={`wd-toggle-btn ${isActive ? 'active' : 'inactive'}`}
            onClick={handleToggleActive}
          >
            {isActive ? 'Go Offline' : 'Go Active'}
          </button>
        </div>
        {isActive && (
          <div className="wd-countdown">
            <span>Auto-off in {formatCountdown(remaining)}</span>
            <div className="wd-countdown-bar">
              <div className="wd-countdown-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="wd-stats-row">
        <div className="wd-stat">
          <div className="wd-stat-val">{totalJobs}</div>
          <div className="wd-stat-label">Total Jobs</div>
        </div>
        <div className="wd-stat">
          <div className="wd-stat-val">{workerRating}</div>
          <div className="wd-stat-label">Rating</div>
        </div>
        <div className="wd-stat">
          <div className="wd-stat-val">{OPEN_JOBS.length}</div>
          <div className="wd-stat-label">Open Jobs</div>
        </div>
        <div className="wd-stat">
          <div className="wd-stat-val">{futureJobs.filter((j) => j.accepted).length}</div>
          <div className="wd-stat-label">Future Acc.</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="wd-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`wd-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_ICONS[tab]} {tab}
          </button>
        ))}
      </div>

      {/* ──── Home Tab ──── */}
      {activeTab === 'Home' && (
        <div className="wd-section">
          <p className="wd-section-title">👋 Welcome, {workerName.split(' ')[0]}!</p>

          {/* Quick nav swipe cards */}
          <div style={{
            display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch', paddingBottom: 8, scrollbarWidth: 'none',
          }}>
            {[
              { icon: '📋', label: 'Open Jobs', tab: 'Jobs', count: OPEN_JOBS.length, color: '#dcfce7', tc: '#15803d' },
              { icon: '📅', label: 'Future', tab: 'Future', count: futureJobs.length, color: '#faf5ff', tc: '#7C3AED' },
              { icon: '🕐', label: 'History', tab: 'History', count: totalJobs, color: '#f3f4f6', tc: '#374151' },
              { icon: '🗺️', label: 'Map', tab: 'Map', count: null, color: '#ede9fa', tc: '#7C3AED' },
              { icon: '💬', label: 'Support', tab: 'Chat', count: null, color: '#fff7ed', tc: '#c2410c' },
            ].map((c) => (
              <button
                key={c.tab}
                onClick={() => setActiveTab(c.tab)}
                style={{
                  flex: '0 0 130px', scrollSnapAlign: 'start', background: c.color,
                  border: 'none', borderRadius: 14, padding: '14px 12px', textAlign: 'left',
                  cursor: 'pointer', transition: 'transform 0.15s',
                }}
              >
                <div style={{ fontSize: 24 }}>{c.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: c.tc, marginTop: 6 }}>{c.label}</div>
                {c.count !== null && <div style={{ fontWeight: 900, fontSize: 22, color: c.tc }}>{c.count}</div>}
              </button>
            ))}
          </div>

          {/* Upcoming jobs preview */}
          {OPEN_JOBS.slice(0, 2).map((job) => (
            <div key={job.id} className="wd-job-card" style={{ marginTop: 12 }}>
              <div className="wd-job-card-top">
                <span className="wd-job-type">{job.type}</span>
                <span className={`wd-job-status ${job.status}`}>{job.status}</span>
              </div>
              <div className="wd-job-meta">📍 {job.location} · {job.distance}<br />🕐 {job.postedAt} · 💰 {job.budget}</div>
              <div className="wd-job-actions">
                <button className="wd-btn wd-btn-primary" onClick={() => { setQuoteJob(job); }}>
                  Send Quote
                </button>
                <button className="wd-btn wd-btn-outline" onClick={() => openMapForJob(job)}>
                  Map 🗺️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ──── Jobs Tab ──── */}
      {activeTab === 'Jobs' && (
        <div className="wd-section">
          <p className="wd-section-title">📋 Open Jobs Near You</p>
          {OPEN_JOBS.length === 0 ? (
            <div className="wd-empty"><span className="wd-empty-icon">🔍</span><p>No open jobs in your area right now.</p></div>
          ) : (
            <div className="wd-job-cards">
              {OPEN_JOBS.map((job) => (
                <div key={job.id} className="wd-job-card">
                  <div className="wd-job-card-top">
                    <span className="wd-job-type">{job.type}</span>
                    <span className={`wd-job-status ${job.status}`}>{job.status}</span>
                  </div>
                  <div className="wd-job-meta">
                    📍 {job.location} · {job.distance}<br />
                    🕐 {job.postedAt} · 💰 {job.budget}
                  </div>
                  <div className="wd-job-actions">
                    {quoteSent[job.id] ? (
                      <span style={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>✅ Quote Sent</span>
                    ) : (
                      <button className="wd-btn wd-btn-primary" onClick={() => setQuoteJob(job)}>
                        Send Quote
                      </button>
                    )}
                    <button className="wd-btn wd-btn-outline" onClick={() => openMapForJob(job)}>
                      View on Map
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──── Map Tab ──── */}
      {activeTab === 'Map' && (
        <div className="wd-section">
          <p className="wd-section-title">🗺️ Nearby Jobs Map</p>
          <div className="wd-map-box">
            <div style={{ fontSize: 44 }}>🗺️</div>
            <h4>Map View</h4>
            <p>Tap a job below to open it on Google Maps and get directions.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {OPEN_JOBS.map((job) => (
                <button
                  key={job.id}
                  className="wd-btn wd-btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => openMapForJob(job)}
                >
                  📍 {job.type} — {job.location} ({job.distance})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ──── Future Work Tab ──── */}
      {activeTab === 'Future' && (
        <div className="wd-section">
          <p className="wd-section-title">📅 Future Work</p>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
            Accept future jobs even when offline. They'll be confirmed when you go active.
          </p>
          {futureJobs.length === 0 ? (
            <div className="wd-empty"><span className="wd-empty-icon">📅</span><p>No future jobs yet.</p></div>
          ) : (
            futureJobs.map((job) => {
              const d = new Date(job.date);
              const day = d.getDate();
              const mon = d.toLocaleString('default', { month: 'short' }).toUpperCase();
              return (
                <div key={job.id} className="wd-future-card">
                  <div className="wd-future-date-box">
                    <div className="day">{day}</div>
                    <div className="month">{mon}</div>
                  </div>
                  <div className="wd-future-info">
                    <div className="title">{job.type}</div>
                    <div className="meta">📍 {job.location}<br />💰 {job.budget}</div>
                    {job.accepted ? (
                      <span style={{ color: '#15803d', fontWeight: 700, fontSize: 12 }}>✅ Accepted</span>
                    ) : (
                      <button
                        className="wd-btn wd-btn-primary"
                        style={{ marginTop: 8, fontSize: 12, padding: '7px 14px' }}
                        onClick={() => handleAcceptFuture(job.id)}
                      >
                        Accept Job
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ──── History Tab ──── */}
      {activeTab === 'History' && (
        <div className="wd-section">
          <p className="wd-section-title">🕐 Work History</p>
          {HISTORY.length === 0 ? (
            <div className="wd-empty"><span className="wd-empty-icon">🕐</span><p>No completed jobs yet.</p></div>
          ) : (
            HISTORY.map((h) => (
              <div key={h.id} className="wd-history-card">
                <div className="wd-history-top">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1a0533' }}>{h.type}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>📍 {h.location} · {h.date}</div>
                  </div>
                  <div className="wd-history-earning">{h.earning}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StarRow rating={h.rating} size={14} />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>"{h.review}"</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ──── Chat Tab ──── */}
      {activeTab === 'Chat' && (
        <div className="wd-section">
          <p className="wd-section-title">💬 Support Chat</p>
          <div className="wd-quick-replies">
            {['Payment issue', 'Cancel job', 'Report problem', 'Account help'].map((r) => (
              <button
                key={r}
                className="wd-quick-reply"
                onClick={() => {
                  const msg = { id: Date.now(), from: 'worker', text: r };
                  setChatMsgs((prev) => [...prev, msg]);
                  setTimeout(() => {
                    setChatMsgs((prev) => [...prev, {
                      id: Date.now() + 1, from: 'support',
                      text: `Got it! We're looking into your "${r}" request and will respond shortly.`,
                    }]);
                    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }, 1000);
                }}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="wd-chat-box">
            {chatMsgs.map((m) => (
              <div key={m.id} className={`wd-msg ${m.from}`}>{m.text}</div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="wd-chat-input-row">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Type a message..."
            />
            <button className="wd-chat-send" onClick={handleSendChat}>➤</button>
          </div>
        </div>
      )}

      {/* ──── Profile Tab ──── */}
      {activeTab === 'Profile' && (
        <div className="wd-profile-section">
          <p className="wd-section-title">👤 My Profile</p>

          {/* Info card */}
          <div style={{
            background: '#fff', border: '1px solid #ede9fa', borderRadius: 14,
            padding: 16, marginBottom: 14,
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Name', workerName], ['Service', workerService],
                ['Phone', worker?.phone || '—'], ['Area', worker?.area || '—'],
                ['Status', worker?.status || 'inactive'], ['Approval', worker?.approvalStatus || 'pending'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#1a0533', fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rating breakdown */}
          <div className="wd-rating-breakdown">
            <div className="wd-rating-big">
              <div className="val">{workerRating}</div>
              <div className="stars"><StarRow rating={workerRating} size={22} /></div>
              <div className="count">{totalJobs} completed jobs</div>
            </div>
            {ratingDist.map((r) => (
              <div key={r.stars} className="wd-bar-row">
                <span className="wd-bar-label">{r.stars}★</span>
                <div className="wd-bar-track">
                  <div className="wd-bar-fill" style={{ width: `${r.pct}%` }} />
                </div>
                <span style={{ fontSize: 11, color: '#6b7280', width: 24, textAlign: 'right' }}>{r.count}</span>
              </div>
            ))}
          </div>

          {/* Reviews */}
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1a0533', marginBottom: 10 }}>Recent Reviews</p>
          {HISTORY.filter((h) => h.review).map((h) => (
            <div key={h.id} className="wd-review-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="reviewer">{h.type} · {h.date}</span>
                <StarRow rating={h.rating} size={13} />
              </div>
              <div className="review-text">"{h.review}"</div>
            </div>
          ))}
        </div>
      )}

      {/* Quote Modal */}
      {quoteJob && (
        <div className="wd-modal-overlay" onClick={() => setQuoteJob(null)}>
          <div className="wd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-title">💰 Send Quote for {quoteJob.type}</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
              📍 {quoteJob.location} · Budget: {quoteJob.budget}
            </div>
            <label>Your Price (₹)</label>
            <input
              type="number"
              placeholder="e.g. 650"
              value={quotePrice}
              onChange={(e) => setQuotePrice(e.target.value)}
            />
            <label>Message (optional)</label>
            <textarea
              rows={3}
              placeholder="Describe your experience, availability..."
              value={quoteMsg}
              onChange={(e) => setQuoteMsg(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="wd-btn wd-btn-outline" style={{ flex: 1 }} onClick={() => setQuoteJob(null)}>
                Cancel
              </button>
              <button className="wd-btn wd-btn-primary" style={{ flex: 1 }} onClick={handleSendQuote}>
                Send Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="wd-toast">{toast}</div>}

      {/* Bottom Navigation */}
      <div className="wd-bottom-nav">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`wd-nav-item ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            <span className="nav-icon">{TAB_ICONS[tab]}</span>
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

