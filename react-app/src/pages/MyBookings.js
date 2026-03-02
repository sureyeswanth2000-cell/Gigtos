import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp
} from 'firebase/firestore';

const statusColors = {
  'pending': '#ff9800',
  'assigned': '#2196f3',
  'in_progress': '#9c27b0',
  'awaiting_confirmation': '#f44336',
  'completed': '#4caf50',
  'cancelled': '#757575',
};

const statusLabels = {
  'pending': '⏳ Pending',
  'assigned': '👷 Assigned',
  'in_progress': '🔧 In Progress',
  'awaiting_confirmation': '✅ Awaiting Confirmation',
  'completed': '✓ Completed',
  'cancelled': '✕ Cancelled',
};

const serviceIcons = {
  'Plumber': '🧰',
  'Electrician': '⚡',
  'Carpenter': '🪛',
  'Painter': '🎨',
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [updating, setUpdating] = useState(false);
  const [disputeId, setDisputeId] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [ratingId, setRatingId] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [selectedStar, setSelectedStar] = useState(0);

  /* ── Auth ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  /* ── Real-time bookings ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setBookings(items);
    }, err => console.error('snapshot error', err));
    return unsub;
  }, [user]);

  /* ── Helpers ── */
  const logActivity = (bookingId, action, extra = {}) =>
    addDoc(collection(db, 'activity_logs'), {
      bookingId,
      actorId: user?.uid,
      actorRole: 'user',
      action,
      ...extra,
      timestamp: serverTimestamp(),
    }).catch(() => { });

  const fmt = ts => {
    if (!ts) return 'N/A';
    const ms = ts.seconds ? ts.seconds * 1000 : ts;
    return new Date(ms).toLocaleString();
  };

  /* ── Cancel booking ── */
  async function cancelBooking(id) {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await updateDoc(doc(db, 'bookings', id), {
        status: 'cancelled',
        userId: user.uid,      // must re-send userId so security rule passes
        updatedAt: new Date(),
      });
      await logActivity(id, 'user_cancelled');
    } catch (e) {
      alert('Failed to cancel: ' + e.message);
    }
  }

  /* ── Confirm completion ── */
  async function confirmCompletion(id) {
    if (!window.confirm('Confirm job is done?')) return;
    try {
      await updateDoc(doc(db, 'bookings', id), {
        status: 'completed',
        userId: user.uid,
        updatedAt: new Date(),
      });
      await logActivity(id, 'user_confirmed_completion');
      alert('✓ Service confirmed complete!');
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  /* ── Edit pending booking ── */
  async function saveEdit(id) {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'bookings', id), {
        address: editData.address,
        phone: editData.phone,
        userId: user.uid,
        updatedAt: new Date(),
      });
      await logActivity(id, 'user_edited_booking');
      setEditingId(null);
      setEditData({});
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setUpdating(false);
    }
  }

  /* ── Rating ── */
  async function submitRating(id) {
    if (!selectedStar) { alert('Please select a star rating'); return; }
    try {
      await updateDoc(doc(db, 'bookings', id), {
        rating: selectedStar,
        review: reviewText,
        userId: user.uid,
      });
      await logActivity(id, 'user_rated', { rating: selectedStar });
      setRatingId(null);
      setReviewText('');
      setSelectedStar(0);
      alert('✓ Thank you for your rating!');
    } catch (e) {
      alert('Failed to save rating: ' + e.message);
    }
  }

  /* ── Dispute ── */
  async function submitDispute(id) {
    if (!disputeReason.trim()) { alert('Please describe the issue'); return; }
    try {
      await updateDoc(doc(db, 'bookings', id), {
        dispute: {
          reason: disputeReason.trim(),
          raisedAt: new Date(),
          status: 'open',
          raisedBy: user.uid,
        },
        userId: user.uid,
        updatedAt: new Date(),
      });
      await logActivity(id, 'user_raised_dispute', { reason: disputeReason });
      setDisputeId(null);
      setDisputeReason('');
      alert('✓ Dispute submitted. Admin will review shortly.');
    } catch (e) {
      alert('Failed: ' + e.message);
    }
  }

  /* ── 1-tap Rebooking ── */
  async function rebookService(booking) {
    // Navigate back to service page with the same category pre-selected
    // This provides a seamless "Book Again" experience for the user
    navigate('/service', {
      state: {
        serviceType: booking.serviceType, // Carry over the service category
        prefillAddress: booking.address,  // Carry over the previous location for convenience
        prefillPhone: booking.phone       // Carry over the contact number
      }
    });
  }

  /* ── Booking groups ── */
  const active = bookings.filter(b => ['pending', 'assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status));
  const completed = bookings.filter(b => b.status === 'completed');
  const cancelled = bookings.filter(b => b.status === 'cancelled');

  /* ── BookingCard Component ── */
  const BookingCard = ({ booking, isActive }) => (
    <div style={{
      background: 'white',
      padding: '16px',
      borderRadius: '10px',
      marginBottom: '12px',
      border: `2px solid ${statusColors[booking.status] || '#ccc'}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    }}>
      {/* Visual Header with Service Icon and Auto-Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Display category-specific emoji icon */}
          <span style={{ fontSize: '30px' }}>{serviceIcons[booking.serviceType] || '🛠️'}</span>
          <div>
            {/* Service title in uppercase */}
            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333' }}>
              {(booking.serviceType || 'Service').toUpperCase()}
            </div>
            {/* Timestamps for transparency */}
            <div style={{ fontSize: '11px', color: '#999' }}>
              Created: {fmt(booking.createdAt)} | Updated: {fmt(booking.updatedAt)}
            </div>
          </div>
        </div>
        {/* Colorful status badge */}
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

      {/* Real-time Dispute Alerts */}
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

      {/* Dynamic Content Body (Edit Mode vs Display Mode) */}
      {editingId === booking.id ? (
        // Inline Edit Form for Pending Bookings
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
            {/* Cancel Edit Mode */}
            <button onClick={() => setEditingId(null)} disabled={updating}
              style={{ flex: 1, padding: '8px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              Cancel
            </button>
            {/* Persist Changes to Firestore */}
            <button onClick={() => saveEdit(booking.id)} disabled={updating}
              style={{ flex: 1, padding: '8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', opacity: updating ? 0.6 : 1 }}>
              {updating ? '⏳ Saving…' : '✓ Save'}
            </button>
          </div>
        </div>
      ) : (
        // Standard View for Booking Details
        <div style={{ marginBottom: '12px' }}>
          {/* User Contact Info */}
          <div><span style={{ fontWeight: 'bold', color: '#666', fontSize: '12px' }}>📞 Phone: </span>{booking.phone}</div>
          <div style={{ marginTop: '4px' }}><span style={{ fontWeight: 'bold', color: '#666', fontSize: '12px' }}>📍 Address: </span>{booking.address}</div>

          {/* Trust-Building Worker Profile Card */}
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
              {/* Worker Avatar Placeholder */}
              <div style={{ width: '40px', height: '40px', background: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                👷
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'bold' }}>Assigned Professional</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>{booking.assignedWorker}</div>
                {/* Visual Rating Indicator for Worker */}
                <div style={{ fontSize: '12px', color: '#f59e0b' }}>
                  ★★★★★ <span style={{ color: '#6b7280', fontSize: '11px' }}>(Top Rated)</span>
                </div>
              </div>
            </div>
          )}
          {/* Multi-day notes */}
          {booking.dailyNotes?.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>📋 Work Progress Notes:</div>
              {booking.dailyNotes.map((n, i) => (
                <div key={i} style={{ fontSize: '12px', color: '#555', padding: '4px 8px', background: '#f0f4ff', borderRadius: '4px', marginBottom: '4px' }}>
                  <strong>{n.date}</strong>: {n.note}
                </div>
              ))}
            </div>
          )}
          {/* Photos */}
          {booking.photos?.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '4px' }}>📸 Photos:</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {booking.photos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.label} title={p.label}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} />
                  </a>
                ))}
              </div>
            </div>
          )}
          {/* Existing rating display */}
          {booking.rating && (
            <div style={{ marginTop: '8px', fontSize: '13px' }}>
              <strong>Your Rating:</strong> {'★'.repeat(booking.rating)}{'☆'.repeat(5 - booking.rating)}
              {booking.review && <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>"{booking.review}"</div>}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {editingId !== booking.id && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* PENDING: edit + cancel */}
          {isActive && booking.status === 'pending' && (
            <>
              <button onClick={() => { setEditingId(booking.id); setEditData({ address: booking.address, phone: booking.phone }); }}
                style={{ flex: '1 0 auto', padding: '8px 12px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                ✏️ Edit
              </button>
              <button onClick={() => cancelBooking(booking.id)}
                style={{ flex: '1 0 auto', padding: '8px 12px', background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                ✕ Cancel Booking
              </button>
            </>
          )}

          {/* AWAITING CONFIRMATION: confirm complete */}
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

          {/* COMPLETED: rate + dispute + rebook */}
          {booking.status === 'completed' && (
            <>
              {!booking.rating && (
                <button onClick={() => { setRatingId(booking.id); setSelectedStar(0); setReviewText(''); }}
                  style={{ flex: '1 0 auto', padding: '8px 12px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                  ⭐ Rate Service
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

          {/* Chat button for any active booking to enable communication */}
          {isActive && (
            <button onClick={() => navigate(`/chat?bookingId=${booking.id}`)}
              style={{ flex: '1 0 auto', padding: '8px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
              💬 Chat
            </button>
          )}
        </div>
      )}

      {/* Rating Panel */}
      {ratingId === booking.id && (
        <div style={{ marginTop: '12px', background: '#fffbeb', border: '1px solid #fcd34d', padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>⭐ Rate this service</div>
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

      {/* Dispute Panel */}
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
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '20px', color: '#333' }}>📦 My Bookings</h2>

      {!user && (
        <div style={{ padding: '20px', textAlign: 'center', background: '#fff3cd', borderRadius: '8px', color: '#856404' }}>
          Please login to view your bookings.
        </div>
      )}

      {user && (
        <>
          {/* Active */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '17px', color: '#333', marginBottom: '12px' }}>
              🟡 Active Bookings ({active.length})
            </h3>
            {active.length === 0
              ? <div style={{ padding: '20px', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px', color: '#999' }}>No active bookings</div>
              : active.map(b => <BookingCard key={b.id} booking={b} isActive={true} />)
            }
          </div>

          {/* Completed */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '17px', color: '#333', marginBottom: '12px' }}>
              ✓ Completed ({completed.length})
            </h3>
            {completed.length === 0
              ? <div style={{ padding: '20px', textAlign: 'center', background: '#f5f5f5', borderRadius: '8px', color: '#999' }}>No completed bookings</div>
              : completed.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)
            }
          </div>

          {/* Cancelled */}
          {cancelled.length > 0 && (
            <div>
              <h3 style={{ fontSize: '17px', color: '#333', marginBottom: '12px' }}>
                ✕ Cancelled ({cancelled.length})
              </h3>
              {cancelled.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
