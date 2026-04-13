/**
 * ADMIN BOOKINGS PANEL - CORE WORKFLOW MANAGEMENT
 * 
 * This page allows Region Leads and SuperAdmins to:
 * 1. Assign workers to pending requests
 * 2. Track real-time progress (Start work, Mark finished)
 * 3. Manage Disputes with a 24h escalation timer
 * 4. Log site visits and customer calls for resolution
 * 5. Track daily job progress with notes and photos
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, doc, getDoc, updateDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functionsInstance } from '../firebase';
import { calculateFinalPrice } from '../utils/pricing';
import { submitQuote as buildBookingWithQuote } from '../utils/bookingWorkflow';

// Status colors to give admins quick visual cues about the load
const STATUS_COLORS = {
  pending: 'var(--warning)',
  scheduled: 'var(--primary-purple)',
  quoted: 'var(--secondary)',
  accepted: 'var(--success)',
  assigned: '#8b5cf6',
  in_progress: '#9c27b0',
  finished: 'var(--success)',
  completed: 'var(--success)',
  cancelled: 'var(--error)',
  awaiting_confirmation: 'var(--warning)',
};

// All statuses that require active attention from admins
const ACTIVE_STATUSES = ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'];
const USE_FREE_PLAN_MODE = true;

const normalizeServiceType = (type) => {
  if (!type) return '';
  return type.trim().toLowerCase()
    .replace(/electrican/i, 'electrician')
    .replace(/plummer/i, 'plumber')
    .replace(/carpanter/i, 'carpenter');
};

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

export default function AdminBookings() {
  /* ──────────────────────────────────────────────────────────────────────────
     STATE MANAGEMENT
     ────────────────────────────────────────────────────────────────────────── */
  const [bookings, setBookings] = useState([]);        // Real-time stream of all bookings
  const [workers, setWorkers] = useState([]);          // Real-time stream of region's workers
  const [filter, setFilter] = useState('active');      // Current view filter
  const [noteId, setNoteId] = useState(null);          // ID of booking currently being "noted"
  const [noteText, setNoteText] = useState('');        // Temporary note content
  const [uploading, setUploading] = useState({});      // Loading states for photo uploads
  const [logMap, setLogMap] = useState({});            // Cache for activity log history
  const [openLog, setOpenLog] = useState(null);        // ID of booking whose log is expanded
  const [callLogId, setCallLogId] = useState(null);    // ID for call logging modal
  const [callNotes, setCallNotes] = useState('');      // Notes from the customer phone call
  const [disputeDecisions, setDisputeDecisions] = useState({}); // Tracking selected resolution types
  const [quotes, setQuotes] = useState({});            // Temporary quote prices being entered
  const [quoteAddons, setQuoteAddons] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [workerFilter, setWorkerFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoAssigningBookingIds, setAutoAssigningBookingIds] = useState({});
  const fileInputRefs = useRef({});                    // Dynamic refs for hidden file inputs
  const [isSuperAdmin, setIsSuperAdmin] = useState(false); // Role check for permissions
  const [adminRole, setAdminRole] = useState('admin'); // admin/mason/regionLead/superadmin
  const [childAdminIds, setChildAdminIds] = useState([]); // For regionLead area monitoring
  const [readError, setReadError] = useState('');      // Firestore read errors for troubleshooting
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  /* ──────────────────────────────────────────────────────────────────────────
     ROLE CHECK
     ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!uid) return;
    let unsubChildren = () => {};
    const checkRole = async () => {
      const adminDoc = await getDoc(doc(db, 'admins', uid));
      if (adminDoc.exists()) {
        const role = adminDoc.data()?.role || 'admin';
        setAdminRole(role);
        setIsSuperAdmin(role === 'superadmin');

        if (role === 'regionLead') {
          unsubChildren = onSnapshot(
            query(collection(db, 'admins'), where('parentAdminId', '==', uid)),
            snap => {
              setChildAdminIds(snap.docs.map(d => d.id));
            },
            () => setChildAdminIds([])
          );
        }
      }
      setLoading(false);
    };
    checkRole();
    return () => unsubChildren();
  }, [uid]);

  /* ──────────────────────────────────────────────────────────────────────────
     REAL-TIME LISTENERS
     ────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!uid) return;
    setReadError('');
    
    if (isSuperAdmin) {
      const unsub = onSnapshot(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
        snap => {
          setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        },
        error => setReadError(error.message)
      );
      return unsub;
    }

    let openDocs = [];
    let myDocs = [];
    const mergeAndSet = () => {
      let merged = [...openDocs, ...myDocs];
      if (adminRole === 'admin' || adminRole === 'mason') {
        const gigTypes = [...new Set(workers.map(w => w.gigType).filter(Boolean))].map(normalizeServiceType);
        if (gigTypes.length > 0) {
          merged = merged.filter(b => b.adminId === uid || gigTypes.includes(normalizeServiceType(b.serviceType)));
        } else {
          merged = merged.filter(b => b.adminId === uid);
        }
      }
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values())
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setBookings(unique);
    };

    const unsubOpen = onSnapshot(query(collection(db, 'bookings'), where('status', 'in', ['pending', 'scheduled', 'quoted'])),
      snap => { openDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); mergeAndSet(); },
      error => setReadError(error.message)
    );
    const unsubMine = onSnapshot(query(collection(db, 'bookings'), where('adminId', '==', uid)),
      snap => { myDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })); mergeAndSet(); },
      error => setReadError(error.message)
    );

    const unsubsChildren = [];
    if (adminRole === 'regionLead') {
      childAdminIds.forEach(cid => {
        unsubsChildren.push(onSnapshot(query(collection(db, 'bookings'), where('adminId', '==', cid)),
          snap => {
            const cdocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            myDocs = [...myDocs.filter(b => b.adminId !== cid), ...cdocs];
            mergeAndSet();
          }
        ));
      });
    }

    return () => { unsubOpen(); unsubMine(); unsubsChildren.forEach(f => f()); };
  }, [uid, isSuperAdmin, adminRole, childAdminIds, workers]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(query(collection(db, 'gig_workers')), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const approved = all.filter(w => !w.approvalStatus || w.approvalStatus === 'approved');
      if (isSuperAdmin) setWorkers(approved);
      else if (adminRole === 'regionLead') setWorkers(approved.filter(w => childAdminIds.includes(w.adminId)));
      else setWorkers(approved.filter(w => w.adminId === uid));
    });
    return unsub;
  }, [uid, isSuperAdmin, adminRole, childAdminIds]);

  /* ──────────────────────────────────────────────────────────────────────────
     ACTIONS
     ────────────────────────────────────────────────────────────────────────── */
  const callBackend = async (method, data) => {
    try {
      if (method === 'submitQuote') {
        const { bookingId, price } = data;
        const ref = doc(db, 'bookings', bookingId);
        const booking = (await getDoc(ref)).data();
        const adminDoc = await getDoc(doc(db, 'admins', uid));
        const adminName = adminDoc.data()?.name || adminDoc.data()?.email || 'Admin';
        const updated = buildBookingWithQuote(booking, { adminId: uid, adminName, basePrice: Number(price) });
        const last = updated.quotes[updated.quotes.length - 1];
        last.createdAt = new Date();
        await updateDoc(ref, { quotes: updated.quotes, updatedAt: new Date() });
      } else if (method === 'updateBookingStatus') {
        const { bookingId, action, extraArgs = {} } = data;
        const ref = doc(db, 'bookings', bookingId);
        const booking = (await getDoc(ref)).data();
        const base = { updatedAt: new Date() };

        if (action === 'admin_assign_worker') await updateDoc(ref, { ...base, status: 'assigned', statusUpdatedAt: new Date(), adminId: uid, assignedWorkerId: extraArgs.workerId, workerName: extraArgs.workerName, workerPhone: extraArgs.workerPhone, assignedWorker: extraArgs.workerName });
        if (action === 'admin_start_work') await updateDoc(ref, { ...base, status: 'in_progress', statusUpdatedAt: new Date(), startedAt: new Date(), adminId: booking.adminId || uid });
        if (action === 'admin_mark_finished') {
          const next = (booking.completedWorkDays || 0) + 1;
          const rem = Math.max((booking.estimatedDays || 1) - next, 0);
          await updateDoc(ref, { ...base, status: rem > 0 ? 'in_progress' : 'awaiting_confirmation', completedWorkDays: next, remainingWorkDays: rem, statusUpdatedAt: new Date(), finishedAt: rem > 0 ? null : new Date(), adminId: booking.adminId || uid });
        }
        if (action === 'admin_cancelled') await updateDoc(ref, { ...base, status: 'cancelled', statusUpdatedAt: new Date(), adminId: booking.adminId || uid });
        if (action === 'admin_resolve_dispute') await updateDoc(ref, { ...base, 'dispute.status': 'resolved', 'dispute.decision': extraArgs.decision, 'dispute.resolvedBy': uid, 'dispute.resolutionTime': new Date() });
      }
      alert('✅ Action successful');
    } catch (e) {
      alert('❌ Error: ' + e.message);
    }
  };

  const getShownBookings = () => {
    return bookings.filter(b => {
      const matchesSearch = !searchTerm || (b.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || b.id.includes(searchTerm));
      const matchesService = serviceFilter === 'all' || normalizeServiceType(b.serviceType) === normalizeServiceType(serviceFilter);
      const matchesWorker = workerFilter === 'all' || b.assignedWorkerId === workerFilter;

      if (filter === 'active') return ACTIVE_STATUSES.includes(b.status) && matchesSearch && matchesService && matchesWorker;
      if (filter === 'completed') return b.status === 'completed' && matchesSearch && matchesService && matchesWorker;
      if (filter === 'disputes') return b.dispute?.status === 'open' && matchesSearch && matchesService && matchesWorker;
      if (filter === 'delayed') return (getStatusAgeHours(b) >= 24) && matchesSearch && matchesService && matchesWorker;
      return matchesSearch && matchesService && matchesWorker;
    });
  };

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-main)', fontSize: '18px', fontWeight: '800' }}>⏳ Loading Management Panel...</div>;

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 20px 100px', color: 'var(--text-main)' }}>
      {/* Premium Header */}
      <div style={{ 
        marginBottom: '32px', padding: '40px', borderRadius: '32px', 
        background: 'linear-gradient(135deg, var(--secondary) 0%, var(--primary-purple) 100%)',
        color: 'white', boxShadow: '0 10px 40px -10px var(--primary-purple-glow)',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '38px', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '8px' }}>
            Bookings Command
          </h1>
          <p style={{ opacity: 0.9, fontSize: '16px', fontWeight: '600' }}>
            Real-time management for {isSuperAdmin ? 'Platform-wide' : 'Regional'} operations.
          </p>
        </div>
        <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', fontSize: '120px', opacity: 0.15, transform: 'rotate(-15deg)' }}>📂</div>
      </div>

      {/* Control Bar (Filters & Search) */}
      <div style={{ 
        background: 'var(--bg-card)', padding: '24px', borderRadius: '24px', border: '1px solid var(--border-light)', 
        boxShadow: 'var(--shadow-sm)', marginBottom: '32px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center'
      }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <input 
            type="text" placeholder="Search customer or Order ID..." 
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontWeight: '600' }}
          />
        </div>
        
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={{ padding: '14px', borderRadius: '16px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-main)', fontWeight: '700' }}>
          <option value="all">All Services</option>
          <option value="plumber">Plumbing</option>
          <option value="electrician">Electrical</option>
          <option value="carpenter">Carpentry</option>
          <option value="painter">Painting</option>
        </select>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-surface)', padding: '6px', borderRadius: '18px', border: '1px solid var(--border-light)' }}>
          {[
            { id: 'active', label: 'Active', icon: '⚡' },
            { id: 'disputes', label: 'Disputes', count: bookings.filter(b => b.dispute?.status === 'open').length, icon: '🚨' },
            { id: 'delayed', label: 'SLA Breached', count: bookings.filter(b => getStatusAgeHours(b) >= 24 && ACTIVE_STATUSES.includes(b.status)).length, icon: '⏳' },
            { id: 'completed', label: 'History', icon: '✅' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setFilter(tab.id)} style={{
              padding: '10px 18px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '13px',
              background: filter === tab.id ? 'var(--bg-card)' : 'transparent',
              color: filter === tab.id ? 'var(--primary-purple)' : 'var(--text-muted)',
              boxShadow: filter === tab.id ? 'var(--shadow-sm)' : 'none',
              transition: '0.2s', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <span>{tab.icon}</span> {tab.label}
              {tab.count > 0 && <span style={{ background: tab.id === 'active' ? 'var(--primary-purple)' : 'var(--error)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {readError && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '16px', borderRadius: '16px', marginBottom: '24px', fontWeight: '700', border: '1px solid var(--error)' }}>⚠️ {readError}</div>}

      {/* Bookings Grid */}
      <div style={{ display: 'grid', gap: '24px' }}>
        {getShownBookings().length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px', background: 'var(--bg-card)', borderRadius: '32px', border: '1px dashed var(--border-light)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>Empty</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '18px', fontWeight: '600' }}>No bookings found in this view.</div>
          </div>
        ) : (
          getShownBookings().map(booking => (
            <div key={booking.id} style={{ 
              background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid var(--border-light)', 
              boxShadow: 'var(--shadow-md)', overflow: 'hidden', padding: '32px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-main)' }}>#{booking.id.slice(-6).toUpperCase()}</span>
                    <span style={{ 
                      background: STATUS_COLORS[booking.status] + '20', color: STATUS_COLORS[booking.status], 
                      padding: '4px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' 
                    }}>{booking.status.replace('_', ' ')}</span>
                  </div>
                  <h3 style={{ fontSize: '24px', fontWeight: '850', marginBottom: '4px' }}>{booking.customerName || 'Standard Request'}</h3>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', gap: '16px', fontWeight: '600' }}>
                    <span>📍 {booking.area || 'Unknown Area'}</span>
                    <span>📞 {booking.customerPhone || 'N/A'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '900', color: 'var(--primary-purple)' }}>₹{booking.finalPrice || booking.basePrice || '---'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700' }}>
                    {booking.isDailyJob ? 'Daily Rate' : 'Fixed Quote'}
                  </div>
                </div>
              </div>

              {/* Dispute Alert Box */}
              {booking.dispute?.status === 'open' && (
                <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: '20px', padding: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '900', color: 'var(--error)', marginBottom: '4px' }}>🚨 DISPUTE ACTIVE: {booking.dispute.reason || 'Service Complaint'}</div>
                    <div style={{ fontSize: '13px', color: 'var(--error)', opacity: 0.9 }}>{booking.dispute.details || 'Customer flagged this job for review.'}</div>
                  </div>
                  <select 
                    value={disputeDecisions[booking.id] || ''} 
                    onChange={e => setDisputeDecisions(prev => ({ ...prev, [booking.id]: e.target.value }))}
                    style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--error)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: '700', marginRight: '12px' }}
                  >
                    <option value="">Resolution...</option>
                    <option value="refund_customer">Full Refund</option>
                    <option value="release_worker">Release Payment</option>
                    <option value="split">50/50 Split</option>
                  </select>
                  <button onClick={() => resolveDispute(booking)} style={{ padding: '10px 20px', background: 'var(--error)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer' }}>Resolve</button>
                </div>
              )}

              {/* Action Ribbon */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', borderTop: '1px solid var(--border-light)', paddingTop: '24px', marginTop: '12px' }}>
                
                {booking.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <input 
                      type="number" placeholder="Enter Base ₹" 
                      value={quotes[booking.id] || ''} onChange={e => setQuotes(prev => ({ ...prev, [booking.id]: e.target.value }))}
                      style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', flex: 1 }}
                    />
                    <button onClick={() => setPriceQuote(booking.id)} style={{ padding: '12px 24px', background: 'var(--primary-purple)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>Send Quote</button>
                    <button onClick={() => cancelBooking(booking)} style={{ padding: '12px', background: 'var(--error-bg)', color: 'var(--error)', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer' }}>Reject</button>
                  </div>
                )}

                {booking.status === 'accepted' && (
                  <div style={{ display: 'flex', gap: '12px', width: '100%', alignItems: 'center' }}>
                    <select 
                      onChange={e => assignWorker(booking, e.target.value)}
                      style={{ padding: '14px', borderRadius: '16px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', flex: 1, fontWeight: '700' }}
                    >
                      <option value="">Choose Worker for Assignment...</option>
                      {workers.filter(w => normalizeServiceType(w.gigType) === normalizeServiceType(booking.serviceType)).map(w => (
                        <option key={w.id} value={w.id}>{w.name} (⭐{w.rating || 'N/A'})</option>
                      ))}
                    </select>
                  </div>
                )}

                {booking.status === 'assigned' && (
                   <button onClick={() => startWork(booking)} style={{ padding: '14px 28px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer' }}>🚀 Signal Start of Work</button>
                )}

                {booking.status === 'in_progress' && (
                  <button onClick={() => markFinished(booking)} style={{ padding: '14px 28px', background: 'var(--success)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '900', cursor: 'pointer' }}>🏁 Mark Session Finished</button>
                )}

                <button 
                  onClick={() => setNoteId(noteId === booking.id ? null : booking.id)}
                  style={{ padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: '700', cursor: 'pointer' }}
                >📝 Note</button>

                <button 
                  onClick={() => openActivityLog(booking.id)}
                  style={{ padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontWeight: '700', cursor: 'pointer' }}
                >⌛ History</button>
              </div>

              {/* Expandable Notes Section */}
              {noteId === booking.id && (
                <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-surface)', borderRadius: '20px', border: '1px solid var(--border-light)' }}>
                  <textarea 
                    value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Logs specific site updates or worker behavior..."
                    style={{ width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-light)', background: 'var(--bg-card)', minHeight: '100px', marginBottom: '12px' }}
                  />
                  <button onClick={() => submitNote(booking.id)} style={{ padding: '12px 24px', background: 'var(--secondary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900' }}>Save Note</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
