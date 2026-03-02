import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, updateDoc, doc,
  query, orderBy, addDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db } from '../firebase';

// Status colors for visual differentiation in the admin panel
const STATUS_COLORS = {
  pending: '#ff9800',                // Orange for new unassigned requests
  scheduled: '#0ea5e9',              // Sky blue for future bookings
  assigned: '#2196f3',               // Blue for assigned but not started
  in_progress: '#9c27b0',            // Purple for ongoing work
  awaiting_confirmation: '#f44336',  // Red for jobs marked done by worker but not user
  completed: '#4caf50',              // Green for successfully closed jobs
  cancelled: '#757575',              // Gray for aborted jobs
};

// Define which statuses are considered "Active" for primary workflow management
const ACTIVE_STATUSES = ['pending', 'scheduled', 'assigned', 'in_progress', 'awaiting_confirmation'];

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [filter, setFilter] = useState('active');
  const [noteId, setNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState({});
  const [logMap, setLogMap] = useState({});
  const [openLog, setOpenLog] = useState(null);
  const fileInputRefs = useRef({});

  const uid = auth.currentUser?.uid;

  /* ── Bookings listener ── */
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
      snap => setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  /* ── Workers listener ── */
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'gig_workers'));
    const unsub = onSnapshot(q, snap =>
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [uid]);

  /* ── Activity log listener for one booking ── */
  const openActivityLog = (bookingId) => {
    setOpenLog(bookingId);
    if (logMap[bookingId]) return; // already loaded
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

  /* ── Helpers ── */
  const logActivity = (bookingId, action, extra = {}) =>
    addDoc(collection(db, 'activity_logs'), {
      bookingId,
      actorId: uid,
      actorRole: 'admin',
      action,
      ...extra,
      timestamp: serverTimestamp(),
    }).catch(() => { });

  /* ── Booking actions ── */
  const assignWorker = async (b, workerId) => {
    if (!workerId) return;
    const worker = workers.find(w => w.id === workerId);
    await updateDoc(doc(db, 'bookings', b.id), {
      assignedWorkerId: workerId, // Link worker's unique ID
      assignedWorker: worker?.name || '', // Store name for quick display
      adminId: uid, // Track which admin handled this assignment (crucial for hierarchy)
      status: 'assigned', // Transition to assigned phase
      updatedAt: new Date(), // Timestamp the assignment
    });
    // Log the assignment event for transparency
    await logActivity(b.id, 'admin_assigned_worker', { workerName: worker?.name });
  };

  const startWork = async (b) => {
    // Move booking to in_progress and record start date
    await updateDoc(doc(db, 'bookings', b.id), {
      status: 'in_progress',
      workStartDate: new Date().toISOString().split('T')[0], // Track start of multi-day work
      updatedAt: new Date(),
    });
    // Log work start event
    await logActivity(b.id, 'admin_started_work');
  };

  const markFinished = async (b) => {
    // Complete local work phase and notify user for final confirmation
    await updateDoc(doc(db, 'bookings', b.id), {
      status: 'awaiting_confirmation',
      assignedWorkerId: null, // Release worker for other jobs
      updatedAt: new Date(),
    });
    // Log completion marking event
    await logActivity(b.id, 'admin_marked_finished');
  };

  const cancelBooking = async (b) => {
    // If work was already in progress, revert to pending so someone else can take it
    if (['assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status)) {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'pending', // Reset status
        assignedWorkerId: null, // Clear worker
        adminId: null, // Clear admin mapping to allow re-assignment by others
        updatedAt: new Date(),
      });
      await logActivity(b.id, 'admin_cancelled_reopened');
    } else {
      // Direct cancellation for pending/scheduled jobs
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'cancelled',
        updatedAt: new Date(),
      });
      await logActivity(b.id, 'admin_cancelled');
    }
  };

  const resolveDispute = async (b) => {
    // Toggle dispute status to resolved after admin review
    await updateDoc(doc(db, 'bookings', b.id), {
      'dispute.status': 'resolved',
      updatedAt: new Date(),
    });
    // Log dispute resolution event
    await logActivity(b.id, 'admin_resolved_dispute');
    alert('Dispute marked as resolved.');
  };

  /* ── Daily note progress tracking ── */
  const submitNote = async (bookingId) => {
    if (!noteText.trim()) return; // Prevent empty notes
    const entry = {
      date: new Date().toLocaleDateString('en-IN'), // Standard Indian date format
      note: noteText.trim(),
      addedBy: uid, // Track note creator
    };
    // Append to dailyNotes array in Firestore
    await updateDoc(doc(db, 'bookings', bookingId), {
      dailyNotes: arrayUnion(entry),
      updatedAt: new Date(),
    });
    // Log note addition
    await logActivity(bookingId, 'admin_added_note', { note: noteText });
    setNoteId(null); // Close note input field
    setNoteText(''); // Reset text
  };

  /* ── Photo upload system for progress validation ── */
  const uploadPhoto = async (bookingId, label, file) => {
    if (!file) return;
    setUploading(prev => ({ ...prev, [bookingId]: true })); // Show loading for this specific booking
    try {
      const storage = getStorage();
      // Generate unique path in Firebase Storage
      const path = `bookings/${bookingId}/${label}_${Date.now()}_${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref); // Get public/access URL
      // Append photo metadata to Firestore booking doc
      await updateDoc(doc(db, 'bookings', bookingId), {
        photos: arrayUnion({ label, url, uploadedAt: new Date().toISOString() }),
        updatedAt: new Date(),
      });
      // Log successful upload
      await logActivity(bookingId, 'admin_uploaded_photo', { label });
      alert(`✓ ${label} photo uploaded!`);
    } catch (e) {
      alert('Upload failed: ' + e.message); // Error feedback
    } finally {
      setUploading(prev => ({ ...prev, [bookingId]: false })); // Stop loading
    }
  };

  /* ── Filter logic for the dashboard views ── */
  const shown = bookings.filter(b => {
    if (filter === 'active') return ACTIVE_STATUSES.includes(b.status);
    if (filter === 'completed') return b.status === 'completed';
    if (filter === 'cancelled') return b.status === 'cancelled';
    if (filter === 'disputes') return b.dispute?.status === 'open';
    return true; // Show all for 'all' filter
  });

  /* ── Open dispute counter for UI badges ── */
  const disputeCount = bookings.filter(b => b.dispute?.status === 'open').length;

  /* ── Component Main Render ── */
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      {/* Page header */}
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📋 Booking Management</h2>

      {/* Responsive Filter Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { key: 'active', label: `Active (${bookings.filter(b => ACTIVE_STATUSES.includes(b.status)).length})`, color: '#f59e0b' },
          { key: 'completed', label: `Completed (${bookings.filter(b => b.status === 'completed').length})`, color: '#10b981' },
          { key: 'cancelled', label: `Cancelled (${bookings.filter(b => b.status === 'cancelled').length})`, color: '#6b7280' },
          { key: 'disputes', label: `🚨 Disputes (${disputeCount})`, color: '#dc2626' },
          { key: 'all', label: `All (${bookings.length})`, color: '#667eea' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            style={{
              padding: '8px 16px',
              background: filter === tab.key ? tab.color : '#f3f4f6', // Highlight active tab
              color: filter === tab.key ? 'white' : '#333',
              border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontWeight: filter === tab.key ? 'bold' : 'normal',
              fontSize: '13px',
              transition: 'background 0.3s'
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State Feedback */}
      {shown.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999', background: '#f9f9f9', borderRadius: '8px' }}>
          No bookings match your selected filter.
        </div>
      )}

      {/* List of Booking Cards */}
      {shown.map(b => {
        // Filter out workers who are already busy on other jobs
        const busyWorkerIds = bookings
          .filter(bk => ['assigned', 'in_progress'].includes(bk.status) && bk.id !== b.id)
          .map(bk => bk.assignedWorkerId);
        // Find workers that match exact service type AND are currently available
        const availableWorkers = workers.filter(w =>
          w.status === 'active' &&
          !busyWorkerIds.includes(w.id) &&
          (
            (b.serviceType || 'Service').toLowerCase() === 'service' ||
            (w.gigType || '').toLowerCase() === (b.serviceType || '').toLowerCase()
          )
        );

        return (
          <div key={b.id} style={{
            background: 'white',
            border: `2px solid ${STATUS_COLORS[b.status] || '#ddd'}`, // Dynamic border color matching status
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* Unified Header with Details and Status Tags */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
                  {b.serviceType} — {b.customerName}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                  📞 {b.phone} | 📍 {b.address}
                </div>
                {/* Visual display for Future/Scheduled booking details */}
                {b.scheduledDate && (
                  <div style={{ fontSize: '12px', color: '#0284c7', fontWeight: 'bold', marginTop: '4px', background: '#e0f2fe', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                    🗓️ Scheduled: {b.scheduledDate} at {b.timeSlot}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  Created: {b.createdAt?.toDate?.()?.toLocaleString?.() || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {b.dispute?.status === 'open' && (
                  <span style={{ background: '#fef2f2', color: '#dc2626', padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                    🚨 Dispute
                  </span>
                )}
                <span style={{
                  padding: '5px 10px',
                  background: STATUS_COLORS[b.status] || '#ccc',
                  color: 'white', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
                }}>
                  {b.status?.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Photos */}
            {b.photos?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>📸 Photos:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {b.photos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt={p.label} title={p.label}
                        style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Daily notes */}
            {b.dailyNotes?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>📋 Progress Notes:</div>
                {b.dailyNotes.map((n, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#555', padding: '4px 8px', background: '#f0f4ff', borderRadius: '4px', marginBottom: '3px' }}>
                    <strong>{n.date}:</strong> {n.note}
                  </div>
                ))}
              </div>
            )}

            {/* Dispute resolution */}
            {b.dispute?.status === 'open' && (
              <div style={{ marginBottom: '12px', padding: '10px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#dc2626', marginBottom: '6px' }}>🚨 Open Dispute</div>
                <div style={{ fontSize: '12px', color: '#7f1d1d' }}>Reason: {b.dispute.reason}</div>
                <button onClick={() => resolveDispute(b)}
                  style={{ marginTop: '8px', padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                  ✓ Mark Resolved
                </button>
              </div>
            )}

            {/* Rating display */}
            {b.rating && (
              <div style={{ marginBottom: '10px', fontSize: '13px', color: '#555' }}>
                ⭐ User rating: {'★'.repeat(b.rating)}{'☆'.repeat(5 - b.rating)}
                {b.review && <span style={{ marginLeft: '8px', color: '#777' }}>"{b.review}"</span>}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>

              {/* PENDING: assign worker */}
              {b.status === 'pending' && (
                <>
                  <select defaultValue="" onChange={e => assignWorker(b, e.target.value)}
                    style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}>
                    <option value="">Assign Worker…</option>
                    {availableWorkers.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.gigType})</option>
                    ))}
                  </select>
                  <button onClick={() => cancelBooking(b)}
                    style={{ padding: '7px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    ✕ Cancel
                  </button>
                </>
              )}

              {/* ASSIGNED: start work */}
              {b.status === 'assigned' && (
                <>
                  <button onClick={() => startWork(b)}
                    style={{ padding: '7px 14px', background: '#9c27b0', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    ▶ Start Work
                  </button>
                  <button onClick={() => cancelBooking(b)}
                    style={{ padding: '7px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    ↩ Cancel/Reopen
                  </button>
                </>
              )}

              {/* IN_PROGRESS: mark finished + add note + upload photo */}
              {b.status === 'in_progress' && (
                <>
                  <button onClick={() => markFinished(b)}
                    style={{ padding: '7px 14px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    ✓ Mark Finished
                  </button>
                  <button onClick={() => cancelBooking(b)}
                    style={{ padding: '7px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    ↩ Cancel/Reopen
                  </button>
                  <button onClick={() => { setNoteId(noteId === b.id ? null : b.id); setNoteText(''); }}
                    style={{ padding: '7px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    📝 Add Daily Note
                  </button>
                  {/* Photo upload buttons */}
                  {['Before', 'Progress', 'After'].map(label => (
                    <span key={label}>
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        ref={el => { if (el) fileInputRefs.current[`${b.id}_${label}`] = el; }}
                        onChange={e => { if (e.target.files[0]) uploadPhoto(b.id, label, e.target.files[0]); }}
                      />
                      <button onClick={() => fileInputRefs.current[`${b.id}_${label}`]?.click()}
                        disabled={uploading[b.id]}
                        style={{ padding: '7px 12px', background: '#f97316', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        📸 {label}
                      </button>
                    </span>
                  ))}
                </>
              )}

              {/* AWAITING_CONFIRMATION: cancel reopen only */}
              {b.status === 'awaiting_confirmation' && (
                <button onClick={() => cancelBooking(b)}
                  style={{ padding: '7px 14px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                  ↩ Cancel/Reopen
                </button>
              )}

              {/* Activity log button */}
              <button onClick={() => openLog === b.id ? setOpenLog(null) : openActivityLog(b.id)}
                style={{ padding: '7px 14px', background: '#e5e7eb', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                📜 {openLog === b.id ? 'Hide Log' : 'Activity Log'}
              </button>
            </div>

            {/* Daily note panel */}
            {noteId === b.id && (
              <div style={{ marginTop: '12px', background: '#f0f4ff', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>📝 Add Progress Note</div>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                  placeholder="Describe today's work progress…" rows={2}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '12px', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setNoteId(null)}
                    style={{ flex: 1, padding: '7px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                    Cancel
                  </button>
                  <button onClick={() => submitNote(b.id)}
                    style={{ flex: 1, padding: '7px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                    Save Note
                  </button>
                </div>
              </div>
            )}

            {/* Activity log panel */}
            {openLog === b.id && (
              <div style={{ marginTop: '12px', background: '#f9f9f9', padding: '12px', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#555' }}>📜 Activity Log</div>
                {!logMap[b.id] && <div style={{ color: '#999' }}>Loading…</div>}
                {logMap[b.id]?.length === 0 && <div style={{ color: '#999' }}>No activity recorded yet.</div>}
                {logMap[b.id]?.map((entry, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #eee', color: '#444' }}>
                    <span style={{ color: '#999', marginRight: '8px' }}>
                      {entry.timestamp?.toDate?.()?.toLocaleString?.() || '—'}
                    </span>
                    <strong>[{entry.actorRole}]</strong> {entry.action.replace(/_/g, ' ')}
                    {entry.note && <span style={{ marginLeft: '6px', color: '#666' }}>— "{entry.note}"</span>}
                    {entry.rating && <span style={{ marginLeft: '6px', color: '#ff9800' }}>★ {entry.rating}</span>}
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