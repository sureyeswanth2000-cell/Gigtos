const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

// Email transporter (set via firebase functions:config:set gmail.user="..." gmail.pass="...")
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().gmail?.user,
    pass: functions.config().gmail?.pass,
  },
});

function sendEmail(to, subject, text) {
  if (!functions.config().gmail?.user || !to) return Promise.resolve();
  return transporter
    .sendMail({ from: functions.config().gmail?.user, to, subject, text })
    .catch(err => console.error('Email error:', err));
}

function sendSms(phone, message) {
  const { sid, token, phone: twilioPhone } = functions.config().twilio || {};
  if (sid && token && twilioPhone) {
    return require('twilio')(sid, token)
      .messages.create({ body: message, from: twilioPhone, to: phone })
      .catch(err => console.error('SMS error:', err));
  }
  console.log('[SMS to', phone, ']', message);
  return Promise.resolve();
}

/**
 * Log an activity entry to the activity_logs collection.
 */
async function logActivity(bookingId, action, actorRole, extra = {}) {
  try {
    await db.collection('activity_logs').add({
      bookingId,
      actorRole,
      action,
      ...extra,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('Failed to log activity:', e);
  }
}

/* ──────────────────────────────────────────────────
   TRIGGER 1: New booking created
────────────────────────────────────────────────── */
exports.onBookingCreated = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.data();
    const bookingId = context.params.bookingId;

    const userMsg = `Your ${booking.serviceType} booking has been received and is pending confirmation. Booking ID: ${bookingId}`;
    await sendEmail(booking.email, 'Booking Received – Gigto', userMsg);
    await sendSms(booking.phone, userMsg);

    if (booking.workerPhone) {
      const workerMsg = `New ${booking.serviceType} booking from ${booking.customerName}. Please await assignment.`;
      await sendSms(booking.workerPhone, workerMsg);
    }

    // Log activity
    await logActivity(bookingId, 'booking_created', 'system');

    return null;
  });

/* ──────────────────────────────────────────────────
   TRIGGER 2: Booking status changed
────────────────────────────────────────────────── */
exports.onBookingStatusChange = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const bookingId = context.params.bookingId;

    // Status change notification
    if (before.status !== after.status) {
      const msg = `Your ${after.serviceType} booking status changed: ${before.status} → ${after.status}. Booking ID: ${bookingId}`;
      await sendEmail(after.email, 'Booking Status Updated – Gigto', msg);
      await sendSms(after.phone, msg);

      // Log to activity_logs
      await logActivity(bookingId, 'status_changed', 'system', {
        fromStatus: before.status,
        toStatus: after.status,
      });
    }

    // Dispute opened
    if (!before.dispute && after.dispute?.status === 'open') {
      console.log(`[Dispute] Booking ${bookingId}: ${after.dispute.reason}`);
      await logActivity(bookingId, 'dispute_raised', 'system', {
        reason: after.dispute.reason,
      });
    }

    // Dispute resolved
    if (before.dispute?.status === 'open' && after.dispute?.status === 'resolved') {
      await logActivity(bookingId, 'dispute_resolved', 'system');
    }

    // Rating submitted
    if (!before.rating && after.rating) {
      await logActivity(bookingId, 'rating_submitted', 'system', { rating: after.rating });
    }

    // Commission calculation on completion
    // The visiting charge is ₹150, split as: ₹80 worker, ₹20 local admin, ₹50 Gigto
    if (before.status !== 'completed' && after.status === 'completed') {
      const commissionData = {
        totalVisitingCharge: 150,
        workerShare: 80,
        localAdminShare: 20,
        gigtoShare: 50,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Update the booking document with commission details
      await change.after.ref.update({
        commissions: commissionData,
        isCommissionProcessed: true
      });

      // Log the commission event for auditing
      await logActivity(bookingId, 'commission_processed', 'system', {
        split: `Worker:₹80, Local:₹20, Gigto:₹50`
      });
    }

    return null;
  });
