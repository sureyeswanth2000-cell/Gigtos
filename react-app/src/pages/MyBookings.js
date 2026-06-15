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
  collection, query, where, onSnapshot
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import TrackingMap from '../components/TrackingMap';
import UserDisputePhotoUpload from '../components/UserDisputePhotoUpload';
import { useToast } from '../context/ToastContext';
import { formatPayoutHoldDuration, normalizePayoutHoldMinutes } from '../config/pricingSettings';
import { usePricingSettings } from '../utils/usePricingSettings';
import './MyBookings.css';

// UI CONFIG: Color mapping for visual differentiation of booking states
const statusColors = {
  'pending': 'var(--warning)',           // Awaiting worker assignment
  'matching': 'var(--primary-purple)',   // Smart Queue finding worker
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
  'matching': 'Finding Worker',
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

function fieldToDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getConsumerPaymentHoldInfo(booking, payoutHoldMinutesValue, nowMs = Date.now()) {
  if (booking?.status !== 'completed') return { visible: false };
  const disputeStatus = (booking?.dispute?.status || '').toString().toLowerCase();
  if (['open', 'pending', 'escalated'].includes(disputeStatus)) {
    return {
      visible: true,
      state: 'dispute',
      title: 'Payment held for dispute review',
      message: 'Your payment remains protected while support reviews the dispute.',
    };
  }
  if (['released', 'refunded'].includes((booking?.escrowStatus || '').toString().toLowerCase())) {
    return { visible: false };
  }

  const payoutHoldMinutes = normalizePayoutHoldMinutes(booking?.workerPayoutHoldMinutes ?? payoutHoldMinutesValue);
  const completedAt = fieldToDate(booking?.completedAt) || fieldToDate(booking?.statusUpdatedAt) || fieldToDate(booking?.updatedAt);
  const configuredEligibleAt = fieldToDate(booking?.workerPayoutEligibleAt);
  const holdUntil = configuredEligibleAt || (completedAt ? new Date(completedAt.getTime() + payoutHoldMinutes * 60 * 1000) : null);
  if (!holdUntil) return { visible: false };

  const remainingMs = holdUntil.getTime() - nowMs;
  if (remainingMs <= 0) {
    return {
      visible: true,
      state: 'ready',
      title: 'Payment hold window closed',
      message: 'No dispute is open. Worker payout can now move through payout checks.',
      holdUntil,
    };
  }

  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  const remainingLabel = remainingMinutes >= 60
    ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`
    : `${remainingMinutes}m`;
  return {
    visible: true,
    state: 'held',
    title: 'Payment on hold',
    message: `Payment stays protected for ${formatPayoutHoldDuration(payoutHoldMinutes)} after completion. Worker payout opens in ${remainingLabel} if no dispute is raised.`,
    holdUntil,
  };
}

export default function MyBookings() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const pricingSettings = usePricingSettings();
  const [nowMs, setNowMs] = useState(Date.now());
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [assignmentStates, setAssignmentStates] = useState({});
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
  const [recoveryActionId, setRecoveryActionId] = useState(null);
  const [userDisputePhotos, setUserDisputePhotos] = useState([]);

  /* ── Auth Listener ── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'booking_assignment_states'), where('userId', '==', user.uid));
    const unsub = onSnapshot(q, snap => {
      const states = {};
      snap.docs.forEach(d => {
        const item = { id: d.id, ...d.data() };
        states[item.bookingId || d.id] = item;
      });
      setAssignmentStates(states);
    }, () => {
      setAssignmentStates({});
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

  const callBackend = async (method, data) => {
    try {
      const func = httpsCallable(functionsInstance, method);
      await func(data);
    } catch (e) {
      addToast('Action failed: ' + e.message, 'error');
      throw e;
    }
  };

  const fmt = ts => {
    if (!ts) return 'N/A';
    const ms = ts.seconds ? ts.seconds * 1000 : ts;
    return new Date(ms).toLocaleString();
  };

  const buildInvoiceData = (booking) => {
    const pricing = booking?.acceptedQuote?.pricing || {};
    const baseAmount = Number(pricing.baseAmount || booking?.acceptedQuote?.price || booking?.fixedRate || booking?.quoteAmount || 1200);
    const platformFee = Number(pricing.platformFee || booking?.platformFee || 0);
    const gatewayFee = Number(pricing.paymentCharge || booking?.paymentGatewayFee || 0);
    const taxes = Number(pricing.taxes || 0);
    const walletCredit = Number((cashbacks.find(c => c.bookingId === booking.id)?.cashbackAmount) || 0);
    const total = Math.max(Number(pricing.finalTotal || booking?.finalTotal || booking?.acceptedQuote?.finalPrice || (baseAmount + platformFee + gatewayFee + taxes)) - walletCredit, 0);
    return {
      invoiceNo: `INV-${booking.id.slice(0, 8).toUpperCase()}`,
      baseAmount,
      platformFee,
      gatewayFee,
      taxes,
      walletCredit,
      total,
      paymentStatus: derivePaymentStatus(booking),
    };
  };

  const derivePaymentStatus = (booking) => {
    const holdInfo = getConsumerPaymentHoldInfo(booking, pricingSettings.payoutHoldMinutes, nowMs);
    if (holdInfo.state === 'dispute') return 'held_for_dispute';
    if (holdInfo.state === 'held') return 'held';
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
      pdf.text(`Payment Gateway Fee: Rs. ${invoice.gatewayFee}`, startX, y);
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
      addToast('Unable to generate PDF right now.', 'error');
    }
  };

  async function cancelBooking(id) {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_cancelled' });
      addToast('Booking cancelled.', 'success');
    } catch (e) {
      addToast(e?.message || 'Could not cancel booking. Please try again.', 'error');
    }
  }

  async function confirmCompletion(id) {
    if (!window.confirm('Confirm job is done?')) return;
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_confirm_completion' });
      addToast('Service confirmed complete!', 'success');
    } catch (e) {
      addToast(e?.message || 'Could not confirm completion. Please try again.', 'error');
    }
  }

  async function verifyWorkerIdentity(booking, decision) {
    const note = decision === 'wrong_worker'
      ? window.prompt('What looks wrong? This opens a support review.', 'Worker face/profile does not match.')
      : '';
    if (decision === 'wrong_worker' && !note) return;
    try {
      await callBackend('updateBookingStatus', {
        bookingId: booking.id,
        action: 'user_verify_worker_identity',
        extraArgs: { decision, note: note || '' },
      });
      addToast(
        decision === 'wrong_worker'
          ? 'Support review opened. Do not confirm completion until resolved.'
          : 'Worker check saved.',
        decision === 'wrong_worker' ? 'warning' : 'success'
      );
    } catch (e) {
      addToast(e?.message || 'Could not save worker check. Please try again.', 'error');
    }
  }

  async function saveEdit(id) {
    setUpdating(true);
    try {
      await callBackend('updateBookingStatus', {
        bookingId: id,
        action: 'user_update_contact',
        extraArgs: {
          address: editData.address,
          phone: editData.phone,
        },
      });
      setEditingId(null);
      setEditData({});
    } catch (e) {
      addToast('Failed: ' + e.message, 'error');
    } finally {
      setUpdating(false);
    }
  }

  async function submitRating(id) {
    if (!selectedStar) { addToast('Please select a star rating', 'warning'); return; }
    try {
      await callBackend('updateBookingStatus', { bookingId: id, action: 'user_rate', extraArgs: { rating: selectedStar, reviewText: reviewText.trim() } });
      setRatingId(null);
      setReviewText('');
      setSelectedStar(0);
      if (selectedStar === 1) {
        addToast('A dispute has been automatically raised due to your 1-star rating.', 'warning', 5000);
      } else {
        addToast('Thank you for your rating!', 'success');
      }
    } catch (e) {
      addToast(e?.message || 'Could not submit rating. Please try again.', 'error');
    }
  }

  async function submitDispute(id) {
    if (!disputeReason.trim()) { addToast('Please describe the issue', 'warning'); return; }
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
      addToast('Dispute submitted. Admin will review shortly.', 'success');
    } catch (e) {
      addToast(e?.message || 'Could not submit dispute. Please try again.', 'error');
    }
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
      addToast('Quote accepted!', 'success');
    } catch (e) {
      addToast(e?.message || 'Could not accept quote. Please try again.', 'error');
    }
  }

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    const text = searchTerm.trim().toLowerCase();
    if (!text) return true;
    return [b.id, b.serviceType, b.status, b.address, b.assignedWorker, b.workerName]
      .some((v) => (v || '').toString().toLowerCase().includes(text));
  });

  const active = filteredBookings.filter(b => ['pending', 'matching', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status));
  const completed = filteredBookings.filter(b => b.status === 'completed');
  const cancelled = filteredBookings.filter(b => b.status === 'cancelled');

  const recordNoWorkerRecoveryChoice = async (booking, action) => {
    let scheduledDate = '';
    let timeSlot = '';
    if (action === 'book_later') {
      scheduledDate = window.prompt('Which date should we try again? Use YYYY-MM-DD.', new Date(Date.now() + 86400000).toISOString().slice(0, 10)) || '';
      if (!scheduledDate) return;
      timeSlot = window.prompt('Preferred time slot?', 'Morning 9 AM - 12 PM') || '';
      if (!timeSlot) return;
    }
    if (action === 'expand_radius' && !window.confirm('Search nearby areas up to 15 km? Same-area workers still stay first priority.')) return;
    setRecoveryActionId(`${booking.id}_${action}`);
    try {
      const result = await httpsCallable(functionsInstance, 'recordNoWorkerRecoveryChoice')({
        bookingId: booking.id,
        action,
        scheduledDate,
        timeSlot,
      });
      addToast(result.data?.safeConsumerMessage || 'Recovery preference saved.', 'success');
    } catch (err) {
      addToast(err.message || 'Could not save recovery preference.', 'error');
    } finally {
      setRecoveryActionId(null);
    }
  };

  const getQueueStateTitle = (status) => {
    if (status === 'offered') return 'Offer sent to worker';
    if (status === 'no_worker') return 'No worker available now';
    if (status === 'quote_expired') return 'Price lock expired';
    if (status === 'notify_me') return 'Notification request saved';
    if (status === 'book_later') return 'Booked for later matching';
    if (status === 'radius_requested') return 'Nearby-area search requested';
    return 'Finding verified worker';
  };

  const getQueueStateMessage = (assignment) => {
    const status = assignment?.status;
    if (assignment?.safeConsumerMessage) return assignment.safeConsumerMessage;
    if (status === 'no_worker') {
      return 'All eligible same-area workers were checked. You can wait for an alert, book a later slot, or search nearby verified workers up to 15 km.';
    }
    if (status === 'quote_expired') {
      return 'The locked price window ended before a worker accepted. Review the booking again to get a fresh backend price.';
    }
    if (status === 'notify_me') {
      return 'We saved this demand signal and will alert you when an eligible worker opens nearby.';
    }
    if (status === 'book_later') {
      return 'Your later matching request is saved. Smart Queue will use the scheduled time window.';
    }
    if (status === 'radius_requested') {
      return 'Smart Queue is checking nearby verified workers while still preferring closer matches.';
    }
    if (status === 'offered') {
      return 'A verified worker is reviewing the job offer. If there is no response, Smart Queue will continue.';
    }
    return 'Smart Queue is checking open verified workers for this area.';
  };

  const BookingCard = ({ booking, isActive }) => {
    // Try to extract lat/lng from booking.address or booking fields
    let consumerLat = booking.lat, consumerLng = booking.lng;
    const holdInfo = getConsumerPaymentHoldInfo(booking, pricingSettings.payoutHoldMinutes, nowMs);
    const assignment = assignmentStates[booking.id];
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

      {holdInfo.visible && (
        <div className={`payment-hold-panel ${holdInfo.state}`}>
          <div>
            <strong>{holdInfo.title}</strong>
            <span>{holdInfo.message}</span>
          </div>
          {holdInfo.holdUntil && (
            <small>Until {holdInfo.holdUntil.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          )}
        </div>
      )}

      {assignment && ['searching', 'offered', 'no_worker', 'quote_expired', 'notify_me', 'book_later', 'radius_requested'].includes(assignment.status) && (
        <div className={`queue-state-panel ${assignment.status}`}>
          <div>
            <strong>{getQueueStateTitle(assignment.status)}</strong>
            <span>{getQueueStateMessage(assignment)}</span>
          </div>
          {assignment.expiresAt && (
            <small>Queue window until {fieldToDate(assignment.expiresAt)?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</small>
          )}
          {assignment.status === 'no_worker' && (
            <div className="queue-recovery-wrap">
              <div className="queue-recovery-actions" aria-label="No worker recovery actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(recoveryActionId)}
                  onClick={() => recordNoWorkerRecoveryChoice(booking, 'notify_me')}
                >
                  Notify Me
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(recoveryActionId)}
                  onClick={() => recordNoWorkerRecoveryChoice(booking, 'book_later')}
                >
                  Book Later
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={Boolean(recoveryActionId)}
                  onClick={() => recordNoWorkerRecoveryChoice(booking, 'expand_radius')}
                >
                  Search Nearby
                </button>
              </div>
              <small className="queue-recovery-copy">
                Notify keeps the same price intent, Book Later waits for a better slot, Search Nearby expands matching while keeping verified-worker rules.
              </small>
            </div>
          )}
        </div>
      )}

      {/* Dispute alerts hidden as per new workflow */}

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

          {booking.arrivalSelfiePhoto && ['in_progress', 'awaiting_confirmation'].includes(booking.status) && (
            <div className={`identity-check-panel ${booking.workerIdentityCheckStatus || 'waiting_consumer_check'}`}>
              <div>
                <strong>Check arriving worker</strong>
                <span>Confirm the selfie matches the worker at your location.</span>
              </div>
              <a href={booking.arrivalSelfiePhoto} target="_blank" rel="noreferrer">
                <img src={booking.arrivalSelfiePhoto} alt="Arrival worker selfie" />
              </a>
              {booking.workerIdentityCheckStatus === 'waiting_consumer_check' ? (
                <div className="identity-actions">
                  <button className="btn-primary" onClick={() => verifyWorkerIdentity(booking, 'correct')}>Correct worker</button>
                  <button className="btn-danger" onClick={() => verifyWorkerIdentity(booking, 'wrong_worker')}>Wrong worker</button>
                  <button className="btn-secondary" onClick={() => verifyWorkerIdentity(booking, 'skipped')}>Skip</button>
                </div>
              ) : (
                <small>Status: {String(booking.workerIdentityCheckStatus).replace(/_/g, ' ')}</small>
              )}
            </div>
          )}

          {(booking.beforePhotos?.length > 0 || booking.afterPhotos?.length > 0) && (
            <div className="evidence-grid">
              <span className="grid-label">Proof Photos:</span>
              {booking.beforePhotos?.length > 0 && (
                <div className="photo-list">
                  {booking.beforePhotos.map((url, i) => (
                    <a key={`before-${i}`} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="Before work proof" />
                    </a>
                  ))}
                </div>
              )}
              {booking.afterPhotos?.length > 0 && (
                <div className="photo-list">
                  {booking.afterPhotos.map((url, i) => (
                    <a key={`after-${i}`} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="After work proof" />
                    </a>
                  ))}
                </div>
              )}
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

      {/* Dispute panel hidden as per new workflow. Dispute is only auto-raised on 1-star rating. */}

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
              <div className="line-item"><span>Payment Gateway Fee:</span> <span>₹{invoice.gatewayFee}</span></div>
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
        <div>
          <h2 className="premium-title">My Bookings</h2>
          <p className="page-subtitle">Track requests, compare quotes, and manage service progress in one place.</p>
        </div>
        <button className="quick-book-btn" onClick={() => navigate('/services')}>Book a service</button>
      </header>

      <div className="booking-command-grid" aria-label="Booking summary">
        <button onClick={() => setStatusFilter('all')}>
          <strong>{bookings.length}</strong>
          <span>Total</span>
        </button>
        <button onClick={() => setStatusFilter('in_progress')}>
          <strong>{bookings.filter(b => ['assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status)).length}</strong>
          <span>Live</span>
        </button>
        <button onClick={() => setStatusFilter('quoted')}>
          <strong>{bookings.filter(b => b.status === 'quoted').length}</strong>
          <span>Quotes</span>
        </button>
        <button onClick={() => setStatusFilter('completed')}>
          <strong>{bookings.filter(b => b.status === 'completed').length}</strong>
          <span>Done</span>
        </button>
      </div>

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
          <option value="matching">Finding Worker</option>
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
