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
  collection, onSnapshot, updateDoc, doc,
  query, orderBy, addDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../firebase';

// Status colors to give admins quick visual cues about the load
const STATUS_COLORS = {
  pending: '#ff9800',                // Orange: Waiting for Region Lead attention
  scheduled: '#0ea5e9',              // Sky blue: Future dated jobs
  assigned: '#2196f3',               // Blue: Worker assigned, travel/prep phase
  in_progress: '#9c27b0',            // Purple: Work currently happening on site
  awaiting_confirmation: '#f44336',  // Red: Finished by worker, waiting for customer OK
  completed: '#4caf50',              // Green: Job closed successfully
  cancelled: '#757575',              // Gray: Job terminated
};

// All statuses that require active attention from admins
const ACTIVE_STATUSES = ['pending', 'scheduled', 'assigned', 'in_progress', 'awaiting_confirmation'];

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
   * Records a manual entry in the audit trail.
   */
  const logActivity = (bookingId, action, extra = {}) =>
    addDoc(collection(db, 'activity_logs'), {
      bookingId, actorId: uid, actorRole: 'admin',
      action, ...extra, timestamp: serverTimestamp(),
    }).catch(() => { });

  /**
   * Action: Assing a specific worker to a pending request.
   * Transitions: pending -> assigned.
   */
  const assignWorker = async (b, workerId) => {
    if (!workerId) return;
    const worker = workers.find(w => w.id === workerId);
    await updateDoc(doc(db, 'bookings', b.id), {
      assignedWorkerId: workerId,
      assignedWorker: worker?.name || '',
      adminId: uid,
      status: 'assigned',
      updatedAt: new Date(),
    });
    await logActivity(b.id, 'admin_assigned_worker', { workerName: worker?.name });
  };

  /**
   * Action: Signal that work has started at the site.
   * Transitions: assigned -> in_progress.
   */
  const startWork = async (b) => {
    await updateDoc(doc(db, 'bookings', b.id), {
      status: 'in_progress',
      workStartDate: new Date().toISOString().split('T')[0],
      updatedAt: new Date(),
    });
    await logActivity(b.id, 'admin_started_work');
  };

  /**
   * Action: Worker has finished; service enters consumer-confirmation phase.
   * Transitions: in_progress -> awaiting_confirmation.
   */
  const markFinished = async (b) => {
    await updateDoc(doc(db, 'bookings', b.id), {
      status: 'awaiting_confirmation',
      assignedWorkerId: null, // Worker is now free for other jobs
      updatedAt: new Date(),
    });
    await logActivity(b.id, 'admin_marked_finished');
  };

  /**
   * Action: Cancels or Reopens a booking.
   * LOGIC: If job was active, it returns to 'pending' to be re-assigned.
   */
  const cancelBooking = async (b) => {
    if (['assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status)) {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'pending',
        assignedWorkerId: null,
        adminId: null,
        updatedAt: new Date(),
      });
      await logActivity(b.id, 'admin_cancelled_reopened');
    } else {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'cancelled',
        updatedAt: new Date(),
      });
      await logActivity(b.id, 'admin_cancelled');
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
    await updateDoc(doc(db, 'bookings', b.id), {
      'dispute.status': 'resolved',
      'dispute.decision': decision,
      'dispute.resolutionTime': new Date(),
      'dispute.resolvedBy': uid,
      updatedAt: new Date(),
    });
    await logActivity(b.id, 'admin_resolved_dispute', { decision });
    setDisputeDecisions(prev => { const n = { ...prev }; delete n[b.id]; return n; });
    alert('Dispute resolved: ' + decision);
  };

  /**
   * Action: Record notes from a verification call with the customer.
   * Governance: Required for 1-star auto-disputes.
   */
  const submitCallLog = async (bookingId) => {
    if (!callNotes.trim()) return;
    await updateDoc(doc(db, 'bookings', bookingId), {
      'dispute.regionCallTime': new Date(),
      'dispute.callNotes': callNotes.trim(),
      updatedAt: new Date(),
    });
    await logActivity(bookingId, 'region_call_logged', { callNotes: callNotes.trim() });
    setCallLogId(null);
    setCallNotes('');
  };

  /**
   * Action: Record a physical visit to the dispute site.
   */
  const submitVisitLog = async (bookingId) => {
    await updateDoc(doc(db, 'bookings', bookingId), {
      'dispute.visitTime': new Date(),
      updatedAt: new Date(),
    });
    await logActivity(bookingId, 'region_visit_logged');
  };

  /**
   * Action: Add text notes to the job's progress timeline.
   */
  const submitNote = async (bookingId) => {
    if (!noteText.trim()) return;
    const entry = {
      date: new Date().toLocaleDateString('en-IN'),
      note: noteText.trim(),
      addedBy: uid,
    };
    await updateDoc(doc(db, 'bookings', bookingId), {
      dailyNotes: arrayUnion(entry),
      updatedAt: new Date(),
    });
    await logActivity(bookingId, 'admin_added_note', { note: noteText });
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
      await updateDoc(doc(db, 'bookings', bookingId), {
        photos: arrayUnion({ label, url, uploadedAt: new Date().toISOString() }),
        updatedAt: new Date(),
      });
      await logActivity(bookingId, 'admin_uploaded_photo', { label });
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

            {/* ACTION BUTTONS: Drive the backend triggers */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {b.status === 'pending' && (
                <select onChange={e => assignWorker(b, e.target.value)} style={{ padding: '6px', borderRadius: '4px' }}>
                  <option value="">Assign Worker…</option>
                  {availableWorkers.map(w => <option key={w.id} value={w.id}>{w.name} [{w.completedJobs || 0} jobs]</option>)}
                </select>
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
