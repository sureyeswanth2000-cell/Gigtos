import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';

const getStatusTimestamp = (booking) => {
  const statusAt = booking?.statusUpdatedAt || booking?.updatedAt || booking?.createdAt;
  if (!statusAt) return null;
  return statusAt.toDate ? statusAt.toDate() : new Date(statusAt);
};

const getStatusAgeHours = (booking) => {
  const ts = getStatusTimestamp(booking);
  if (!ts) return 0;
  return (Date.now() - ts.getTime()) / (1000 * 60 * 60);
};

export default function RegionLeadDashboard() {
  const navigate = useNavigate();
  const [regionLeadData, setRegionLeadData] = useState(null);
  const [childAdmins, setChildAdmins] = useState([]);
  const [pendingGigs, setPendingGigs] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [delayedBookings, setDelayedBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalMasons: 0,
    totalGigs: 0,
    pendingApprovals: 0,
    activeBookings: 0,
    openDisputes: 0,
    regionScore: 100,
  });

  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [approvalAssignments, setApprovalAssignments] = useState({});

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'admins', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.role !== 'regionLead' && data.role !== 'region-lead') {
          navigate('/admin');
          return;
        }
        setRegionLeadData(data);
        setStats(prev => ({ ...prev, regionScore: data.regionScore || 100 }));
      }
      setLoading(false);
    });
    return unsub;
  }, [uid, navigate]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(query(collection(db, 'admins'), where('parentAdminId', '==', uid)), (snap) => {
      const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setChildAdmins(admins);
      setStats(prev => ({ ...prev, totalMasons: admins.length }));
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid || !regionLeadData?.areaName) return;
    const unsubPending = onSnapshot(query(collection(db, 'gig_workers'), where('approvalStatus', '==', 'pending'), where('area', '==', regionLeadData.areaName)), (snap) => {
      const pending = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingGigs(pending);
      setStats(prev => ({ ...prev, pendingApprovals: pending.length }));
    });
    return unsubPending;
  }, [uid, regionLeadData]);

  useEffect(() => {
    if (!uid || childAdmins.length === 0) return;
    const childAdminIds = childAdmins.map(a => a.id);
    const bookingsByAdmin = {};
    const unsubs = childAdminIds.map(adminId => onSnapshot(query(collection(db, 'bookings'), where('adminId', '==', adminId)), (snap) => {
      bookingsByAdmin[adminId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const all = Object.values(bookingsByAdmin).flat();
      const active = all.filter(b => ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status));
      const delayed = active.filter(b => getStatusAgeHours(b) >= 24);
      const openDisputes = all.filter(b => b.dispute?.status === 'open');
      setActiveBookings(active);
      setDelayedBookings(delayed);
      setDisputes(openDisputes);
      setStats(prev => ({ ...prev, activeBookings: active.length, openDisputes: openDisputes.length }));
    }));
    return () => unsubs.forEach(fn => fn());
  }, [uid, childAdmins]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(query(collection(db, 'admin_alerts'), where('adminId', '==', uid), where('status', '==', 'open')), (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [uid]);

  const createChildAdmin = async () => {
    if (!newAdminName || !newAdminEmail || !newAdminPassword) return alert('Fill all fields');
    try {
      const cred = await createUserWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
      await setDoc(doc(db, 'admins', cred.user.uid), {
        name: newAdminName, email: newAdminEmail, role: 'mason',
        parentAdminId: uid, areaName: regionLeadData?.areaName || '',
        regionStatus: 'active', createdAt: new Date(),
      });
      alert('Mason created!');
      setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('');
    } catch (e) { alert(e.message); }
  };

  const approveWorker = async (workerId) => {
    const targetAdminId = approvalAssignments[workerId];
    if (!targetAdminId) return alert('Select a mason');
    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        approvalStatus: 'approved', adminId: targetAdminId, status: 'active',
        approvedAt: new Date(), approvedByRegionLeadId: uid,
      });
      alert('Approved!');
    } catch (e) { alert(e.message); }
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-main)', background: 'var(--bg-main)', minHeight: '100vh' }}>⏳ Loading Region Console...</div>;

  return (
    <div className="dash-container" style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '40px 20px' }}>
      <main style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        {/* Region Header */}
        <header style={{ 
          background: 'var(--primary-purple-glow)', 
          backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--primary-purple)',
          borderRadius: 'var(--radius-xl)',
          padding: '48px',
          marginBottom: '40px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--glass-shadow)'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>Region Operations</h1>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
              <span style={{ background: 'var(--primary-purple)', color: 'white', padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 800 }}>
                📍 {regionLeadData?.areaName || 'Universal'}
              </span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Region Lead: {regionLeadData?.name}</span>
            </div>
          </div>
          <div style={{ position: 'absolute', right: -40, top: -40, width: 240, height: 240, borderRadius: '50%', background: 'var(--primary-purple)', opacity: 0.05 }} />
        </header>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 40 }}>
          {[
            { label: 'Masons', value: stats.totalMasons, icon: '👷', color: 'var(--primary-purple)' },
            { label: 'Pro Workers', value: stats.totalGigs, icon: '💼', color: 'var(--success)' },
            { label: 'Approvals', value: stats.pendingApprovals, icon: '⏳', color: 'var(--warning)' },
            { label: 'Active Jobs', value: stats.activeBookings, icon: '⚡', color: 'var(--secondary-green)' },
            { label: 'Open Disputes', value: stats.openDisputes, icon: '🚨', color: 'var(--error)' },
          ].map(s => (
            <div key={s.label} className="job-card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-main)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32, background: 'var(--bg-soft)', padding: 8, borderRadius: 'var(--radius-lg)', width: 'fit-content' }}>
          {[
            { id: 'overview', label: 'Monitor', icon: '📊' },
            { id: 'gigs', label: 'Approvals', icon: '🛡️', count: stats.pendingApprovals },
            { id: 'admins', label: 'Masons', icon: '🛠️' },
            { id: 'disputes', label: 'Disputes', icon: '🚨', count: stats.openDisputes },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-md)',
                background: activeTab === t.id ? 'var(--bg-main)' : 'transparent',
                color: activeTab === t.id ? 'var(--primary-purple)' : 'var(--text-muted)',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                boxShadow: activeTab === t.id ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <span>{t.icon}</span> {t.label} 
              {t.count > 0 && <span style={{ background: 'var(--error)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 32 }}>
            <div className="job-card" style={{ padding: 32 }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Command Center</h3>
              <div style={{ display: 'grid', gap: 16 }}>
                <button onClick={() => navigate('/admin/bookings')} className="btn-glass" style={{ textAlign: 'left', padding: 24, background: 'var(--bg-soft)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--primary-purple)' }}>Central Bookings Command</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Track every job lifecycle in real-time.</div>
                </button>
                <button onClick={() => navigate('/admin/workers')} className="btn-glass" style={{ textAlign: 'left', padding: 24, background: 'var(--bg-soft)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--success)' }}>Professional Workforce</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Review and manage regional skill pool.</div>
                </button>
              </div>
            </div>

            <div className="job-card" style={{ padding: 32 }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Critical Alerts</h3>
              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>✅ Region is healthy</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {alerts.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, background: 'var(--error-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--error)' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--error)' }}>{a.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-main)', opacity: 0.8 }}>{a.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'gigs' && (
          <div className="job-card" style={{ padding: 32 }}>
            <h3 style={{ margin: '0 0 32px 0', fontSize: 24, fontWeight: 800 }}>Pending Pro Approvals</h3>
            {pendingGigs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>No pending applications.</div>
            ) : (
              <div style={{ display: 'grid', gap: 20 }}>
                {pendingGigs.map(w => (
                  <div key={w.id} style={{ padding: 24, background: 'var(--bg-soft)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{w.name}</div>
                      <div style={{ color: 'var(--primary-purple)', fontWeight: 700, marginTop: 4 }}>{w.gigType} · {w.area}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <select 
                        value={approvalAssignments[w.id] || ''} 
                        onChange={e => setApprovalAssignments(prev => ({ ...prev, [w.id]: e.target.value }))}
                        className="input-field"
                        style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', background: 'var(--bg-main)', minWidth: 200 }}
                      >
                        <option value="">Select Mason...</option>
                        {childAdmins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <button onClick={() => approveWorker(w.id)} disabled={!approvalAssignments[w.id]} className="btn-primary" style={{ padding: '12px 24px', opacity: approvalAssignments[w.id] ? 1 : 0.5 }}>Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admins' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 32 }}>
            <div className="job-card" style={{ padding: 32 }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Onboard New Mason</h3>
              <div style={{ display: 'grid', gap: 16 }}>
                <input placeholder="Name" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} className="input-field" style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', color: 'var(--text-main)' }} />
                <input placeholder="Email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} className="input-field" style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', color: 'var(--text-main)' }} />
                <input placeholder="Password" type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} className="input-field" style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--bg-soft)', border: '1px solid var(--border-light)', color: 'var(--text-main)' }} />
                <button onClick={createChildAdmin} className="btn-primary" style={{ padding: 18 }}>Create Account</button>
              </div>
            </div>
            <div className="job-card" style={{ padding: 32 }}>
              <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Active Regional Masons</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {childAdmins.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.email}</div>
                    </div>
                    <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: 11 }}>ACTIVE</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'disputes' && (
          <div className="job-card" style={{ padding: 48 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 24, fontWeight: 800 }}>Resolution Queue</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>Active disputes requiring oversight.</p>
            {disputes.length === 0 ? (
              <div style={{ fontSize: 64, marginBottom: 24, textAlign: 'center' }}>✅</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {disputes.map((d) => (
                  <DisputeCard key={d.id} booking={d} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// DisputeCard component for displaying dispute details and AI analysis
function DisputeCard({ booking }) {
  const [ai, setAi] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    // Fetch AI analysis from sub-collection
    import('firebase/firestore').then(({ collection, getDocs, doc, getFirestore }) => {
      const db = getFirestore();
      getDocs(collection(doc(db, 'bookings', booking.id), 'dispute_analysis')).then((snap) => {
        if (!snap.empty) setAi(snap.docs[0].data());
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [booking.id]);

  return (
    <div style={{ border: '1px solid var(--border-light)', borderRadius: 16, padding: 24, background: 'var(--bg-soft)', marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Booking: {booking.id.slice(0, 8).toUpperCase()}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Service: {booking.serviceType} | Customer: {booking.customerName}</div>
        </div>
        <div style={{ color: 'var(--error)', fontWeight: 700 }}>🚨 Dispute: {booking.dispute?.reason}</div>
      </div>
      <div style={{ margin: '12px 0' }}>
        <b>Job Description:</b> {booking.jobDescription || 'N/A'}
      </div>
      <div style={{ display: 'flex', gap: 24, margin: '16px 0' }}>
        <div>
          <b>Before Photos:</b>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {(booking.beforePhotos || []).map((url, i) => <img key={i} src={url} alt="before" style={{ maxWidth: 80, borderRadius: 8 }} />)}
          </div>
        </div>
        <div>
          <b>After Photos:</b>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {(booking.afterPhotos || []).map((url, i) => <img key={i} src={url} alt="after" style={{ maxWidth: 80, borderRadius: 8 }} />)}
          </div>
        </div>
        <div>
          <b>User Dispute Photos:</b>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {(booking.dispute?.userPhotos || []).map((url, i) => <img key={i} src={url} alt="user" style={{ maxWidth: 80, borderRadius: 8 }} />)}
          </div>
        </div>
      </div>
      <div style={{ margin: '16px 0', background: 'var(--bg-main)', borderRadius: 8, padding: 16 }}>
        <b>AI Executive Summary:</b>
        {loading ? <span style={{ marginLeft: 8 }}>Loading...</span> : ai ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 700, color: 'var(--primary-purple)' }}>{ai.summary}</div>
            <div style={{ marginTop: 6 }}><b>Suggested Fault:</b> {ai.fault} ({ai.faultPercent || '--'}%)</div>
            {ai.flaggedMessages && ai.flaggedMessages.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <b>Flagged Chat:</b>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {ai.flaggedMessages.map((msg, i) => <li key={i}>{msg}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>No AI analysis found.</span>}
      </div>
    </div>
  );
}
