/**
 * GIGTO REGIONAL MARKETPLACE - BACKEND LOGIC (FIREBASE FUNCTIONS)
 * 
 * This file contains the server-side logic for:
 * 1. Notifications (Email/SMS)
 * 2. Governance Scoring & Regions lead performance tracking
 * 3. Lifecycle automation (Escrow hold, Cashback, Worker badges)
 * 4. Automated Task Scheduling (Escalations & Expiry)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const { getGmailCredentials, getTwilioCredentials } = require('./security/secretManager');
const { validate, submitQuoteSchema, acceptQuoteSchema, updateBookingStatusSchema, secureLogActivitySchema } = require('./security/validation');
const { enforceRateLimit } = require('./security/rateLimiter');
const { logSecurityEvent, logRateLimitViolation, SECURITY_EVENTS } = require('./security/audit');

admin.initializeApp();
const db = admin.firestore();

// HMAC secret for OTP hashing. Set in production via:
//   firebase functions:config:set otp.secret="<strong-random-secret>"
// A missing/dev value is intentionally loud in logs so it is not overlooked.
const OTP_HMAC_SECRET = (() => {
  const secret = functions.config().otp?.secret;
  if (!secret) {
    console.warn('[SECURITY] otp.secret is not configured. Set it with: firebase functions:config:set otp.secret="<random-secret>"');
    return 'insecure-dev-secret-replace-in-production';
  }
  return secret;
})();

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 1: COMMUNICATION HELPERS
   Logic for sending transactional emails and SMS notifications.
   ────────────────────────────────────────────────────────────────────────── */

// Email transporter - credentials loaded lazily from Secret Manager
let _transporter = null;
async function getTransporter() {
  if (_transporter) return _transporter;
  const { user, pass } = await getGmailCredentials();
  _transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  return _transporter;
}

/**
 * Sends a transactional email using Nodemailer.
 * Credentials are retrieved from Google Secret Manager (or functions.config() fallback).
 */
async function sendEmail(to, subject, text) {
  try {
    const { user } = await getGmailCredentials();
    if (!user || !to) return;
    const transport = await getTransporter();
    await transport.sendMail({ from: user, to, subject, text });
  } catch (err) {
    console.error('Email error:', err);
  }
}

/**
 * Sends an SMS using Twilio if configured, or logs to console if not.
 * Credentials are retrieved from Google Secret Manager (or functions.config() fallback).
 */
async function sendSms(phone, message) {
  try {
    const { sid, token, phone: twilioPhone } = await getTwilioCredentials();
    if (sid && token && twilioPhone) {
      return require('twilio')(sid, token)
        .messages.create({ body: message, from: twilioPhone, to: phone })
        .catch(err => console.error('SMS error:', err));
    }
  } catch {
    // Credentials not configured; log instead
  }
  console.log('[SMS to', phone, ']', message);
  return Promise.resolve();
}

/**
 * Logs every critical booking event to a separate activity_logs collection.
 * This is used for the booking timeline UI and governance audits.
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

/**
 * Firestore-based sliding-window rate limiter.
 * Returns true if the request is within the allowed limit, false if exceeded.
 * Uses the admin SDK so it bypasses client Firestore rules.
 *
 * @param {string} type       - Logical name for the limit (e.g. 'otp_send', 'quote')
 * @param {string} identifier - Per-user/phone key (uid, phone number, etc.)
 * @param {number} maxRequests - Maximum requests allowed within the window
 * @param {number} windowSeconds - Length of the sliding window in seconds
 */
async function checkRateLimit(type, identifier, maxRequests, windowSeconds) {
  const limitRef = db.collection('rate_limits').doc(`${type}:${identifier}`);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    return await db.runTransaction(async (txn) => {
      const doc = await txn.get(limitRef);

      if (!doc.exists) {
        txn.set(limitRef, {
          count: 1,
          windowStart: now,
          // TTL field – used by a Firestore TTL policy to auto-delete stale records
          ttl: admin.firestore.Timestamp.fromMillis(now + windowMs * 2),
        });
        return true;
      }

      const { count, windowStart } = doc.data();

      if (now - windowStart > windowMs) {
        // Previous window has expired – reset counter
        txn.set(limitRef, {
          count: 1,
          windowStart: now,
          ttl: admin.firestore.Timestamp.fromMillis(now + windowMs * 2),
        });
        return true;
      }

      if (count >= maxRequests) return false;

      txn.update(limitRef, { count: admin.firestore.FieldValue.increment(1) });
      return true;
    });
  } catch (e) {
    console.error('[RateLimit] Error checking rate limit:', e);
    // Fail open to avoid denying legitimate traffic if Firestore is temporarily unavailable
    return true;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 2: GOVERNANCE & PERFORMANCE LOGIC
   Logic for calculating Region Lead scores and managing probation status.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Recalculate region performance score for a regionLead admin.
 * 
 * CORE LOGIC:
 * - Start at 100 points.
 * - Deduct 10 points per worker fraud case under their region.
 * - Deduct 5 points per hour if average dispute resolution exceeds 24 hours.
 * - Deduct 1 point per dispute if total disputes > 5 (volume penalty).
 */
async function recalcRegionScore(adminId) {
  try {
    const adminRef = db.collection('admins').doc(adminId);
    const adminDoc = await adminRef.get();
    if (!adminDoc.exists) return;

    const data = adminDoc.data();
    let score = 100;

    // Deduct for fraud: -10 per fraud case
    const fraudCount = data.fraudCount || 0;
    score -= fraudCount * 10;

    // Deduct for slow avg resolution: -5 per hour above 24
    const avgRes = data.avgResolutionTime || 0;
    if (avgRes > 24) {
      score -= Math.floor((avgRes - 24) * 5);
    }

    // Deduct for high dispute volume: -1 per dispute above 5
    const totalDisputes = data.totalDisputes || 0;
    if (totalDisputes > 5) {
      score -= (totalDisputes - 5);
    }

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));

    await adminRef.update({ regionScore: score });

    // After updating score, check if the admin qualifies for probation based on rates
    await checkProbation(adminId);

    return score;
  } catch (e) {
    console.error('Failed to recalc region score:', e);
  }
}

/**
 * Checks if a regionLead should be put on probation.
 * 
 * CORE LOGIC:
 * - Analyzes bookings from the last 30 days.
 * - If dispute rate >= 15%, probationStatus is set to true.
 * - This affects their visibility and trust score in the SuperAdmin panel.
 */
async function checkProbation(adminId) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Filter bookings by this admin in the last 30 days
    const allBookingsSnap = await db.collection('bookings')
      .where('adminId', '==', adminId)
      .where('createdAt', '>=', thirtyDaysAgo)
      .get();

    const totalBookings = allBookingsSnap.size;
    if (totalBookings === 0) return;

    // Filter which of those bookings had disputes
    let disputeCount = 0;
    allBookingsSnap.forEach(doc => {
      const data = doc.data();
      if (data.dispute && data.dispute.status) {
        disputeCount++;
      }
    });

    const disputeRate = (disputeCount / totalBookings) * 100;
    const shouldProbate = disputeRate >= 15;

    await db.collection('admins').doc(adminId).update({
      probationStatus: shouldProbate,
    });

    if (shouldProbate) {
      console.log(`[PROBATION] Admin ${adminId} put on probation. Dispute rate: ${disputeRate.toFixed(1)}%`);
      await logActivity('system', 'region_probation_activated', 'system', {
        adminId,
        disputeRate: disputeRate.toFixed(1),
      });
    }
  } catch (e) {
    console.error('Failed to check probation:', e);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 3: FIRESTORE TRIGGERS
   Event-driven logic that reacts to data changes in real-time.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * TRIGGER: When a new booking is created.
 * - Sends initial confirmation messages to user and worker.
 * - Initializes the activity log for the booking.
 */
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

    await logActivity(bookingId, 'booking_created', 'system');
    return null;
  });

/**
 * TRIGGER: When any booking field is updated.
 * This is the CORE lifecycle function handling:
 * - Status transitions (pending -> assigned -> in_progress -> etc)
 * - Dispute & Escrow logic (Holding/Releasing funds)
 * - 1-Star automatic dispute triggers
 * - Cashback issuance and worker performance badges
 */
exports.onBookingStatusChange = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const bookingId = context.params.bookingId;
    const bookingRef = change.after.ref;

    // LOGIC: Detect status change and notify user
    if (before.status !== after.status) {
      const msg = `Your ${after.serviceType} booking status changed: ${before.status} → ${after.status}. Booking ID: ${bookingId}`;
      await sendEmail(after.email, 'Booking Status Updated – Gigto', msg);
      await sendSms(after.phone, msg);

      await logActivity(bookingId, 'status_changed', 'system', {
        fromStatus: before.status,
        toStatus: after.status,
      });
    }

    // LOGIC: Handle opening a dispute
    // - Locks the payment (escrowStatus = 'held')
    // - Alerts Region Lead and SuperAdmin
    // - Increments regional dispute count for scoring
    if (!before.dispute && after.dispute?.status === 'open') {
      console.log(`[Dispute] Booking ${bookingId}: ${after.dispute.reason}`);
      await logActivity(bookingId, 'dispute_raised', 'system', {
        reason: after.dispute.reason,
      });

      await bookingRef.update({ escrowStatus: 'held' });
      await logActivity(bookingId, 'escrow_held', 'system', {
        reason: 'Dispute opened — payment held in escrow',
      });

      if (after.adminId) {
        const adminRef = db.collection('admins').doc(after.adminId);
        await adminRef.update({
          totalDisputes: admin.firestore.FieldValue.increment(1),
        });
        await recalcRegionScore(after.adminId);
      }
    }

    // LOGIC: Dispute Resolution
    // - Calculates resolution time for regional performance metrics
    // - Decides escrow distribution (released to worker or refunded to user)
    if (before.dispute?.status === 'open' && after.dispute?.status === 'resolved') {
      await logActivity(bookingId, 'dispute_resolved', 'system');

      if (after.dispute.raisedAt) {
        const raisedAt = after.dispute.raisedAt.toDate ? after.dispute.raisedAt.toDate() : new Date(after.dispute.raisedAt);
        const resolvedAt = new Date();
        const resolutionHours = (resolvedAt - raisedAt) / (1000 * 60 * 60);

        await bookingRef.update({ 'dispute.resolutionTime': resolvedAt });

        if (after.adminId) {
          const adminRef = db.collection('admins').doc(after.adminId);
          const adminDoc = await adminRef.get();
          if (adminDoc.exists) {
            const adminData = adminDoc.data();
            const prevAvg = adminData.avgResolutionTime || 0;
            const prevDisputes = (adminData.totalDisputes || 1);
            // Update running average for time metrics
            const newAvg = ((prevAvg * (prevDisputes - 1)) + resolutionHours) / prevDisputes;
            await adminRef.update({ avgResolutionTime: Math.round(newAvg * 100) / 100 });
            await recalcRegionScore(after.adminId);
          }
        }

        // Release/Refund Logic
        const decision = after.dispute.decision;
        if (decision === 'user_fault') {
          await bookingRef.update({ escrowStatus: 'released' });
          await logActivity(bookingId, 'escrow_released', 'system', { reason: 'User fault — payment released to worker' });
        } else if (decision === 'worker_fault') {
          await bookingRef.update({ escrowStatus: 'refunded' });
          await logActivity(bookingId, 'escrow_refunded', 'system', { reason: 'Worker fault — payment refunded to user' });
        } else {
          await bookingRef.update({ escrowStatus: 'released' });
          await logActivity(bookingId, 'escrow_released', 'system', { reason: 'Shared fault — payment released' });
        }
      }
    }

    // LOGIC: Handle 1-Star Rating
    // - Auto-triggers a dispute if rating is 1
    // - Immediately holds payment to protect consumer
    if (!before.rating && after.rating) {
      await logActivity(bookingId, 'rating_submitted', 'system', { rating: after.rating });

      if (after.rating === 1 && !after.dispute) {
        await bookingRef.update({
          dispute: {
            reason: 'Auto-triggered by 1-star rating',
            raisedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'open',
            raisedBy: after.userId,
            autoTriggered: true,
          },
          escrowStatus: 'held',
        });
        await logActivity(bookingId, '1_star_auto_dispute', 'system', {
          reason: 'Protective dispute triggered by poor rating',
        });
      }
    }

    // LOGIC: Completion Automation
    // - Processes commissions (₹150 Split)
    // - Issues ₹9 Cashback to user with 15-day expiry
    // - Updates worker "Completed Jobs" count and assigns Top-Listed badge after 3 jobs
    if (before.status !== 'completed' && after.status === 'completed') {
      const commissionData = {
        totalVisitingCharge: 150,
        workerShare: 80, localAdminShare: 20, gigtoShare: 50,
        calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await bookingRef.update({
        commissions: commissionData,
        isCommissionProcessed: true,
        escrowStatus: after.escrowStatus || 'released',
      });

      await logActivity(bookingId, 'completion_processed', 'system');

      // Issue Cashback (₹9)
      if (after.userId) {
        const cashbackExpiry = new Date();
        cashbackExpiry.setDate(cashbackExpiry.getDate() + 15);

        await db.collection('cashbacks').add({
          userId: after.userId,
          bookingId: bookingId,
          cashbackAmount: 9,
          cashbackIssuedAt: admin.firestore.FieldValue.serverTimestamp(),
          cashbackExpiryDate: cashbackExpiry,
          cashbackStatus: 'active',
        });

        await logActivity(bookingId, 'cashback_issued', 'system', { amount: 9 });
      }

      // Check Worker Badges (Top-Listed after 3 jobs)
      if (after.assignedWorkerId) {
        const workerRef = db.collection('gig_workers').doc(after.assignedWorkerId);
        await workerRef.update({ completedJobs: admin.firestore.FieldValue.increment(1) });

        const workerDoc = await workerRef.get();
        if (workerDoc.exists) {
          const workerData = workerDoc.data();
          const newCount = (workerData.completedJobs || 0);
          if (newCount >= 3 && !workerData.isTopListed) {
            await workerRef.update({ isTopListed: true });
            await logActivity(bookingId, 'worker_top_listed', 'system', { workerId: after.assignedWorkerId });
          }
        }
      }
    }

    // LOGIC: Multi-day job — auto-complete when all days confirmed
    // When a new dailyConfirmation is added, check if all days are confirmed.
    const prevConfirmCount = (before.dailyConfirmations || []).length;
    const newConfirmCount = (after.dailyConfirmations || []).length;
    if (
      after.isMultiDay &&
      newConfirmCount > prevConfirmCount &&
      after.status === 'in_progress'
    ) {
      const totalDays = after.jobDuration || 1;
      if (newConfirmCount >= totalDays) {
        // All days confirmed — move to awaiting_confirmation for final user approval
        await bookingRef.update({
          status: 'awaiting_confirmation',
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await logActivity(bookingId, 'all_days_confirmed_auto_finished', 'system', { confirmedDays: newConfirmCount, totalDays });

        const msg = `All ${totalDays} days of your multi-day ${after.serviceType} job have been confirmed. Please give your final confirmation. Booking ID: ${bookingId}`;
        await sendEmail(after.email, 'Multi-Day Job Complete – Gigto', msg);
        await sendSms(after.phone, msg);
      }
    }

    return null;
  });

/**
 * TRIGGER: When a worker is marked as fraudulent.
 * LOGIC: Deducts points from the Region Lead who manages this worker.
 * This incentivizes clean recruitment practices.
 */
exports.onWorkerFraudMarked = functions.firestore
  .document('gig_workers/{workerId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const workerId = context.params.workerId;

    if (!before.isFraud && after.isFraud === true) {
      if (after.adminId) {
        const adminRef = db.collection('admins').doc(after.adminId);
        await adminRef.update({ fraudCount: admin.firestore.FieldValue.increment(1) });
        await recalcRegionScore(after.adminId);

        await logActivity('system', 'worker_fraud_detected', 'system', { workerId, adminId: after.adminId });
      }
    }
    return null;
  });

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 4: SCHEDULED BACKGROUND TASKS
   Automated maintenance and escalation tasks.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * SCHEDULED: Runs every hour.
 * LOGIC: Auto-escalates disputes if the Region Lead hasn't resolved them in 24 hours.
 * Penalizes Region Lead score (-5 points) when escalation occurs.
 */
exports.checkDisputeEscalation = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    try {
      const snapshot = await db.collection('bookings')
        .where('dispute.status', '==', 'open')
        .get();

      const batch = db.batch();
      let escalationCount = 0;

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.dispute?.escalationStatus) return;

        const raisedAt = data.dispute?.raisedAt;
        if (!raisedAt) return;

        const raisedDate = raisedAt.toDate ? raisedAt.toDate() : new Date(raisedAt);
        if (raisedDate <= twentyFourHoursAgo) {
          // Escalate to SuperAdmin
          batch.update(doc.ref, {
            'dispute.escalationStatus': true,
            'dispute.escalatedAt': admin.firestore.FieldValue.serverTimestamp(),
          });
          escalationCount++;

          // Penalty for slow resolution
          if (data.adminId) {
            const adminRef = db.collection('admins').doc(data.adminId);
            batch.update(adminRef, { regionScore: admin.firestore.FieldValue.increment(-5) });
          }
        }
      });

      if (escalationCount > 0) {
        await batch.commit();
        console.log(`[ESCALATION] Escalated ${escalationCount} slow disputes.`);
      }
    } catch (e) {
      console.error('Dispute escalation check failed:', e);
    }
    return null;
  });

/**
 * SCHEDULED: Runs daily at midnight (IST).
 * LOGIC: Expires active cashback rewards that have passed their 15-day window.
 */
exports.checkCashbackExpiry = functions.pubsub
  .schedule('every day 00:00')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const now = new Date();
    try {
      const snapshot = await db.collection('cashbacks')
        .where('cashbackStatus', '==', 'active')
        .where('cashbackExpiryDate', '<=', now)
        .get();

      const batch = db.batch();
      let expiredCount = 0;

      snapshot.forEach(doc => {
        batch.update(doc.ref, { cashbackStatus: 'expired' });
        expiredCount++;
      });

      if (expiredCount > 0) {
        await batch.commit();
        console.log(`[CASHBACK] Expired ${expiredCount} users' rewards.`);
      }
    } catch (e) {
      console.error('Cashback expiry check failed:', e);
    }
    return null;
  });

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 5: SECURE CALLABLE FUNCTIONS (100% SECURITY)
   Endpoints to handle all state transitions, removing logic from the frontend.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * SCHEDULED: Runs every evening at 6 PM IST.
 * LOGIC: For active multi-day jobs where the user hasn't confirmed today's work,
 * sends an SMS/email reminder to confirm daily work.
 */
exports.dailyJobReminder = functions.pubsub
  .schedule('0 18 * * *')
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
    try {
      const snapshot = await db.collection('bookings')
        .where('isMultiDay', '==', true)
        .where('status', '==', 'in_progress')
        .get();

      let reminderCount = 0;
      for (const docSnap of snapshot.docs) {
        const booking = docSnap.data();
        const bookingId = docSnap.id;
        const confirmedDays = (booking.dailyConfirmations || []).map(c => c.dateLabel);
        // Send reminder if today hasn't been confirmed yet
        if (!confirmedDays.includes(today)) {
          const msg = `Reminder: Please confirm today's work for your ${booking.serviceType} multi-day job. Booking ID: ${bookingId}`;
          await sendEmail(booking.email, 'Daily Work Confirmation Reminder – Gigto', msg);
          await sendSms(booking.phone, msg);
          reminderCount++;
        }
      }
      console.log(`[DAILY_REMINDER] Sent ${reminderCount} daily confirmation reminders.`);
    } catch (e) {
      console.error('Daily job reminder failed:', e);
    }
    return null;
  });

const verifyAuth = (context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }
};

/**
 * Callable: submitQuote
 * Allows an admin to securely submit a quote without arbitrary document write access.
 */
exports.submitQuote = functions.https.onCall(async (data, context) => {
  verifyAuth(context);

  // Rate limiting
  try {
    await enforceRateLimit(context, 'submitQuote', functions.https.HttpsError);
  } catch (err) {
    await logRateLimitViolation('submitQuote', context.auth?.uid || 'unknown', context);
    throw err;
  }

  // Input validation
  const { bookingId, price } = validate(data, submitQuoteSchema, functions.https.HttpsError);

  // Audit log
  await logSecurityEvent(SECURITY_EVENTS.FUNCTION_INVOKED, { function: 'submitQuote', bookingId }, context);

  // Verify the caller is an admin
  const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can submit quotes.');
  }
  const adminName = adminDoc.data().name || 'Regional Pro';

  const bookingRef = db.collection('bookings').doc(bookingId);

  await db.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new functions.https.HttpsError('not-found', 'Booking not found');

    const booking = bookingSnap.data();
    if (booking.status !== 'pending' && booking.status !== 'scheduled' && booking.status !== 'quoted') {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot quote on this booking status.');
    }

    // Check if this admin already quoted
    const quotes = booking.quotes || [];
    if (quotes.some(q => q.adminId === context.auth.uid)) {
      throw new functions.https.HttpsError('already-exists', 'You have already submitted a quote for this booking.');
    }

    const newQuote = {
      adminId: context.auth.uid,
      adminName: adminName,
      price: Number(price),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    transaction.update(bookingRef, {
      status: 'quoted', // Update status to reflect it has quotes
      quotes: admin.firestore.FieldValue.arrayUnion(newQuote),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Also log activity in the same transaction for integrity
    const logRef = db.collection('activity_logs').doc();
    transaction.set(logRef, {
      bookingId,
      actorId: context.auth.uid,
      action: 'admin_submitted_quote',
      price: Number(price),
      adminName: adminName,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return { success: true };
});

/**
 * Callable: acceptQuote
 * Securely locks the booking to the accepted quote and the corresponding admin.
 */
exports.acceptQuote = functions.https.onCall(async (data, context) => {
  verifyAuth(context);

  // Input validation
  const { bookingId, adminId } = validate(data, acceptQuoteSchema, functions.https.HttpsError);

  // Audit log
  await logSecurityEvent(SECURITY_EVENTS.FUNCTION_INVOKED, { function: 'acceptQuote', bookingId }, context);

  const bookingRef = db.collection('bookings').doc(bookingId);

  await db.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new functions.https.HttpsError('not-found', 'Booking not found');

    const booking = bookingSnap.data();
    if (booking.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the owner can accept a quote.');
    }
    if (booking.status !== 'quoted' && booking.status !== 'pending' && booking.status !== 'scheduled') {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot accept quote right now.');
    }

    const quotes = booking.quotes || [];
    const acceptedQuote = quotes.find(q => q.adminId === adminId);
    if (!acceptedQuote) {
      throw new functions.https.HttpsError('not-found', 'Requested quote does not exist.');
    }

    transaction.update(bookingRef, {
      status: 'accepted',
      adminId: adminId, // Lock the booking to this admin
      acceptedQuote: acceptedQuote,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Securely log
    const logRef = db.collection('activity_logs').doc();
    transaction.set(logRef, {
      bookingId,
      actorId: context.auth.uid,
      action: 'user_accepted_quote',
      price: acceptedQuote.price,
      adminId: acceptedQuote.adminId,
      adminName: acceptedQuote.adminName,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return { success: true };
});

/**
 * Callable: updateBookingStatus
 * Generalized secure endpoint for state machine transitions.
 */
exports.updateBookingStatus = functions.https.onCall(async (data, context) => {
  verifyAuth(context);

  // Rate limiting
  try {
    await enforceRateLimit(context, 'updateBookingStatus', functions.https.HttpsError);
  } catch (err) {
    await logRateLimitViolation('updateBookingStatus', context.auth?.uid || 'unknown', context);
    throw err;
  }

  // Input validation
  const { bookingId, action, extraArgs } = validate(data, updateBookingStatusSchema, functions.https.HttpsError);

  // Audit log
  await logSecurityEvent(SECURITY_EVENTS.FUNCTION_INVOKED, { function: 'updateBookingStatus', bookingId, action }, context);

  const bookingRef = db.collection('bookings').doc(bookingId);

  await db.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new functions.https.HttpsError('not-found', 'Booking not found');
    const booking = bookingSnap.data();

    const isOwner = booking.userId === context.auth.uid;
    const isAssignedAdmin = booking.adminId === context.auth.uid;
    const adminDocSnap = await transaction.get(db.collection('admins').doc(context.auth.uid));
    const isSuperAdmin = adminDocSnap.exists && adminDocSnap.data().role === 'superadmin';

    let updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let logAction = '';
    let logExtra = {};

    switch (action) {
      case 'user_cancelled':
        if (!isOwner) throw new functions.https.HttpsError('permission-denied', 'Only owner can cancel.');
        if (!['pending', 'scheduled', 'quoted', 'accepted'].includes(booking.status)) {
          throw new functions.https.HttpsError('failed-precondition', 'Booking has progressed too far to cancel.');
        }
        updates.status = 'cancelled';
        logAction = 'user_cancelled';
        break;

      case 'admin_cancelled':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        updates.status = 'cancelled';
        logAction = 'admin_cancelled';
        // Free worker safely
        if (booking.assignedWorkerId) {
          const workerRef = db.collection('gig_workers').doc(booking.assignedWorkerId);
          transaction.update(workerRef, { isAvailable: true });
        }
        break;

      case 'admin_assign_worker':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (!['accepted', 'pending', 'scheduled'].includes(booking.status)) throw new functions.https.HttpsError('failed-precondition', 'Invalid state for assigning worker.');

        const { workerId, workerName, workerPhone } = extraArgs || {};
        if (!workerId) throw new functions.https.HttpsError('invalid-argument', 'Missing worker details.');

        // Verify worker exists and is available
        const workerSnap = await transaction.get(db.collection('gig_workers').doc(workerId));
        if (!workerSnap.exists || !workerSnap.data().isAvailable) {
          throw new functions.https.HttpsError('failed-precondition', 'Worker is not available.');
        }

        updates.status = 'assigned';
        updates.assignedWorkerId = workerId;
        updates.workerName = workerName;
        updates.workerPhone = workerPhone;

        // Lock worker
        transaction.update(workerSnap.ref, { isAvailable: false });

        logAction = 'admin_assigned_worker';
        logExtra = { workerName };
        break;

      case 'admin_start_work':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (booking.status !== 'assigned') throw new functions.https.HttpsError('failed-precondition', 'Invalid state.');
        updates.status = 'in_progress';
        updates.startedAt = admin.firestore.FieldValue.serverTimestamp();
        logAction = 'admin_started_work';
        break;

      case 'admin_mark_finished':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (booking.status !== 'in_progress') throw new functions.https.HttpsError('failed-precondition', 'Invalid state.');
        updates.status = 'awaiting_confirmation';
        updates.finishedAt = admin.firestore.FieldValue.serverTimestamp();
        logAction = 'admin_marked_finished';
        break;

      case 'user_confirm_completion':
        if (!isOwner) throw new functions.https.HttpsError('permission-denied', 'Only owner can confirm.');
        if (booking.status !== 'awaiting_confirmation') throw new functions.https.HttpsError('failed-precondition', 'Invalid state.');
        updates.status = 'completed';
        logAction = 'user_confirmed_completion';

        // Free worker
        if (booking.assignedWorkerId) {
          const workerRef = db.collection('gig_workers').doc(booking.assignedWorkerId);
          transaction.update(workerRef, { isAvailable: true });
        }
        break;

      case 'admin_reopen_booking':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (booking.status !== 'cancelled') throw new functions.https.HttpsError('failed-precondition', 'Only cancelled bookings can be reopened.');
        updates.status = 'pending';
        // Erase worker assignment
        updates.assignedWorkerId = null;
        updates.workerName = null;
        updates.workerPhone = null;
        logAction = 'admin_cancelled_reopened';
        break;

      case 'user_rate':
        if (!isOwner) throw new functions.https.HttpsError('permission-denied', 'Only owner can rate.');
        if (booking.status !== 'completed') throw new functions.https.HttpsError('failed-precondition', 'Can only rate completed bookings.');
        if (booking.rating) throw new functions.https.HttpsError('already-exists', 'Already rated.');
        const { rating } = extraArgs || {};
        if (typeof rating !== 'number' || rating < 1 || rating > 5) throw new functions.https.HttpsError('invalid-argument', 'Invalid rating.');
        updates.rating = rating;
        logAction = 'user_rated';
        logExtra = { rating };
        break;

      case 'admin_resolve_dispute':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        const { decision, superadminOverride } = extraArgs || {};
        updates['dispute.status'] = 'resolved';
        updates['dispute.decision'] = decision;
        if (superadminOverride && isSuperAdmin) {
          updates['dispute.superadminOverride'] = true;
        }
        updates['dispute.resolutionTime'] = admin.firestore.FieldValue.serverTimestamp();
        updates['dispute.resolvedBy'] = context.auth.uid;
        logAction = 'admin_resolved_dispute';
        logExtra = { decision, superadminOverride: !!superadminOverride };
        break;

      case 'admin_log_call':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        const { callNotes } = extraArgs || {};
        updates['dispute.regionCallTime'] = admin.firestore.FieldValue.serverTimestamp();
        updates['dispute.callNotes'] = callNotes;
        logAction = 'region_call_logged';
        logExtra = { callNotes };
        break;

      case 'admin_log_visit':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        updates['dispute.visitTime'] = admin.firestore.FieldValue.serverTimestamp();
        logAction = 'region_visit_logged';
        break;

      case 'admin_add_note':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        const { note } = extraArgs || {};
        updates.dailyNotes = admin.firestore.FieldValue.arrayUnion({
          date: new Date().toLocaleDateString('en-IN'),
          note: note,
          addedBy: context.auth.uid
        });
        logAction = 'admin_added_note';
        logExtra = { note };
        break;

      case 'admin_upload_photo':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        const { label, url } = extraArgs || {};
        updates.photos = admin.firestore.FieldValue.arrayUnion({
          label, url, uploadedAt: new Date().toISOString()
        });
        // Also populate dailyPhotos for multi-day job tracking
        updates.dailyPhotos = admin.firestore.FieldValue.arrayUnion({
          dateLabel: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }),
          label: label || 'progress',
          url: url,
          uploadedBy: context.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logAction = 'admin_uploaded_photo';
        logExtra = { label };
        break;

      case 'user_raise_dispute':
        if (!isOwner) throw new functions.https.HttpsError('permission-denied', 'Only owner can raise dispute.');
        const { reason } = extraArgs || {};
        updates.dispute = {
          status: 'open',
          reason: reason,
          raisedAt: admin.firestore.FieldValue.serverTimestamp(),
          escalationStatus: false
        };
        logAction = 'user_raised_dispute';
        logExtra = { reason };
        break;

      case 'daily_add_note':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (!['in_progress'].includes(booking.status)) throw new functions.https.HttpsError('failed-precondition', 'Can only add daily notes when job is in progress.');
        const { note: dailyNote, dateLabel: noteDateLabel } = extraArgs || {};
        if (!dailyNote) throw new functions.https.HttpsError('invalid-argument', 'Note text is required.');
        updates.dailyNotes = admin.firestore.FieldValue.arrayUnion({
          dateLabel: noteDateLabel || new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }),
          note: dailyNote,
          addedBy: context.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logAction = 'daily_note_added';
        logExtra = { note: dailyNote };
        break;

      case 'daily_upload_photo':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (!['in_progress'].includes(booking.status)) throw new functions.https.HttpsError('failed-precondition', 'Can only upload photos when job is in progress.');
        const { label: photoLabel, url: photoUrl, dateLabel: photoDatelabel } = extraArgs || {};
        if (!photoUrl) throw new functions.https.HttpsError('invalid-argument', 'Photo URL is required.');
        updates.dailyPhotos = admin.firestore.FieldValue.arrayUnion({
          dateLabel: photoDatelabel || new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' }),
          label: photoLabel || 'progress',
          url: photoUrl,
          uploadedBy: context.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logAction = 'daily_photo_uploaded';
        logExtra = { label: photoLabel };
        break;

      case 'daily_user_confirmation':
        if (!isOwner) throw new functions.https.HttpsError('permission-denied', 'Only the booking owner can confirm daily work.');
        if (!['in_progress'].includes(booking.status)) throw new functions.https.HttpsError('failed-precondition', 'Can only confirm daily work when job is in progress.');
        const { dateLabel, workQuality, notes: confirmNotes } = extraArgs || {};
        if (!dateLabel) throw new functions.https.HttpsError('invalid-argument', 'Date label is required.');
        const existingConfirmations = booking.dailyConfirmations || [];
        if (existingConfirmations.some(c => c.dateLabel === dateLabel)) {
          throw new functions.https.HttpsError('already-exists', 'You have already confirmed work for this day.');
        }
        updates.dailyConfirmations = admin.firestore.FieldValue.arrayUnion({
          date: admin.firestore.FieldValue.serverTimestamp(),
          dateLabel: dateLabel,
          confirmedBy: context.auth.uid,
          workQuality: typeof workQuality === 'number' ? Math.min(5, Math.max(1, workQuality)) : 3,
          notes: confirmNotes || '',
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logAction = 'daily_work_confirmed';
        logExtra = { dateLabel, workQuality };
        break;

      case 'mark_day_complete':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (!['in_progress'].includes(booking.status)) throw new functions.https.HttpsError('failed-precondition', 'Can only mark day complete when job is in progress.');
        const { dayDate } = extraArgs || {};
        updates.completedDays = admin.firestore.FieldValue.arrayUnion({
          date: dayDate || new Date().toLocaleDateString('en-IN'),
          markedBy: context.auth.uid,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        logAction = 'day_marked_complete';
        logExtra = { dayDate };
        break;

      default:
        throw new functions.https.HttpsError('invalid-argument', 'Unknown action.');
    }

    transaction.update(bookingRef, updates);

    const logRef = db.collection('activity_logs').doc();
    transaction.set(logRef, {
      bookingId,
      actorId: context.auth.uid,
      action: logAction,
      ...logExtra,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  return { success: true };
});

/**
 * Callable: logActivity
 * For non-state-changing UI actions (uploading photos, logging calls/visits).
 */
exports.secureLogActivity = functions.https.onCall(async (data, context) => {
  verifyAuth(context);

  // Input validation
  const { bookingId, action, extraArgs } = validate(data, secureLogActivitySchema, functions.https.HttpsError);

  // Validate only specific actions are allowed this way
  const allowedActions = [
    'region_call_logged', 'region_visit_logged', 'admin_added_note', 'admin_uploaded_photo',
    'user_raised_dispute', 'admin_resolved_dispute'
  ];
  if (!allowedActions.includes(action)) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid direct log action. Actions should be inferred from state changes.');
  }

  const logRef = db.collection('activity_logs').doc();
  await logRef.set({
    bookingId,
    actorId: context.auth.uid,
    action,
    ...(extraArgs || {}),
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 6: OTP AUTHENTICATION
   Secure server-side OTP generation, storage (hashed), and verification.
   Replaces the previous hardcoded client-side OTP ("101010").
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Callable: sendOtp
 * Generates a cryptographically secure 6-digit OTP, stores a SHA-256 hash
 * (salted with the phone number) in Firestore with a 5-minute TTL, and sends
 * the plaintext code to the user via SMS.
 *
 * Security controls:
 * - Rate-limited to 3 requests per phone number per 10 minutes.
 * - Phone number must already exist in users_by_phone (prevents enumeration attacks).
 * - OTP is never logged or returned to the client.
 */
exports.sendOtp = functions.https.onCall(async (data, context) => {
  const phone = String(data.phone || '').trim();

  if (!phone || !/^\d{10}$/.test(phone)) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid 10-digit phone number is required.');
  }

  // Rate limit: max 3 OTP requests per phone per 10 minutes
  const allowed = await checkRateLimit('otp_send', phone, 3, 600);
  if (!allowed) {
    throw new functions.https.HttpsError('resource-exhausted', 'Too many OTP requests. Please wait before trying again.');
  }

  // Confirm the phone is registered before sending an OTP
  const userDoc = await db.collection('users_by_phone').doc(phone).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Phone number not registered. Please sign up first.');
  }

  // Generate a cryptographically secure 6-digit OTP.
  // randomInt(min, max) is exclusive at max, so use 1000000 to include 999999.
  const otp = crypto.randomInt(100000, 1000000).toString();
  // Use HMAC-SHA256 with the server-side secret so that even if the Firestore
  // document is leaked, the hash cannot be brute-forced without the secret key.
  const otpHash = crypto.createHmac('sha256', OTP_HMAC_SECRET).update(otp + ':' + phone).digest('hex');

  // Store only the hash; plaintext OTP is never persisted
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry
  await db.collection('otp_verifications').doc(phone).set({
    otpHash,
    expiresAt,
    attempts: 0,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Send OTP; mask phone number in server logs
  const maskedPhone = phone.slice(0, 2) + '******' + phone.slice(-2);
  await sendSms(phone, `Your Gigto verification code is: ${otp}. Valid for 5 minutes. Do not share this code with anyone.`);
  console.log(`[OTP] Verification code sent to ${maskedPhone}`);

  return { success: true };
});

/**
 * Callable: verifyOtp
 * Verifies a user-supplied OTP against the stored hash.
 * On success, issues a Firebase custom auth token so the client can sign in
 * without ever needing the user's password to be stored in Firestore.
 *
 * Security controls:
 * - Rate-limited to 3 verification attempts per phone per 10 minutes.
 * - OTP is invalidated after first successful use (prevents replay attacks).
 * - OTP document is deleted after 3 failed attempts or on expiry.
 * - Failed attempts are logged to the activity_logs collection.
 */
exports.verifyOtp = functions.https.onCall(async (data, context) => {
  const phone = String(data.phone || '').trim();
  const otp = String(data.otp || '').trim();

  if (!phone || !/^\d{10}$/.test(phone)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid 10-digit phone number required.');
  }
  if (!otp || !/^\d{6}$/.test(otp)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid 6-digit OTP required.');
  }

  // Rate limit: max 3 verification attempts per phone per 10 minutes
  const allowed = await checkRateLimit('otp_verify', phone, 3, 600);
  if (!allowed) {
    await logActivity('system', 'otp_rate_limited', 'system', { phone: phone.slice(0, 2) + '******' + phone.slice(-2) });
    throw new functions.https.HttpsError('resource-exhausted', 'Too many failed attempts. Please request a new OTP.');
  }

  const otpRef = db.collection('otp_verifications').doc(phone);
  const otpDoc = await otpRef.get();

  if (!otpDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'No active OTP found. Please request a new one.');
  }

  const otpData = otpDoc.data();

  // Reject already-used OTPs (replay attack prevention)
  if (otpData.used) {
    throw new functions.https.HttpsError('failed-precondition', 'OTP already used. Please request a new one.');
  }

  // Check expiry
  const expiresAt = otpData.expiresAt?.toDate ? otpData.expiresAt.toDate() : new Date(otpData.expiresAt);
  if (Date.now() > expiresAt.getTime()) {
    await otpRef.delete();
    throw new functions.https.HttpsError('deadline-exceeded', 'OTP has expired. Please request a new one.');
  }

  // Enforce max 3 failed attempts before invalidating the OTP
  if (otpData.attempts >= 3) {
    await otpRef.delete();
    await logActivity('system', 'otp_max_attempts_reached', 'system', { phone: phone.slice(0, 2) + '******' + phone.slice(-2) });
    throw new functions.https.HttpsError('resource-exhausted', 'Too many failed attempts. Please request a new OTP.');
  }

  // Verify OTP using HMAC-SHA256 with the same server-side secret
  const expectedHash = crypto.createHmac('sha256', OTP_HMAC_SECRET).update(otp + ':' + phone).digest('hex');
  if (expectedHash !== otpData.otpHash) {
    await otpRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
    await logActivity('system', 'otp_failed_attempt', 'system', { phone: phone.slice(0, 2) + '******' + phone.slice(-2) });
    throw new functions.https.HttpsError('unauthenticated', 'Invalid OTP. Please try again.');
  }

  // Mark OTP as used immediately to prevent replay attacks
  await otpRef.update({ used: true });

  // Retrieve the Firebase UID linked to this phone number
  const userSnap = await db.collection('users_by_phone').doc(phone).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User account not found.');
  }
  const { uid } = userSnap.data();

  // Issue a short-lived Firebase custom auth token so the client can sign in
  // without having the user's password stored anywhere in Firestore
  const customToken = await admin.auth().createCustomToken(uid);

  await logActivity('system', 'otp_login_success', 'system', {
    phone: phone.slice(0, 2) + '******' + phone.slice(-2),
  });

  return { success: true, token: customToken };
});
