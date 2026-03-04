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
  collection, onSnapshot, doc, getDoc,
  query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functionsInstance } from '../firebase';

// Status colors to give admins quick visual cues about the load
const STATUS_COLORS = {
  pending: '#ff9800',                // Orange: Waiting for Region Lead attention
  scheduled: '#0ea5e9',              // Sky blue: Future dated jobs
  assigned: '#2196f3',               // Blue: Worker assigned, travel/prep phase
  in_progress: '#9c27b0',            // Purple: Work currently happening on site
  awaiting_confirmation: '#f44336',  // Red: Finished by worker, waiting for customer OK
  completed: '#4caf50',              // Green: Job closed successfully
  cancelled: '#757575',              // Gray: Job terminated
  quoted: '#6366f1',                 // Indigo: Price sent to user
  accepted: '#ec4899',               // Pink: User agreed to price
};

// All statuses that require active attention from admins
const ACTIVE_STATUSES = ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'];

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
  const fileInputRefs = useRef({});                    // Dynamic refs for hidden file inputs

  const uid = auth.currentUser?.uid;

  /* ──────────────────────────────────────────────────────────────────────────
     REAL-TIME LISTENERS
     ────────────────────────────────────────────────────────────────────────── */

  // Listen to ALL bookings (admins see their region, SuperAdmin sees all)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
      snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // Listen to available workers for assignment logic
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'gig_workers'));
    const unsub = onSnapshot(q, snap =>
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [uid]);

  /* ──────────────────────────────────────────────────────────────────────────
     CORE ACTIONS & LOGIC
     ────────────────────────────────────────────────────────────────────────── */

  /**
   * Fetches the activity history for a specific booking.
   * Redirects/Displays: Expanded log view in the UI card.
   */
  const openActivityLog = (bookingId) => {
    setOpenLog(bookingId);
    if (logMap[bookingId]) return;
    const unsub = onSnapshot(
      query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc')),
      snap => {
        const entries = snap.docs
          .map(d => d.data())
          .filter(d => d.bookingId === bookingId);
        setLogMap(prev => ({ ...prev, [bookingId]: entries }));
      }
    );
    return unsub;
  };

  /**
   * Universal Backend Caller
   */
  const callBackend = async (method, data) => {
    try {
      const func = httpsCallable(functionsInstance, method);
      await func(data);
    } catch (e) {
      console.error(e);
      alert('Action failed: ' + e.message);
    }
  };

  /**
   * Action: Assing a specific worker to a pending request.
   * Transitions: pending -> assigned.
   */
  const assignWorker = async (b, workerId) => {
    if (!workerId) return;
    const worker = workers.find(w => w.id === workerId);
    await callBackend('updateBookingStatus', {
      bookingId: b.id,
      action: 'admin_assign_worker',
      extraArgs: { workerId, workerName: worker?.name, workerPhone: worker?.contact }
    });
  };

  /**
   * Action: Signal that work has started at the site.
   * Transitions: assigned -> in_progress.
   */
  const startWork = async (b) => {
    await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_start_work' });
  };

  /**
   * Action: Worker has finished; service enters consumer-confirmation phase.
   * Transitions: in_progress -> awaiting_confirmation.
   */
  const markFinished = async (b) => {
    await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_mark_finished' });
  };

  /**
   * Action: Cancels or Reopens a booking.
   * LOGIC: If job was active, it returns to 'pending' to be re-assigned.
   */
  const cancelBooking = async (b) => {
    if (['assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status)) {
      await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_reopen_booking' });
    } else {
      await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_cancelled' });
    }
  };

  /**
   * Action: Closes a dispute with a final decision.
   * LOGIC: Impacts escrow release (handled by backend triggers).
   */
  const resolveDispute = async (b) => {
    const decision = disputeDecisions[b.id];
    if (!decision) {
      alert('Select a decision type first.');
      return;
    }
    await callBackend('updateBookingStatus', { bookingId: b.id, action: 'admin_resolve_dispute', extraArgs: { decision } });
    setDisputeDecisions(prev => { const n = { ...prev }; delete n[b.id]; return n; });
    alert('Dispute resolved: ' + decision);
  };

  /**
   * Action: Record notes from a verification call with the customer.
   * Governance: Required for 1-star auto-disputes.
   */
  const submitCallLog = async (bookingId) => {
    if (!callNotes.trim()) return;
    await callBackend('updateBookingStatus', { bookingId, action: 'admin_log_call', extraArgs: { callNotes: callNotes.trim() } });
    setCallLogId(null);
    setCallNotes('');
  };

  /**
   * Action: Record a physical visit to the dispute site.
   */
  const submitVisitLog = async (bookingId) => {
    await callBackend('updateBookingStatus', { bookingId, action: 'admin_log_visit' });
  };

  /**
   * Action: Add text notes to the job's progress timeline.
   */
  const submitNote = async (bookingId) => {
    if (!noteText.trim()) return;
    await callBackend('updateBookingStatus', { bookingId, action: 'admin_add_note', extraArgs: { note: noteText.trim() } });
    setNoteId(null);
    setNoteText('');
  };

  /**
   * Action: Upload Before/Progress/After photos to Firebase Storage.
   */
  const uploadPhoto = async (bookingId, label, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [bookingId]: true }));
    try {
      const storage = getStorage();
      const path = `bookings/${bookingId}/${label}_${Date.now()}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);

      await callBackend('updateBookingStatus', { bookingId, action: 'admin_upload_photo', extraArgs: { label, url } });
    } catch (e) {
      alert('Upload failed.');
    } finally {
      setUploading(prev => ({ ...prev, [bookingId]: false }));
    }
  };

  /**
   * Helper: Calculate remaining time before a dispute is auto-escalated.
   * Governance: Region Leads have 24 hours to resolve disputes before penalty.
   */
  const getEscalationInfo = (dispute) => {
    if (!dispute?.raisedAt || dispute.status !== 'open') return null;
    const raisedAt = dispute.raisedAt.toDate ? dispute.raisedAt.toDate() : new Date(dispute.raisedAt);
    const now = new Date();
    const hoursElapsed = (now - raisedAt) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursElapsed;
    return {
      hoursElapsed: Math.round(hoursElapsed * 10) / 10,
      hoursRemaining: Math.max(0, Math.round(hoursRemaining * 10) / 10),
      isOverdue: hoursElapsed >= 24,
      isEscalated: dispute.escalationStatus === true,
    };
  };

  /**
   * Action: Admin sets a price quote for the job.
   * Logic: Appends to a "quotes" array so multiple admins can bid.
   */
  const setPriceQuote = async (bookingId) => {
    const price = quotes[bookingId];
    if (!price || isNaN(price) || price <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    await callBackend('submitQuote', { bookingId, price: Number(price) });
    setQuotes(prev => { const n = { ...prev }; delete n[bookingId]; return n; });
    alert('Quote sent! User will be notified.');
  };

  /* ──────────────────────────────────────────────────────────────────────────
     UI RENDER LOGIC
     ────────────────────────────────────────────────────────────────────────── */
  const shown = bookings.filter(b => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(b.status);
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return b.status === 'cancelled';
    if (filter === 'disputes') return b.dispute?.status === 'open';
    if (filter === 'escalated') return b.dispute?.escalationStatus === true && b.dispute?.status === 'open';
    return true;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📋 Booking Management</h2>

      {/* FILTER BUTTONS: Redirects the view state but not the URL */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'active', label: 'Active', color: '#f59e0b' },
          { key: 'completed', label: 'Completed', color: '#10b981' },
          { key: 'cancelled', label: 'Cancelled', color: '#6b7280' },
          { key: 'disputes', label: '🚨 Disputes', color: '#dc2626' },
          { key: 'quoted', label: '💰 Quoted', color: '#6366f1' },
          { key: 'escalated', label: '⏰ Escalated', color: '#7c3aed' },
          { key: 'all', label: 'All', color: '#667eea' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: '8px 16px', background: filter === tab.key ? tab.color : '#f3f4f6',
              color: filter === tab.key ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontWeight: 'bold', fontSize: '13px'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {shown.map(b => {
        // LOGIC: Filter workers based on gig type AND availability for this booking ID
        const busyWorkerIds = bookings.filter(bk => ['assigned', 'in_progress'].includes(bk.status) && bk.id !== b.id).map(bk => bk.assignedWorkerId);
        const availableWorkers = workers.filter(w => w.status === 'active' && !busyWorkerIds.includes(w.id) && !w.isFraud && ((b.serviceType || '').toLowerCase() === (w.gigType || '').toLowerCase()));

        const escalation = getEscalationInfo(b.dispute);

        return (
          <div key={b.id} style={{
            background: 'white', border: `2px solid ${b.dispute?.escalationStatus ? '#7c3aed' : STATUS_COLORS[b.status] || '#ddd'}`,
            borderRadius: '12px', padding: '16px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* BOOKING HEADER & MAP LINK */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{b.serviceType} — {b.customerName}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  📞 {b.phone} | 📍
                  {/* NAVIGATION LINK: Opens Google Maps search for the job location */}
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`}
                    target="_blank" rel="noreferrer" style={{ color: '#2196f3', textDecoration: 'none', marginLeft: '4px' }}>
                    {b.address} ↗
                  </a>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ padding: '4px 10px', background: STATUS_COLORS[b.status], color: 'white', borderRadius: '20px', fontSize: '10px', fontWeight: 'bold' }}>
                  {b.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* ESCALATION TIMER: Informs admin of urgency */}
            {escalation && !escalation.isEscalated && (
              <div style={{ padding: '8px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
                ⏱️ Dispute resolution window: <strong>{escalation.hoursRemaining}h left</strong> before penalty.
              </div>
            )}

            {/* MULTI-DAY JOB INFO */}
            {b.isMultiDay && b.startDate && (
              <div style={{ padding: '8px 12px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid #c7d2fe', fontSize: '12px', marginBottom: '12px' }}>
                <span style={{ fontWeight: 'bold', color: '#4338ca' }}>📅 Multi-Day Job</span>
                {' · '}{b.startDate?.toDate ? b.startDate.toDate().toLocaleDateString('en-IN') : b.startDate}
                {' → '}{b.endDate?.toDate ? b.endDate.toDate().toLocaleDateString('en-IN') : b.endDate}
                {b.jobDuration && <span> · {b.jobDuration} day{b.jobDuration > 1 ? 's' : ''}</span>}
                {b.isPricePerDay && b.dailyRate && <span> · ₹{b.dailyRate}/day</span>}
                {b.totalEstimatedCost && <span> · Est. ₹{b.totalEstimatedCost}</span>}
                <div style={{ marginTop: '4px', color: '#6366f1' }}>
                  Confirmations: {(b.dailyConfirmations || []).length}/{b.jobDuration || 1} days confirmed
                </div>
              </div>
            )}

            {/* ACTION BUTTONS: Drive the backend triggers */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(b.status === 'pending' || b.status === 'scheduled') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>💰 Submit Bid</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      placeholder="Your Quote ₹"
                      value={quotes[b.id] || ''}
                      onChange={e => setQuotes(prev => ({ ...prev, [b.id]: e.target.value }))}
                      disabled={b.quotes?.some(q => q.adminId === uid)}
                      style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                    <button
                      onClick={() => setPriceQuote(b.id)}
                      disabled={b.quotes?.some(q => q.adminId === uid)}
                      style={{
                        background: b.quotes?.some(q => q.adminId === uid) ? '#94a3b8' : '#6366f1',
                        color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px',
                        fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                      }}
                    >
                      {b.quotes?.some(q => q.adminId === uid) ? 'Bid Sent' : 'Send Quote'}
                    </button>
                  </div>
                  {b.quotes?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {b.quotes.length} bid(s) already received for this job.
                    </div>
                  )}
                </div>
              )}
              {b.status === 'assigned' && <button onClick={() => startWork(b)} style={{ background: '#9c27b0', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px' }}>Start Work</button>}
              {b.status === 'in_progress' && <button onClick={() => markFinished(b)} style={{ background: '#4caf50', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '6px' }}>Mark Finished</button>}

              {/* DISPUTE SUB-PANEL */}
              {b.dispute?.status === 'open' && (
                <div style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626' }}>🚨 Dispute Management</div>
                  <div style={{ fontSize: '11px', margin: '4px 0' }}>Reason: {b.dispute.reason}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button onClick={() => setCallLogId(b.id)} style={{ padding: '4px 8px', fontSize: '11px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>Log Call</button>
                    <button onClick={() => submitVisitLog(b.id)} style={{ padding: '4px 8px', fontSize: '11px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px' }}>Log Visit</button>
                    <select onChange={e => setDisputeDecisions(prev => ({ ...prev, [b.id]: e.target.value }))} style={{ fontSize: '11px' }}>
                      <option value="">Select Result…</option>
                      <option value="worker_fault">Worker Fault</option>
                      <option value="user_fault">User Fault</option>
                      <option value="shared_fault">Shared Fault</option>
                    </select>
                    <button onClick={() => resolveDispute(b)} style={{ padding: '4px 8px', fontSize: '11px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px' }}>Resolve</button>
                  </div>
                </div>
              )}

              {/* DAILY PROGRESS CONTROLS (for in_progress bookings) */}
              {b.status === 'in_progress' && (
                <div style={{ width: '100%', marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>📋 Daily Progress</div>

                  {/* Note input */}
                  {noteId === b.id ? (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                      <input
                        type="text"
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add today's progress note..."
                        style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                      />
                      <button onClick={() => submitNote(b.id)}
                        style={{ padding: '6px 10px', background: '#475569', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                        Save
                      </button>
                      <button onClick={() => { setNoteId(null); setNoteText(''); }}
                        style={{ padding: '6px 10px', background: '#e5e7eb', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setNoteId(b.id)}
                      style={{ padding: '5px 10px', background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', marginRight: '6px', cursor: 'pointer' }}>
                      ✏️ Add Note
                    </button>
                  )}

                  {/* Photo upload */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {['before', 'progress', 'after'].map(label => (
                      <div key={label}>
                        <input
                          ref={el => fileInputRefs.current[`${b.id}_${label}`] = el}
                          type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => uploadPhoto(b.id, label, e.target.files[0])}
                        />
                        <button
                          onClick={() => fileInputRefs.current[`${b.id}_${label}`]?.click()}
                          disabled={uploading[b.id]}
                          style={{ padding: '5px 10px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                          📷 {label}
                        </button>
                      </div>
                    ))}
                    {uploading[b.id] && <span style={{ fontSize: '11px', color: '#64748b' }}>⏳ Uploading…</span>}
                  </div>

                  {/* Daily photos display */}
                  {b.dailyPhotos?.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {b.dailyPhotos.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer">
                          <img src={p.url} alt={p.label || 'photo'} title={p.label || ''}
                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                        </a>
                      ))}
                    </div>
                  )}
                  {/* Legacy photos (non-multi-day) */}
                  {!b.dailyPhotos?.length && b.photos?.length > 0 && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {b.photos.map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noreferrer">
                          <img src={p.url} alt={p.label || 'photo'} title={p.label || ''}
                            style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Daily notes display */}
                  {b.dailyNotes?.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      {b.dailyNotes.map((n, i) => (
                        <div key={i} style={{ fontSize: '11px', color: '#475569', padding: '3px 6px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '2px' }}>
                          <strong>{n.date || (n.timestamp?.toDate?.().toLocaleDateString())}</strong>: {n.note}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Daily confirmations status (multi-day jobs) */}
                  {b.isMultiDay && b.dailyConfirmations?.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' }}>✅ User Confirmations:</div>
                      {b.dailyConfirmations.map((c, i) => (
                        <div key={i} style={{ fontSize: '11px', color: '#065f46', padding: '3px 6px', background: '#dcfce7', borderRadius: '4px', marginBottom: '2px' }}>
                          {c.dateLabel} — Quality: {'★'.repeat(c.workQuality || 0)} {c.notes && `"${c.notes}"`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* LOG TOGGLE */}
              <button onClick={() => openLog === b.id ? setOpenLog(null) : openActivityLog(b.id)}
                style={{ padding: '6px 12px', fontSize: '12px', background: '#eee', border: 'none', borderRadius: '6px' }}>
                {openLog === b.id ? 'Hide Log' : '📜 View Log'}
              </button>
            </div>

            {/* ACTIVITY LOG: Rendered in-card for quick review */}
            {openLog === b.id && logMap[b.id] && (
              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #eee', fontSize: '11px', color: '#555' }}>
                {logMap[b.id].map((log, i) => (
                  <div key={i} style={{ marginBottom: '4px' }}>
                    <span style={{ color: '#999' }}>{log.timestamp?.toDate?.().toLocaleTimeString()}</span> - <strong>{log.actorRole}</strong>: {log.action}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
