/**
 * MY BOOKINGS PAGE - CONSUMER INTERFACE
 * 
 * Logic Overview:
 * - Fetches and displays all bookings for the authenticated user.
 * - Categorizes bookings into Active, Completed, and Cancelled.
 * - Provides interactive actions: Edit, Cancel, Confirm Completion, Rate, Dispute, and Rebook.
 * - Real-time listeners (onSnapshot) ensure UI syncs with backend status changes (e.g. worker assignment).
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, functionsInstance } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { acceptQuote as applyAcceptedQuote } from '../utils/bookingWorkflow';
import LiveServiceTracker from '../components/LiveServiceTracker';

// UI CONFIG: Color mapping for visual differentiation of booking states
const statusColors = {
  'pending': '#ff9800',           // Awaiting worker assignment
  'assigned': '#2196f3',          // Worker matched to job
  'in_progress': '#9c27b0',       // Work currently underway
  'awaiting_confirmation': '#f44336', // Worker done, waiting for user approval
  'completed': '#4caf50',         // Successfully closed
  'cancelled': '#757575',         // Discarded/Invalidated
  'quoted': '#6366f1',            // Price sent to user
  'accepted': '#ec4899',          // User agreed to price
  'scheduled': '#0ea5e9',         // Future dated jobs
};

// UI CONFIG: Human-readable labels for the user interface
const statusLabels = {
  'pending': 'Pending',
  'assigned': 'Assigned',
  'in_progress': 'In Progress',
  'awaiting_confirmation': 'Awaiting Confirmation',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
  'quoted': 'Quote Received',
  'accepted': 'Price Accepted',
  'scheduled': 'Scheduled',
};

// UI CONFIG: Category-specific iconography
const serviceIcons = {
  'Plumber': '🧰',
  'Electrician': '⚡',
  'Carpenter': '🪛',
  'Painter': '🎨',
};

const USE_FREE_PLAN_MODE = true;

export default function MyBookings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [updating, setUpdating] = useState(false);
  const [disputeId, setDisputeId] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [ratingId, setRatingId] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [selectedStar, setSelectedStar] = useState(0);
  const [cashbacks, setCashbacks] = useState([]);
  const [readError, setReadError] = useState('');

  /* ── Auth Listener ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  /* ── Real-time Bookings Listener ── 
     Logic: Fetches live updates for all bookings belonging to the user.
     Includes sorting by latest and lazy-loading worker profile details.
  */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setReadError('');
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setBookings(items);
    }, err => {
      setReadError(err?.message || 'Unable to load bookings');
    });
    return unsub;
  }, [user]);

  /* ── Cashback Earnt Listener ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'cashbacks'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      setCashbacks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => { /* cashback error */ });
    return unsub;
  }, [user]);

  /* ── Audit Helpers ── */
  const runSparkFallback = async (method, data) => {
    if (!user) throw new Error('Not authenticated');

    if (method === 'acceptQuote') {
      const { bookingId, adminId } = data;
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) throw new Error('Booking not found');
      const booking = bookingSnap.data();
      const acceptedBooking = applyAcceptedQuote(booking, adminId);

      await updateDoc(bookingRef, {
        status: acceptedBooking.status,
        adminId: acceptedBooking.adminId,
        acceptedQuote: acceptedBooking.acceptedQuote,
        statusUpdatedAt: new Date(),
        updatedAt: new Date(),
        userId: user.uid,
      });
      return;
    }

    if (method === 'updateBookingStatus') {
      const { bookingId, action, extraArgs = {} } = data;
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) throw new Error('Booking not found');
      const booking = bookingSnap.data();

      if (booking.userId !== user.uid) throw new Error('Not owner');

      if (action === 'user_cancelled') {
        await updateDoc(bookingRef, { status: 'cancelled', statusUpdatedAt: new Date(), updatedAt: new Date(), userId: user.uid });
        return;
      }

      if (action === 'user_confirm_completion') {
        await updateDoc(bookingRef, { status: 'completed', statusUpdatedAt: new Date(), updatedAt: new Date(), userId: user.uid });
        return;
      }

      if (action === 'user_rate') {
        await updateDoc(bookingRef, { rating: extraArgs.rating, updatedAt: new Date(), userId: user.uid });
        return;
      }

      if (action === 'user_raise_dispute') {
        await updateDoc(bookingRef, {
          dispute: {
            status: 'open',
            reason: extraArgs.reason,
            raisedBy: user.uid,
            raisedAt: new Date(),
            escalationStatus: false,
          },
          updatedAt: new Date(),
          userId: user.uid,
        });
        return;
      }
    }

    throw new Error(`Spark fallback not implemented for ${method}`);
  };

  const callBackend = async (method, data) => {
    if (USE_FREE_PLAN_MODE) {
      try {
        await runSparkFallback(method, data);
      } catch (fallbackErr) {
        alert('Action failed: ' + fallbackErr.message);
        throw fallbackErr;
      }
      return;
    }

    try {
      const func = httpsCallable(functionsInstance, method);
      await func(data);
    } catch (e) {
      // Spark plan cannot deploy callable functions that require Cloud Build.
      try {
        await runSparkFallback(method, data);
      } catch (fallbackErr) {
        alert('Action failed: ' + (fallbackErr.message || e.message));
        throw fallbackErr;
      }
    }
  };

  // Formats Firestore Timestamps for the UI
  const fmt = ts => {
    if (!ts) return 'N/A';
    const ms = ts.seconds ? ts.seconds * 1000 : ts;
    return new Date(ms).toLocaleString();
  };

  /* ── ACTION: Cancel Booking ── 
     Logic: Only allowed for 'pending' jobs. Transitions status to 'cancelled'.
  */
  async function cancelBooking(id) {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_cancelled' });
    } catch (e) {
      // Error handled by callBackend
    }
  }

  /* ── ACTION: Confirm Completion ── 
     Logic: Triggered when user confirms worker marked job as done ('awaiting_confirmation').
     Changes status to 'completed', triggering cashback/payout functions.
  */
  async function confirmCompletion(id) {
    if (!window.confirm('Confirm job is done?')) return;
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_confirm_completion' });
      alert('✓ Service confirmed complete!');
    } catch (e) {
      // Error handled by callBackend
    }
  }

  /* ── ACTION: Save Inline Edit ── 
     Logic: Allows user to update location/contact details for 'pending' bookings.
  */
  async function saveEdit(id) {
    setUpdating(true);
    try {
      // Keep this as updateDoc for now as it's just editing text fields
      await updateDoc(doc(db, 'bookings', id), {
        address: editData.address,
        phone: editData.phone,
        userId: user.uid,
        updatedAt: new Date(),
      });
      setEditingId(null);
      setEditData({});
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setUpdating(false);
    }
  }

  /* ── ACTION: Submit Rating ── 
     Logic: Saves user feedback. 
     Governance: 1-star ratings automatically trigger a dispute.
  */
  async function submitRating(id) {
    if (!selectedStar) { alert('Please select a star rating'); return; }
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_rate', extraArgs: { rating: selectedStar } });
      setRatingId(null);
      setReviewText('');
      setSelectedStar(0);
      if (selectedStar === 1) {
        alert('⚠️ A dispute has been automatically raised due to your 1-star rating. Our region lead will contact you shortly.');
      } else {
        alert('✓ Thank you for your rating!');
      }
    } catch (e) {
      // Error handled by callBackend
    }
  }

  /* ── ACTION: Raise Manual Dispute ── 
     Logic: Allows user to report issues with a service. Sets dispute status to 'open'.
  */
  async function submitDispute(id) {
    if (!disputeReason.trim()) { alert('Please describe the issue'); return; }
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_raise_dispute', extraArgs: { reason: disputeReason.trim() } });
      setDisputeId(null);
      setDisputeReason('');
      alert('✓ Dispute submitted. Admin will review shortly.');
    } catch (e) {
      // Error handled by callBackend
    }
  }

  /* ── ACTION: 1-tap Rebooking ── 
     Logic: Redirects to Service page with pre-filled state for seamless re-ordering.
  */
  async function rebookService(booking) {
    navigate('/service', {
      state: {
        serviceType: booking.serviceType,
        prefillAddress: booking.address,
        prefillPhone: booking.phone
      }
    });
  }

  /* ── ACTION: Accept Quote ── 
     Logic: User selects a specific bid from an admin.
     Transitions: pending/quoted -> accepted. Sets adminId to winning admin.
  */
  async function acceptQuote(id, quote) {
    const finalPrice = quote.finalPrice || quote.price;
    const breakdown = quote.pricing ? 
      `\n\nPrice Breakdown:\n• Base Amount: ₹${quote.pricing.baseAmount}\n• Platform Fee (15%): ₹${quote.pricing.platformFee}\n• Payment Charges (2%): ₹${quote.pricing.paymentCharge}\n═══════════════\n• Total: ₹${finalPrice}` 
      : '';
    
    if (!window.confirm(`Accept quote from ${quote.adminName}?${breakdown}`)) return;
    try {
      await callBackend('acceptQuote', { bookingId: id, adminId: quote.adminId });

      alert('✓ Quote accepted! Your regional pro will assign a worker shortly.');
    } catch (e) {
      // Error handled by callBackend
    }
  }

  /* ── Booking groups ── */
  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    const text = searchTerm.trim().toLowerCase();
    if (!text) return true;
    return [b.id, b.serviceType, b.status, b.address, b.assignedWorker, b.workerName]
      .some((v) => (v || '').toString().toLowerCase().includes(text));
  });

  const active = filteredBookings.filter(b => ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status));
  const completed = filteredBookings.filter(b => b.status === 'completed');
  const cancelled = filteredBookings.filter(b => b.status === 'cancelled');

  /* ── COMPONENT: BookingCard ── 
     Logic: Renders the details of an individual booking.
     Dynamic Elements: Status badges, dispute alerts, worker profiles, and action buttons.
  */
  const BookingCard = ({ booking, isActive }) => (
    <div style={{
      background: 'white',
      padding: '16px',
      borderRadius: '10px',
      marginBottom: '12px',
      border: `2px solid ${statusColors[booking.status] || '#ccc'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    }}>
      {/* CARD HEADER: Service Identity & Live Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Service Icon Representation */}
          <span style={{ fontSize: '30px' }}>{serviceIcons[booking.serviceType] || '🛠️'}</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333' }}>
              {(booking.serviceType || 'Service').toUpperCase()}
            </div>
            {/* AUDIT INFO: Showing update times for user transparency */}
            <div style={{ fontSize: '11px', color: '#999' }}>
              Created: {fmt(booking.createdAt)} | Updated: {fmt(booking.updatedAt)}
            </div>
          </div>
        </div>
        {/* Dynamic Status Badge */}
        <div style={{
          padding: '5px 10px',
          backgroundColor: statusColors[booking.status] || '#ccc',
          color: 'white',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 'bold',
        }}>
          {statusLabels[booking.status] || booking.status}
        </div>
      </div>

      {/* DISPUTE NOTIFICATIONS: Highlighting issues for user awareness */}
      {booking.dispute?.status === 'open' && (
        <div style={{ padding: '6px 10px', background: '#fee2e2', borderRadius: '6px', fontSize: '12px', color: '#991b1b', marginBottom: '10px' }}>
          🚨 Dispute raised: "{booking.dispute.reason}"
        </div>
      )}
      {booking.dispute?.status === 'resolved' && (
        <div style={{ padding: '6px 10px', background: '#dcfce7', borderRadius: '6px', fontSize: '12px', color: '#166534', marginBottom: '10px' }}>
          ✓ Dispute resolved
        </div>
      )}

      {/* CORE DETAILS: Display Mode vs Inline Edit Mode */}
      {editingId === booking.id ? (
        /* INLINE EDIT FORM */
        <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Phone:</label>
          <input type="tel" value={editData.phone}
            onChange={e => setEditData({ ...editData, phone: e.target.value })}
            style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', marginBottom: '8px' }}
          />
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>Address:</label>
          <textarea value={editData.address} rows={3}
            onChange={e => setEditData({ ...editData, address: e.target.value })}
            style={{ width: '100%', padding: '8px', marginTop: '4px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setEditingId(null)} disabled={updating}
              style={{ flex: 1, padding: '8px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              Cancel
            </button>
            <button onClick={() => saveEdit(booking.id)} disabled={updating}
              style={{ flex: 1, padding: '8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', opacity: updating ? 0.6 : 1 }}>
              {updating ? '⏳ Saving…' : '✓ Save'}
            </button>
          </div>
        </div>
      ) : (
        /* STANDARD DATA DISPLAY */
        <div style={{ marginBottom: '12px' }}>
          <div><span style={{ fontWeight: 'bold', color: '#666', fontSize: '12px' }}>📞 Phone: </span>{booking.phone}</div>
          <div style={{ marginTop: '4px' }}>
            <span style={{ fontWeight: 'bold', color: '#666', fontSize: '12px' }}>📍 Address: </span>
            {/* NAVIGATION: Google Maps integration for address location */}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#2196f3', textDecoration: 'none' }}
            >
              {booking.address} ↗
            </a>
          </div>
          {Number(booking.estimatedDays || 1) > 1 && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#4b5563' }}>
              Multi-day progress: {Number(booking.completedWorkDays || 0)}/{Number(booking.estimatedDays || 1)} days completed
            </div>
          )}

          {/* WORKER ASSIGNMENT CARD */}
          {booking.assignedWorker && (
            <div style={{
              marginTop: '10px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{ width: '40px', height: '40px', background: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                👷
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Assigned Professional</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>{booking.assignedWorker}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {booking.workerPhone ? `📞 ${booking.workerPhone}` : '👷 Professional Worker'}
                </div>
              </div>
            </div>
          )}

          {/* LIVE WORKER TRACKING — shown for assigned/in_progress immediate bookings */}
          {['assigned', 'in_progress'].includes(booking.status) && booking.assignedWorker && (
            <LiveServiceTracker bookingId={booking.id} />
          )}

          {/* Multi-day progress tracking */}
          {booking.dailyNotes?.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>📋 Work Progress Notes:</div>
              {booking.dailyNotes.map((n, i) => (
                <div key={n.date || i} style={{ fontSize: '12px', color: '#555', padding: '4px 8px', background: '#f0f4ff', borderRadius: '4px', marginBottom: '4px' }}>
                  <strong>{n.date}</strong>: {n.note}
                </div>
              ))}
            </div>
          )}

          {/* Work Evidence Photos */}
          {booking.photos?.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>📸 Photos:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {booking.photos.map((p, i) => (
                  <a key={p.url || i} href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.label} title={p.label}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rating Snapshot */}
          {booking.rating && (
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              <strong>Your Rating:</strong> {'★'.repeat(booking.rating)}{'☆'.repeat(5 - booking.rating)}
              {booking.rating === 1 && (
                <span style={{ marginLeft: '8px', color: '#dc2626', fontSize: '11px', fontWeight: 'bold' }}>🚨 Auto-dispute triggered</span>
              )}
            </div>
          )}

          {/* Cashback Status */}
          {booking.status === 'completed' && (() => {
            const cb = cashbacks.find(c => c.bookingId === booking.id);
            if (!cb) return null;
            const expiryDate = cb.cashbackExpiryDate?.toDate ? cb.cashbackExpiryDate.toDate() : new Date(cb.cashbackExpiryDate);
            const isExpired = cb.cashbackStatus === 'expired' || new Date() > expiryDate;
            return (
              <div style={{
                marginTop: '8px', padding: '8px 12px', borderRadius: '8px',
                background: isExpired ? '#f1f5f9' : 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                border: `1px solid ${isExpired ? '#e2e8f0' : '#86efac'}`,
                fontSize: '12px',
              }}>
                {isExpired ? (
                  <div style={{ color: '#94a3b8' }}>💸 ₹{cb.cashbackAmount} cashback expired</div>
                ) : (
                  <>
                    <div style={{ color: '#166534', fontWeight: 'bold' }}>🎉 ₹{cb.cashbackAmount} cashback earned!</div>
                    <div style={{ color: '#15803d', marginTop: '2px' }}>
                      Status: {cb.cashbackStatus} | Expires: {expiryDate.toLocaleDateString('en-IN')}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Payment Lifecycle (Escrow Status) */}
          {booking.escrowStatus && (
            <div style={{
              marginTop: '6px', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', display: 'inline-block',
              background: booking.escrowStatus === 'held' ? '#fef3c7' : booking.escrowStatus === 'refunded' ? '#dcfce7' : '#f1f5f9',
              color: booking.escrowStatus === 'held' ? '#92400e' : booking.escrowStatus === 'refunded' ? '#166534' : '#64748b',
            }}>
              💰 Escrow: {booking.escrowStatus}
            </div>
          )}
        </div>
      )}

      {/* FOOTER ACTIONS: Context-aware buttons */}
      {editingId !== booking.id && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* ACTIONS: Pending jobs can be edited or cancelled */}
          {isActive && ['pending', 'scheduled'].includes(booking.status) && (
            <>
              <button onClick={() => { setEditingId(booking.id); setEditData({ address: booking.address, phone: booking.phone }); }}
                style={{ flex: '1 0 auto', padding: '8px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                ✏️ Edit Details
              </button>
              <button onClick={() => cancelBooking(booking.id)}
                style={{ flex: '1 0 auto', padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                ✕ Cancel Booking
              </button>
            </>
          )}

          {/* ACTIONS: Cancel quoted or accepted jobs before worker assignment */}
          {['quoted', 'accepted'].includes(booking.status) && (
            <button onClick={() => cancelBooking(booking.id)}
              style={{ flex: '1 0 auto', padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              ✕ Cancel Booking
            </button>
          )}

          {/* ACTIONS: Job verification */}
          {booking.status === 'awaiting_confirmation' && (
            <>
              <div style={{ width: '100%', padding: '8px', background: '#fff3cd', borderRadius: '6px', fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                ⏳ Worker has marked the job done. Please confirm once you're satisfied.
              </div>
              <button onClick={() => confirmCompletion(booking.id)}
                style={{ flex: 1, padding: '10px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                ✓ Confirm Completion
              </button>
            </>
          )}

          {/* ACTIONS: Feedback & Rebooking */}
          {booking.status === 'completed' && (
            <>
              {!booking.rating && (
                <button onClick={() => { setRatingId(booking.id); setSelectedStar(0); setReviewText(''); }}
                  style={{ flex: '1 0 auto', padding: '8px 12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  ⭐ Review Service
                </button>
              )}
              {!booking.dispute && (
                <button onClick={() => { setDisputeId(booking.id); setDisputeReason(''); }}
                  style={{ flex: '1 0 auto', padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  🚨 Raise Dispute
                </button>
              )}
              {/* Rebook button for quick repeat service */}
              <button onClick={() => rebookService(booking)}
                style={{ flex: '1 0 auto', padding: '8px 12px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                🔄 Rebook Service
              </button>
            </>
          )}

          {/* CANCELLED: rebook */}
          {booking.status === 'cancelled' && (
            <button onClick={() => rebookService(booking)}
              style={{ flex: '1 0 auto', padding: '8px 12px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              🔄 Rebook Service
            </button>
          )}

          {/* ACTIONS: Quote Acceptance (Multi-bid version) */}
          {(booking.status === 'pending' || booking.status === 'scheduled' || booking.status === 'quoted') && booking.quotes?.length > 0 && (
            <div style={{ width: '100%', marginBottom: '10px' }}>
              <div style={{ padding: '12px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #6366f1', marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#4338ca', marginBottom: '8px' }}>
                  💰 Bids Received ({booking.quotes.length})
                </div>
                {booking.quotes.map((q, idx) => {
                  const finalPrice = q.finalPrice || q.price;
                  const hasPricing = q.pricing && q.pricing.platformFee;
                  
                  return (
                    <div key={idx} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px', background: 'white', borderRadius: '6px', marginBottom: '6px',
                      border: '1px solid #e0e7ff'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{q.adminName}</div>
                        <div style={{ fontSize: '14px', color: '#4f46e5', fontWeight: 'bold' }}>₹{finalPrice}</div>
                        {hasPricing && (
                          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                            Base: ₹{q.pricing.baseAmount} + Platform Fee: ₹{q.pricing.platformFee} + Payment: ₹{q.pricing.paymentCharge}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => acceptQuote(booking.id, q)}
                        style={{
                          padding: '6px 12px', background: '#4caf50', color: 'white',
                          border: 'none', borderRadius: '4px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: 'bold'
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {booking.status === 'accepted' && (
            <div style={{ width: '100%', marginBottom: '10px', padding: '12px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #10b981' }}>
              <div style={{ fontSize: '13px', color: '#065f46', fontWeight: 'bold' }}>
                🤝 Price Accepted: ₹{booking.acceptedQuote?.finalPrice || booking.acceptedQuote?.price}
              </div>
              <div style={{ fontSize: '11px', color: '#059669' }}>
                Admin: {booking.acceptedQuote?.adminName} | Worker assignment in progress.
              </div>
            </div>
          )}

          {/* NAVIGATION: Unified support chat */}
          {isActive && (
            <button onClick={() => navigate(`/chat?bookingId=${booking.id}`)}
              style={{ flex: '1 0 auto', padding: '8px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              💬 Chat with Support
            </button>
          )}
        </div>
      )}

      {/* PANEL: User Feedback (Rating) */}
      {ratingId === booking.id && (
        <div style={{ marginTop: '12px', background: '#fffbeb', border: '1px solid #fcd34d', padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>⭐ Rate this service</div>
          {/* Star Selection Row */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} onClick={() => setSelectedStar(star)}
                style={{ fontSize: '24px', cursor: 'pointer', color: star <= selectedStar ? '#ffb400' : '#ccc' }}>★</span>
            ))}
          </div>
          <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
            placeholder="Write a review (optional)…" rows={2}
            style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box', fontSize: '12px', marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setRatingId(null)}
              style={{ flex: 1, padding: '8px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              Cancel
            </button>
            <button onClick={() => submitRating(booking.id)}
              style={{ flex: 1, padding: '8px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              Submit Rating
            </button>
          </div>
        </div>
      )}

      {/* PANEL: Support Intervention (Dispute) */}
      {disputeId === booking.id && (
        <div style={{ marginTop: '12px', background: '#fef2f2', border: '1px solid #fca5a5', padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px', color: '#dc2626' }}>🚨 Raise a Dispute</div>
          <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
            placeholder="Describe the issue in detail…" rows={3}
            style={{ width: '100%', padding: '8px', border: '1px solid #fca5a5', borderRadius: '4px', boxSizing: 'border-box', fontSize: '12px', marginBottom: '8px' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setDisputeId(null)}
              style={{ flex: 1, padding: '8px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              Cancel
            </button>
            <button onClick={() => submitDispute(booking.id)}
              style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              Submit Dispute
            </button>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Render ── */
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '24px 18px 90px', color: '#1f2937' }}>
      <h2 style={{ fontSize: '34px', marginBottom: '8px', color: '#1f2937', fontFamily: 'Manrope, Inter, sans-serif' }}>
        My Bookings
      </h2>
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#4b5563' }}>
        Track requests, compare quotes, and manage service progress in one place.
      </p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by service, status, location, booking id"
          style={{
            flex: 1,
            padding: '11px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            fontSize: '14px',
            background: 'white'
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '11px 12px',
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            fontSize: '14px',
            background: 'white'
          }}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="scheduled">Scheduled</option>
          <option value="quoted">Quoted</option>
          <option value="accepted">Accepted</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="awaiting_confirmation">Awaiting Confirmation</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {!user && (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff3cd', borderRadius: '8px', color: '#856404' }}>
          Please login to view your bookings.
        </div>
      )}

      {user && (
        <>
          {readError && (
            <div style={{
              marginBottom: '14px',
              padding: '10px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px'
            }}>
              {readError}
            </div>
          )}

          {/* SECTION: ACTIVE BOOKINGS (Jobs in progress or awaiting assignment) */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '20px', color: '#1f2937', marginBottom: '12px', fontFamily: 'Manrope, Inter, sans-serif' }}>
              Active Bookings ({active.length})
            </h3>
            {active.length === 0
              ? <div style={{ padding: '20px', textAlign: 'center', background: '#f8f7fb', borderRadius: '10px', color: '#6b7280', border: '1px solid #d6d8de' }}>No active bookings</div>
              : active.map(b => <BookingCard key={b.id} booking={b} isActive={true} />)
            }
          </div>

          {/* SECTION: COMPLETED HISTORY (Successful past jobs) */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '20px', color: '#1f2937', marginBottom: '12px', fontFamily: 'Manrope, Inter, sans-serif' }}>
              Completed ({completed.length})
            </h3>
            {completed.length === 0
              ? <div style={{ padding: '20px', textAlign: 'center', background: '#f8f7fb', borderRadius: '10px', color: '#6b7280', border: '1px solid #d6d8de' }}>No completed bookings</div>
              : completed.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)
            }
          </div>

          {/* SECTION: CANCELLED ARCHIVE (Discarded transactions) */}
          {cancelled.length > 0 && (
            <div>
              <h3 style={{ fontSize: '20px', color: '#1f2937', marginBottom: '12px', fontFamily: 'Manrope, Inter, sans-serif' }}>
                Cancelled ({cancelled.length})
              </h3>
              {cancelled.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
