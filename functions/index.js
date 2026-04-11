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
const https = require('https');

admin.initializeApp();
const db = admin.firestore();

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 1: COMMUNICATION HELPERS
   Logic for sending transactional emails and SMS notifications.
   ────────────────────────────────────────────────────────────────────────── */

// Email transporter (set via firebase functions:config:set gmail.user="..." gmail.pass="...")
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().gmail?.user,
    pass: functions.config().gmail?.pass,
  },
});

/**
 * Sends a transactional email using Nodemailer.
 * Requires "gmail.user" and "gmail.pass" in functions config.
 */
function sendEmail(to, subject, text) {
  if (!functions.config().gmail?.user || !to) return Promise.resolve();
  return transporter
    .sendMail({ from: functions.config().gmail?.user, to, subject, text })
    .catch(err => console.error('Email error:', err));
}

/**
 * Sends an SMS using Twilio if configured, or logs to console if not.
 * Requires twilio.sid, twilio.token, and twilio.phone in config.
 */
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

function normalizeServiceType(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/electrican/g, 'electrician')
    .replace(/plummer/g, 'plumber')
    .replace(/carpanter/g, 'carpenter');
}

async function resolveRegionLeadForBooking(booking) {
  if (!booking?.adminId) return null;
  const adminDoc = await db.collection('admins').doc(booking.adminId).get();
  if (!adminDoc.exists) return null;
  const adminData = adminDoc.data();
  if (adminData.role === 'regionLead') {
    return { id: adminDoc.id, ...adminData };
  }
  if (!adminData.parentAdminId) return null;
  const parentDoc = await db.collection('admins').doc(adminData.parentAdminId).get();
  if (!parentDoc.exists) return null;
  return { id: parentDoc.id, ...parentDoc.data() };
}

async function findBestWorkerForBooking(adminId, serviceType) {
  const desiredType = normalizeServiceType(serviceType);
  const workerSnap = await db.collection('gig_workers').where('adminId', '==', adminId).get();
  if (workerSnap.empty) return null;

  const eligibleWorkers = workerSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(w => {
      const typeMatch = normalizeServiceType(w.gigType) === desiredType;
      const active = (w.status || 'inactive') === 'active';
      const approved = !w.approvalStatus || w.approvalStatus === 'approved';
      const notFraud = !w.isFraud;
      const available = w.isAvailable !== false;
      return typeMatch && active && approved && notFraud && available;
    });

  if (eligibleWorkers.length === 0) return null;

  eligibleWorkers.sort((a, b) => {
    const scoreA = (Number(a.rating || 0) * 100) - Number(a.completedJobs || 0);
    const scoreB = (Number(b.rating || 0) * 100) - Number(b.completedJobs || 0);
    return scoreB - scoreA;
  });

  return eligibleWorkers[0];
}

function canonicalServiceName(value) {
  const normalized = normalizeServiceType(value);
  const serviceMap = {
    plumber: 'Plumber',
    electrician: 'Electrician',
    carpenter: 'Carpenter',
    painter: 'Painter',
  };
  return serviceMap[normalized] || '';
}

function detectServiceFromMessage(message = '') {
  const normalizedMessage = normalizeServiceType(message);
  const keywordMap = {
    Plumber: ['plumber', 'pipe', 'leak', 'water', 'tap', 'sink', 'drain', 'toilet'],
    Electrician: ['electrician', 'wire', 'wiring', 'fan', 'light', 'switch', 'socket', 'power'],
    Carpenter: ['carpenter', 'wood', 'door', 'cupboard', 'furniture', 'shelf', 'table'],
    Painter: ['painter', 'paint', 'wall', 'colour', 'color', 'coating', 'putty'],
  };

  return Object.entries(keywordMap).find(([, keywords]) =>
    keywords.some((keyword) => normalizedMessage.includes(keyword))
  )?.[0] || '';
}

function formatMarketPrice(insight = {}) {
  const minQuote = Number(insight.minQuote || 0);
  const maxQuote = Number(insight.maxQuote || 0);
  const averageQuote = Number(insight.averageQuote || 0);
  const quoteCount = Number(insight.quoteCount || 0);

  if (!minQuote || !maxQuote) return 'quote on request';

  const avgText = averageQuote ? ` (avg ₹${Math.round(averageQuote)} from ${quoteCount} quotes)` : '';
  return `₹${Math.round(minQuote)} - ₹${Math.round(maxQuote)}${avgText}`;
}

async function buildServiceInsights() {
  const supportedServices = ['Plumber', 'Electrician', 'Carpenter', 'Painter'];
  const serviceInsights = {};
  const ratingBuckets = {};
  const quoteBuckets = {};

  supportedServices.forEach((service) => {
    serviceInsights[service] = {
      service,
      availableWorkers: 0,
      totalWorkers: 0,
      averageRating: null,
      minQuote: null,
      maxQuote: null,
      averageQuote: null,
      quoteCount: 0,
      topWorkers: [],
    };
    ratingBuckets[service] = [];
    quoteBuckets[service] = [];
  });

  const [workersSnap, bookingsSnap] = await Promise.all([
    db.collection('gig_workers').get(),
    db.collection('bookings').get(),
  ]);

  workersSnap.forEach((workerDoc) => {
    const worker = workerDoc.data() || {};
    const service = canonicalServiceName(worker.gigType);
    if (!serviceInsights[service]) return;

    const approved = !worker.approvalStatus || worker.approvalStatus === 'approved';
    const active = (worker.status || 'inactive') === 'active';
    const notFraud = !worker.isFraud;
    const available = worker.isAvailable !== false;
    const rating = Number(worker.rating || 0);
    const completedJobs = Number(worker.completedJobs || 0);

    serviceInsights[service].totalWorkers += 1;

    if (approved && active && notFraud && available) {
      serviceInsights[service].availableWorkers += 1;
    }

    if (approved && active && notFraud) {
      if (rating > 0) ratingBuckets[service].push(rating);
      serviceInsights[service].topWorkers.push({
        name: (worker.name || 'Worker').toString().trim(),
        rating: rating > 0 ? Number(rating.toFixed(1)) : null,
        completedJobs,
        isAvailable: available,
      });
    }
  });

  bookingsSnap.forEach((bookingDoc) => {
    const booking = bookingDoc.data() || {};
    const service = canonicalServiceName(booking.serviceType);
    if (!serviceInsights[service]) return;

    const quoteList = Array.isArray(booking.quotes) && booking.quotes.length
      ? booking.quotes
      : (booking.acceptedQuote ? [booking.acceptedQuote] : []);

    quoteList.forEach((quote) => {
      const amount = Number(quote?.finalPrice || quote?.price || 0);
      if (Number.isFinite(amount) && amount > 0) {
        quoteBuckets[service].push(amount);
      }
    });
  });

  return supportedServices.map((service) => {
    const insight = serviceInsights[service];
    const ratings = ratingBuckets[service];
    const quotes = quoteBuckets[service];

    insight.topWorkers = insight.topWorkers
      .sort((a, b) => {
        const ratingGap = Number(b.rating || 0) - Number(a.rating || 0);
        if (ratingGap !== 0) return ratingGap;
        return Number(b.completedJobs || 0) - Number(a.completedJobs || 0);
      })
      .slice(0, 3);

    if (ratings.length) {
      const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
      insight.averageRating = Number(avgRating.toFixed(1));
    }

    if (quotes.length) {
      insight.minQuote = Math.round(Math.min(...quotes));
      insight.maxQuote = Math.round(Math.max(...quotes));
      insight.averageQuote = Math.round(quotes.reduce((sum, quote) => sum + quote, 0) / quotes.length);
      insight.quoteCount = quotes.length;
    }

    return insight;
  });
}

function buildFallbackAssistantReply({ message = '', selectedService = '', insights = [] }) {
  const lowerMessage = (message || '').toLowerCase();
  const requestedService = canonicalServiceName(selectedService) || detectServiceFromMessage(message);
  const matchingInsight = insights.find((item) => item.service === requestedService);

  if (matchingInsight && /(compare|cost|price|cheap|worker)/i.test(lowerMessage)) {
    return `For ${matchingInsight.service}, we have ${matchingInsight.availableWorkers} workers available. Typical quotes range ${formatMarketPrice(matchingInsight)}. Post your job to get exact bids.`;
  }

  if (matchingInsight && /(available|availability|service)/i.test(lowerMessage)) {
    return `${matchingInsight.service} is available now with ${matchingInsight.availableWorkers} workers. Approximate pricing: ${formatMarketPrice(matchingInsight)}. Would you like to book?`;
  }

  if (/\b(urgent|emergency|asap|immediately)\b/i.test(lowerMessage)) {
    const serviceLabel = requestedService || 'service';
    return `I understand this is urgent! Tell me what you need and I'll help you book a ${serviceLabel} right away.`;
  }

  if (/(book|booking|hire|need|want|looking for)/i.test(lowerMessage)) {
    const serviceLabel = requestedService || 'the right service';
    return `To book ${serviceLabel}: describe your job, confirm your address and phone, and submit to receive quotes from verified workers.`;
  }

  if (/\b(hi|hello|hey|namaste)\b/i.test(lowerMessage)) {
    return 'Hello! I\'m Gito AI, your booking assistant. Tell me what you need — a plumber, electrician, carpenter, or painter — and I\'ll help you book.';
  }

  if (/(how|process|steps|guide)/i.test(lowerMessage)) {
    return 'Choose a service, describe your job, provide your address and phone, then compare quotes from verified workers and book the best one.';
  }

  if (requestedService) {
    return `I can help you with ${requestedService}! Would you like to check pricing, see availability, or start booking?`;
  }

  return 'I can help you book a plumber, electrician, carpenter, or painter. Just tell me what you need!';
}


/**
 * Build the system instruction and user message for the Gemini API.
 * Returns { systemInstruction, userMessage } — the caller sends
 * systemInstruction via the Gemini `system_instruction` field and
 * userMessage as `contents`.
 */
function buildGeminiPrompt({ message = '', selectedService = '', insights = [] }) {
  const requestedService = canonicalServiceName(selectedService) || detectServiceFromMessage(message);
  const scopedInsights = requestedService
    ? insights.filter((item) => item.service === requestedService)
    : insights;

  const serviceSummary = scopedInsights.map((item) => {
    return `- ${item.service}: ${item.availableWorkers} available workers, average rating ${item.averageRating || 'N/A'}, recent price range ${formatMarketPrice(item)}.`;
  }).join('\n');

  const systemInstruction = [
    '=== IDENTITY ===',
    'You are Gito AI, the booking assistant for Gigtos — a home-services marketplace app operating across India.',
    '',
    '=== PLATFORM WORKFLOW ===',
    'Gigtos connects consumers with verified local workers for home repairs and services.',
    'Currently active services: Plumber, Electrician, Carpenter, Painter.',
    'Many more services are coming soon including drivers, AC technician, pest control, deep cleaning, security, construction, hospitality, and more.',
    '',
    '=== BOOKING PROCESS (how it works) ===',
    '1. User selects a service (e.g. Plumber, Electrician).',
    '2. User describes the job and provides their address and phone number.',
    '3. Verified workers in the area receive the request and send competitive quotes.',
    '4. User compares worker ratings, reviews, prices, and picks the best worker.',
    '5. Worker comes to the user location and completes the job.',
    '6. User pays after satisfaction — secure payment is supported.',
    '',
    '=== PRICING MODEL ===',
    'All services are quote-based. Workers provide personalized quotes after seeing job details.',
    'Users can compare multiple quotes before choosing. Never promise a fixed price — always say it depends on job scope.',
    'If past pricing data is available, share it as an estimate range.',
    '',
    '=== WORKER QUALITY & TRUST ===',
    'All workers are verified and rated by real customers.',
    'Users can see each worker\'s ratings, number of completed jobs, and customer reviews before booking.',
    'Gigtos supports secure payments — users only pay after the work is done to their satisfaction.',
    '',
    '=== SCHEDULING & AVAILABILITY ===',
    'Most workers are available 7 days a week, including weekends.',
    'After booking, workers typically respond within 1-2 hours with their availability.',
    'Users can specify their preferred date and time during booking.',
    '',
    '=== CANCELLATION & SUPPORT ===',
    'Users can cancel bookings from their dashboard.',
    'Gigtos support team is available to help with any issues or complaints.',
    '',
    '=== YOUR RESPONSE GUIDELINES ===',
    '- Be friendly, helpful, and concise (1-3 sentences).',
    '- Identify which service the user needs from their description.',
    '- Share relevant pricing data when available, clearly labeled as estimates.',
    '- Guide users toward booking when appropriate, but never auto-book.',
    '- For urgent requests, reassure the user and prioritize speed.',
    '- If unsure which service fits, ask a clarifying question.',
    '- If a service is coming soon (not yet active), mention it will be available soon.',
    '- Do not list all services unless the user specifically asks.',
  ].join('\n');

  const userMessage = [
    `Selected service: ${selectedService || 'Not selected'}`,
    '',
    'Live service data:',
    serviceSummary || '- No live service data available currently.',
    '',
    `User message: ${message}`,
  ].join('\n');

  return { systemInstruction, userMessage };
}

function callGeminiAssistant({ apiKey, systemInstruction, userMessage }) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 512,
      },
    });

    const request = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${encodeURIComponent(apiKey)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
    }, (response) => {
      let rawData = '';
      response.on('data', (chunk) => {
        rawData += chunk;
      });
      response.on('end', () => {
        if (response.statusCode >= 400) {
          reject(new Error(`Gemini API error ${response.statusCode}: ${rawData}`));
          return;
        }

        try {
          const payload = JSON.parse(rawData || '{}');
          const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join(' ').trim();
          resolve(text || '');
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.write(requestBody);
    request.end();
  });
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

      await bookingRef.update({
        statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
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

/**
 * SCHEDULED: Runs every 30 minutes.
 * LOGIC: Escalates any active booking that has not moved status in the last 24 hours
 * and pushes an alert to the corresponding Region Lead.
 */
exports.checkBookingSlaDelay = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => {
    const activeStatuses = ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'];
    const twentyFourHoursAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));

    const snapshot = await db.collection('bookings').where('status', 'in', activeStatuses).get();
    let flagged = 0;

    for (const docSnap of snapshot.docs) {
      const booking = docSnap.data();
      const statusAt = booking.statusUpdatedAt?.toDate?.()
        || booking.updatedAt?.toDate?.()
        || booking.createdAt?.toDate?.()
        || null;

      if (!statusAt || statusAt > twentyFourHoursAgo) continue;
      if (booking?.sla?.notified) continue;

      const regionLead = await resolveRegionLeadForBooking(booking);
      const breachAt = admin.firestore.FieldValue.serverTimestamp();

      await docSnap.ref.update({
        sla: {
          breached: true,
          notified: true,
          breachedAt: breachAt,
          statusAtBreach: booking.status,
          regionLeadId: regionLead?.id || null,
        },
      });

      if (regionLead?.id) {
        await db.collection('admin_alerts').add({
          adminId: regionLead.id,
          bookingId: docSnap.id,
          type: 'booking_sla_delayed',
          status: 'open',
          title: 'Booking delayed beyond 24 hours',
          message: `${booking.serviceType || 'Service'} booking is stuck in ${booking.status} for more than 24 hours.`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (regionLead.email) {
          await sendEmail(
            regionLead.email,
            'Gigto Alert: Booking delayed >24h',
            `Booking ${docSnap.id} is stuck in status ${booking.status} for more than 24 hours.`
          );
        }
      }

      await logActivity(docSnap.id, 'booking_sla_delayed', 'system', {
        status: booking.status,
        regionLeadId: regionLead?.id || null,
      });
      flagged++;
    }

    console.log(`[SLA] Delayed bookings flagged: ${flagged}`);
    return null;
  });

/* ──────────────────────────────────────────────────────────────────────────
   SECTION 5: SECURE CALLABLE FUNCTIONS (100% SECURITY)
   Endpoints to handle all state transitions, removing logic from the frontend.
   ────────────────────────────────────────────────────────────────────────── */

const verifyAuth = (context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }
};

/**
 * Callable: getServiceInsights
 * Returns aggregated service availability and quote ranges for the consumer home page.
 */
exports.getServiceInsights = functions.https.onCall(async () => {
  const services = await buildServiceInsights();
  return {
    services,
    generatedAt: new Date().toISOString(),
  };
});

/**
 * Callable: aiBookingAssistant
 * Uses Gemini 1.5 Flash when configured, with a safe local fallback if the API key is missing.
 */
exports.aiBookingAssistant = functions.https.onCall(async (data) => {
  const message = (data?.message || '').toString().trim();
  const selectedService = (data?.selectedService || '').toString().trim();

  if (!message) {
    throw new functions.https.HttpsError('invalid-argument', 'A message is required.');
  }

  const insights = await buildServiceInsights();
  const fallbackReply = buildFallbackAssistantReply({
    message,
    selectedService,
    insights,
  });

  const apiKey = functions.config().gemini?.key || process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    return {
      reply: fallbackReply,
      insights,
      usedFallback: true,
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const { systemInstruction, userMessage } = buildGeminiPrompt({ message, selectedService, insights });
    const reply = await callGeminiAssistant({ apiKey, systemInstruction, userMessage });

    return {
      reply: reply || fallbackReply,
      insights,
      usedFallback: !reply,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('aiBookingAssistant failed:', error);
    return {
      reply: fallbackReply,
      insights,
      usedFallback: true,
      generatedAt: new Date().toISOString(),
    };
  }
});

/**
 * Callable: submitQuote
 * Allows an admin to securely submit a quote without arbitrary document write access.
 */
exports.submitQuote = functions.https.onCall(async (data, context) => {
  verifyAuth(context);
  const { bookingId, price } = data;
  if (!bookingId || !price || isNaN(price) || price <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid quote parameters.');
  }

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
      // Don't change status to 'quoted' - keep booking open for multiple masons to submit competing quotes
      // Status will only change when user accepts a quote (becomes 'accepted')
      escrowStatus: 'pending_acceptance',  // ✅ Track escrow status for quote acceptance
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
  const { bookingId, adminId } = data;

  if (!bookingId || !adminId) throw new functions.https.HttpsError('invalid-argument', 'Missing parameters.');

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

    const bestWorker = await findBestWorkerForBooking(adminId, booking.serviceType);

    const nextUpdates = {
      status: bestWorker ? 'assigned' : 'accepted',
      adminId: adminId, // Lock the booking to this admin
      acceptedQuote: acceptedQuote,
      statusUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (bestWorker) {
      nextUpdates.assignedWorkerId = bestWorker.id;
      nextUpdates.workerName = bestWorker.name || '';
      nextUpdates.workerPhone = bestWorker.contact || bestWorker.phone || '';
      nextUpdates.assignedWorker = bestWorker.name || '';
    }

    transaction.update(bookingRef, nextUpdates);

    if (bestWorker) {
      transaction.update(db.collection('gig_workers').doc(bestWorker.id), {
        isAvailable: false,
      });
    }

    // Securely log
    const logRef = db.collection('activity_logs').doc();
    transaction.set(logRef, {
      bookingId,
      actorId: context.auth.uid,
      action: bestWorker ? 'user_accepted_quote_auto_assigned' : 'user_accepted_quote',
      price: acceptedQuote.price,
      adminId: acceptedQuote.adminId,
      adminName: acceptedQuote.adminName,
      autoAssignedWorkerId: bestWorker?.id || null,
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
  const { bookingId, action, extraArgs } = data;
  if (!bookingId || !action) throw new functions.https.HttpsError('invalid-argument', 'Missing parameters.');

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
        updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
        logAction = 'user_cancelled';
        break;

      case 'admin_cancelled':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        updates.status = 'cancelled';
        updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
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
        updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
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
        updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
        updates.startedAt = admin.firestore.FieldValue.serverTimestamp();
        logAction = 'admin_started_work';
        break;

      case 'admin_mark_finished':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (booking.status !== 'in_progress') throw new functions.https.HttpsError('failed-precondition', 'Invalid state.');
        {
          const estimatedDays = Number(booking.estimatedDays || 1);
          const completedWorkDays = Number(booking.completedWorkDays || 0);
          const nextCompletedDays = completedWorkDays + 1;
          const remainingWorkDays = Math.max(estimatedDays - nextCompletedDays, 0);

          updates.completedWorkDays = nextCompletedDays;
          updates.remainingWorkDays = remainingWorkDays;

          if (remainingWorkDays > 0) {
            updates.status = 'in_progress';
            updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
            logAction = 'admin_marked_workday_complete';
            logExtra = { completedWorkDays: nextCompletedDays, remainingWorkDays };
          } else {
            updates.status = 'awaiting_confirmation';
            updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
            updates.finishedAt = admin.firestore.FieldValue.serverTimestamp();
            logAction = 'admin_marked_finished';
          }
        }
        break;

      case 'user_confirm_completion':
        if (!isOwner) throw new functions.https.HttpsError('permission-denied', 'Only owner can confirm.');
        if (booking.status !== 'awaiting_confirmation') throw new functions.https.HttpsError('failed-precondition', 'Invalid state.');
        updates.status = 'completed';
        updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
        logAction = 'user_confirmed_completion';

        // Free worker
        if (booking.assignedWorkerId) {
          const workerRef = db.collection('gig_workers').doc(booking.assignedWorkerId);
          const workerSnap = await transaction.get(workerRef);
          if (workerSnap.exists) {
            transaction.update(workerRef, { isAvailable: true });
          }
        }
        break;

      case 'admin_reopen_booking':
        if (!isAssignedAdmin && !isSuperAdmin) throw new functions.https.HttpsError('permission-denied', 'Unauthorized.');
        if (booking.status !== 'cancelled') throw new functions.https.HttpsError('failed-precondition', 'Only cancelled bookings can be reopened.');
        updates.status = 'pending';
        updates.statusUpdatedAt = admin.firestore.FieldValue.serverTimestamp();
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
  const { bookingId, action, extraArgs } = data;
  if (!bookingId || !action) throw new functions.https.HttpsError('invalid-argument', 'Missing parameters.');

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
