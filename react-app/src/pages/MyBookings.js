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
  Clock, CheckCircle, Play, AlertCircle, XCircle, 
  Trash2, Edit, MessageSquare, Star, ShieldAlert,
  HardHat, Hammer, Droplets, Zap, Paintbrush, 
  MapPin, Phone, Calendar, RefreshCcw, ArrowRight,
  TrendingUp, Wallet, Search
} from 'lucide-react';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, getDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { acceptQuote as applyAcceptedQuote } from '../utils/bookingWorkflow';
import LiveServiceTracker from '../components/LiveServiceTracker';
import TrackingMap from '../components/TrackingMap';
import UserDisputePhotoUpload from '../components/UserDisputePhotoUpload';
import './MyBookings.css';

// UI CONFIG: Color mapping for visual differentiation of booking states
const statusColors = {
  'pending': 'var(--warning)',           // Awaiting worker assignment
  'assigned': 'var(--primary-purple)',     // Worker matched to job
  'in_progress': 'var(--primary-purple)',  // Work currently underway
  'awaiting_confirmation': 'var(--error)', // Worker done, waiting for user approval
  'completed': 'var(--success)',         // Successfully closed
  'cancelled': 'var(--text-muted)',       // Discarded/Invalidated
  'quoted': 'var(--primary-purple)',      // Price sent to user
  'accepted': 'var(--primary-purple)',    // User agreed to price
  'scheduled': 'var(--primary-purple)',    // Future dated jobs
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
  const [invoiceBookingId, setInvoiceBookingId] = useState(null);
  const [syncingPaymentId, setSyncingPaymentId] = useState(null);
  const [userDisputePhotos, setUserDisputePhotos] = useState([]);

  /* ── Auth Listener ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  /* ── Real-time Bookings Listener ── */
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
      try {
        await runSparkFallback(method, data);
      } catch (fallbackErr) {
        alert('Action failed: ' + (fallbackErr.message || e.message));
        throw fallbackErr;
      }
    }
  };

  const fmt = ts => {
    if (!ts) return 'N/A';
    const ms = ts.seconds ? ts.seconds * 1000 : ts;
    return new Date(ms).toLocaleString();
  };

  const buildInvoiceData = (booking) => {
    const acceptedQuote = Number(booking?.acceptedQuote?.finalPrice || booking?.acceptedQuote?.price || 0);
    const baseAmount = acceptedQuote || Number(booking?.quoteAmount || 1200);
    const platformFee = Math.round(baseAmount * 0.08);
    const taxes = Math.round((baseAmount + platformFee) * 0.18);
    const walletCredit = Number((cashbacks.find(c => c.bookingId === booking.id)?.cashbackAmount) || 0);
    const total = Math.max(baseAmount + platformFee + taxes - walletCredit, 0);
    return {
      invoiceNo: `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      baseAmount,
      platformFee,
      taxes,
      walletCredit,
      total,
      paymentStatus: derivePaymentStatus(booking),
    };
  };

  const derivePaymentStatus = (booking) => {
    if (booking?.paymentStatus) return booking.paymentStatus;
    if (booking?.escrowStatus === 'refunded') return 'refunded';
    if (booking?.escrowStatus === 'released') return 'paid';
    if (booking?.status === 'completed') return 'paid';
    if (['accepted', 'assigned', 'in_progress', 'awaiting_confirmation'].includes(booking?.status)) return 'processing';
    if (booking?.status === 'cancelled') return 'cancelled';
    return 'pending';
  };

  const downloadInvoicePdf = async (booking) => {
    try {
      const { jsPDF } = await import('jspdf');
      const invoice = buildInvoiceData(booking);
      const pdf = new jsPDF();
      const startX = 16;
      let y = 18;
      pdf.setFontSize(18);
      pdf.text('Gigtos Invoice', startX, y);
      y += 10;
      pdf.setFontSize(11);
      pdf.text(`Invoice No: ${invoice.invoiceNo}`, startX, y);
      y += 6;
      pdf.text(`Booking ID: ${booking.id}`, startX, y);
      y += 6;
      pdf.text(`Service: ${booking.serviceType || 'Service'}`, startX, y);
      y += 6;
      pdf.text(`Customer: ${booking.customerName || 'N/A'}`, startX, y);
      y += 6;
      pdf.text(`Payment Status: ${invoice.paymentStatus}`, startX, y);
      y += 10;
      const addressLines = pdf.splitTextToSize(`Address: ${booking.address || 'N/A'}`, 180);
      pdf.text(addressLines, startX, y);
      y += (addressLines.length * 6) + 4;
      pdf.text(`Labor & Materials: Rs. ${invoice.baseAmount}`, startX, y);
      y += 6;
      pdf.text(`Platform Convenience Fee: Rs. ${invoice.platformFee}`, startX, y);
      y += 6;
      pdf.text(`Taxes: Rs. ${invoice.taxes}`, startX, y);
      y += 6;
      pdf.text(`Wallet Credit Applied: -Rs. ${invoice.walletCredit}`, startX, y);
      y += 8;
      pdf.setFontSize(13);
      pdf.text(`Grand Total: Rs. ${invoice.total}`, startX, y);
      y += 10;
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, startX, y);
      pdf.save(`invoice-${invoice.invoiceNo}.pdf`);
    } catch (e) {
      alert('Unable to generate PDF right now.');
    }
  };

  async function cancelBooking(id) {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_cancelled' });
    } catch (e) {}
  }

  async function confirmCompletion(id) {
    if (!window.confirm('Confirm job is done?')) return;
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_confirm_completion' });
      alert('✓ Service confirmed complete!');
    } catch (e) {}
  }

  async function saveEdit(id) {
    setUpdating(true);
    try {
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

  async function submitRating(id) {
    if (!selectedStar) { alert('Please select a star rating'); return; }
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_rate', extraArgs: { rating: selectedStar } });
      setRatingId(null);
      setReviewText('');
      setSelectedStar(0);
      if (selectedStar === 1) {
        alert('⚠️ A dispute has been automatically raised due to your 1-star rating.');
      } else {
        alert('✓ Thank you for your rating!');
      }
    } catch (e) {}
  }

  async function submitDispute(id) {
    if (!disputeReason.trim()) { alert('Please describe the issue'); return; }
    try {
      // Attach userDisputePhotos to dispute object
      await callBackend('updateBookingStatus', {
        bookingId: id,
        action: 'user_raise_dispute',
        extraArgs: { reason: disputeReason.trim(), userPhotos: userDisputePhotos }
      });
      setDisputeId(null);
      setDisputeReason('');
      setUserDisputePhotos([]);
      alert('✓ Dispute submitted. Admin will review shortly.');
    } catch (e) {}
  }

  async function rebookService(booking) {
    navigate('/service', {
      state: {
        serviceType: booking.serviceType,
        prefillAddress: booking.address,
        prefillPhone: booking.phone
      }
    });
  }

  async function acceptQuote(id, quote) {
    const finalPrice = quote.finalPrice || quote.price;
    if (!window.confirm(`Accept quote from ${quote.adminName} for ₹${finalPrice}?`)) return;
    try {
      await callBackend('acceptQuote', { bookingId: id, adminId: quote.adminId });
      alert('✓ Quote accepted!');
    } catch (e) {}
  }

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

  const BookingCard = ({ booking, isActive }) => {
    // Try to extract lat/lng from booking.address or booking fields
    let consumerLat = booking.lat, consumerLng = booking.lng;
    // If address is geocoded, parse from address string (optional: add geocoding logic)
    // For demo, only show map if lat/lng present
    return (
      <div className="booking-card" style={{ borderColor: statusColors[booking.status] || 'var(--glass-border-light)' }}>
      <div className="card-top">
        <div className="service-identity">
          <span className="service-icon">{serviceIcons[booking.serviceType] || '🛠️'}</span>
          <div className="service-info">
            <h4>{(booking.serviceType || 'Service').toUpperCase()}</h4>
            <span className="booking-id">ID: {booking.id.slice(0, 8).toUpperCase()}</span>
          </div>
        </div>
        <div className="status-badge" style={{ backgroundColor: statusColors[booking.status] || '#ccc' }}>
          {statusLabels[booking.status] || booking.status}
        </div>
      </div>

      <div className="card-meta">
        <span className="meta-item">Updated: {fmt(booking.updatedAt)}</span>
      </div>

      {booking.dispute?.status === 'open' && (
        <div className="alert-message error">🚨 Dispute raised: "{booking.dispute.reason}"</div>
      )}
      {booking.dispute?.status === 'resolved' && (
        <div className="alert-message success">✓ Dispute resolved</div>
      )}

      {editingId === booking.id ? (
        <div className="edit-panel">
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea value={editData.address} rows={3} onChange={e => setEditData({ ...editData, address: e.target.value })} />
          </div>
          <div className="edit-actions">
            <button className="btn-secondary" onClick={() => setEditingId(null)} disabled={updating}>Cancel</button>
            <button className="btn-primary" onClick={() => saveEdit(booking.id)} disabled={updating}>
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card-body">
          <div className="card-details">
            <div className="detail-item">
              <span className="detail-label">Location</span>
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.address)}`} target="_blank" rel="noreferrer" className="detail-value link">
                {booking.address} ↗
              </a>
            </div>
            <div className="detail-item">
              <span className="detail-label">Contact</span>
              <span className="detail-value">{booking.phone}</span>
            </div>
          </div>

          {booking.assignedWorker && (
            <div className="worker-brief">
              <div className="worker-avatar">👷</div>
              <div className="worker-info">
                <span className="info-label">Assigned Professional</span>
                <span className="info-name">{booking.assignedWorker}</span>
                <span className="info-phone">{booking.workerPhone || 'Professional Worker'}</span>
              </div>
            </div>
          )}

          {/* Live Worker Tracking Map */}
          {isActive && booking.assignedWorkerId && consumerLat && consumerLng && (
            <div style={{ margin: '16px 0' }}>
              <TrackingMap bookingId={booking.id} consumerLat={consumerLat} consumerLng={consumerLng} />
            </div>
          )}

          {booking.photos?.length > 0 && (
            <div className="evidence-grid">
              <span className="grid-label">Work Evidence:</span>
              <div className="photo-list">
                {booking.photos.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="Evidence" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {booking.rating && (
            <div className="rating-display">
              <span className="rating-label">Service Rating:</span>
              <span className="stars">{'★'.repeat(booking.rating)}{'☆'.repeat(5 - booking.rating)}</span>
            </div>
          )}
        </div>
      )}

      {editingId !== booking.id && (
        <div className="card-actions">
          {isActive && ['pending', 'scheduled'].includes(booking.status) && (
            <>
              <button className="btn-secondary" onClick={() => { setEditingId(booking.id); setEditData({ address: booking.address, phone: booking.phone }); }}>
                ✏️ Edit Details
              </button>
              <button className="btn-danger" onClick={() => cancelBooking(booking.id)}>✕ Cancel</button>
            </>
          )}

          {booking.status === 'awaiting_confirmation' && (
            <button className="btn-primary w-full" onClick={() => confirmCompletion(booking.id)}>✓ Confirm Job Done</button>
          )}

          {booking.status === 'completed' && (
            <>
              <button className="btn-secondary" onClick={() => setInvoiceBookingId(booking.id)}>🧾 Invoice</button>
              {!booking.rating && (
                <button className="btn-primary" onClick={() => { setRatingId(booking.id); setSelectedStar(0); setReviewText(''); }}>⭐ Rate</button>
              )}
            </>
          )}

          {isActive && (
            <button className="btn-primary" onClick={() => navigate(`/chat?bookingId=${booking.id}`)}>💬 Chat</button>
          )}
        </div>
      )}

      {/* PANEL: User Feedback (Rating) */}
      {ratingId === booking.id && (
        <div className="premium-panel rating-panel">
          <div className="panel-header">⭐ Rate this service</div>
          <div className="star-selection">
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} onClick={() => setSelectedStar(star)}
                className={`star ${star <= selectedStar ? 'active' : ''}`}>★</span>
            ))}
          </div>
          <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
            placeholder="Write a review (optional)…" rows={2} className="premium-textarea" />
          <div className="panel-actions">
            <button className="btn-secondary" onClick={() => setRatingId(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => submitRating(booking.id)}>Submit Rating</button>
          </div>
        </div>
      )}

      {/* PANEL: Support Intervention (Dispute) */}
      {disputeId === booking.id && (
        <div className="premium-panel dispute-panel">
          <div className="panel-header error">🚨 Raise a Dispute</div>
          <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
            placeholder="Describe the issue in detail…" rows={3} className="premium-textarea" />
          <UserDisputePhotoUpload bookingId={booking.id} onUploaded={setUserDisputePhotos} />
          <div className="panel-actions">
            <button className="btn-secondary" onClick={() => setDisputeId(null)}>Cancel</button>
            <button className="btn-danger" onClick={() => submitDispute(booking.id)}>Submit Dispute</button>
          </div>
        </div>
      )}

      {invoiceBookingId === booking.id && (() => {
        const invoice = buildInvoiceData(booking);
        return (
          <div className="premium-panel invoice-panel">
            <div className="panel-header glass">
              <strong>Invoice {invoice.invoiceNo}</strong>
              <span className={`status-tag ${invoice.paymentStatus}`}>{invoice.paymentStatus}</span>
            </div>
            <div className="invoice-details">
              <div className="line-item"><span>Labor & Materials:</span> <span>₹{invoice.baseAmount}</span></div>
              <div className="line-item"><span>Platform Fee:</span> <span>₹{invoice.platformFee}</span></div>
              <div className="line-item"><span>Taxes:</span> <span>₹{invoice.taxes}</span></div>
              <div className="line-item discount"><span>Wallet Credit:</span> <span>-₹{invoice.walletCredit}</span></div>
              <div className="total-row"><span>Grand Total:</span> <span>₹{invoice.total}</span></div>
            </div>
            <div className="panel-actions">
              <button className="btn-primary" onClick={() => downloadInvoicePdf(booking)}>Download PDF</button>
              <button className="btn-secondary" onClick={() => setInvoiceBookingId(null)}>Close</button>
            </div>
          </div>
        );
      })()}
    </div>
    );
  };

  return (
    <div className="my-bookings-container">
      <header className="page-header">
        <h2 className="premium-title">My Bookings</h2>
        <p className="page-subtitle">Track requests, compare quotes, and manage service progress in one place.</p>
      </header>

      <div className="search-filter-section">
        <div className="search-input-wrapper">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by service, status, location..."
            className="premium-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="premium-select"
        >
          <option value="all">All Status</option>
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

      {!user ? (
        <div className="alert-message warning center">Please login to view your bookings.</div>
      ) : (
        <main className="bookings-content">
          {readError && <div className="alert-message error">{readError}</div>}

          <section className="booking-section">
            <h3 className="section-title">Active Bookings ({active.length})</h3>
            {active.length === 0 ? (
              <div className="empty-state">No active bookings found.</div>
            ) : (
              <div className="bookings-grid">
                {active.map(b => <BookingCard key={b.id} booking={b} isActive={true} />)}
              </div>
            )}
          </section>

          <section className="booking-section">
            <h3 className="section-title">Completed ({completed.length})</h3>
            {completed.length === 0 ? (
              <div className="empty-state">No completed bookings yet.</div>
            ) : (
              <div className="bookings-grid">
                {completed.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)}
              </div>
            )}
          </section>

          {cancelled.length > 0 && (
            <section className="booking-section">
              <h3 className="section-title">Cancelled ({cancelled.length})</h3>
              <div className="bookings-grid">
                {cancelled.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)}
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
