/**
 * INSTANT BOOKING UTILITIES
 *
 * Handles the "available worker → instant book" flow:
 *  1. Workers set a fixed daily rate (₹ per day)
 *  2. Users see nearby available workers with their fixed rates
 *  3. One-tap booking: view worker details (no phone) → pay → track
 */

import { calculateFinalPrice } from './pricing';

/**
 * Build an availability record for a worker who sets their fixed daily rate.
 *
 * @param {object} params
 * @param {string} params.workerId   – worker_auth doc UID
 * @param {string} params.workerName – display name
 * @param {string} params.serviceType – e.g. 'Electrician', 'Plumber'
 * @param {number} params.fixedRate  – ₹ per day (worker-submitted)
 * @param {number} [params.rating]   – worker's rating (0–5)
 * @param {string} [params.area]     – area/city
 * @param {number} [params.lat]      – worker latitude
 * @param {number} [params.lng]      – worker longitude
 * @returns {object} availability record ready for Firestore
 */
export function buildWorkerAvailability({
  workerId,
  workerName,
  serviceType,
  fixedRate,
  rating = 0,
  area = '',
  lat = null,
  lng = null,
}) {
  if (!workerId) throw new Error('workerId is required');
  if (!workerName) throw new Error('workerName is required');
  if (!serviceType) throw new Error('serviceType is required');

  const rate = Number(fixedRate);
  if (isNaN(rate) || rate <= 0) throw new Error('fixedRate must be a positive number');

  const pricing = calculateFinalPrice(rate);

  return {
    workerId,
    workerName,
    serviceType,
    fixedRate: rate,
    finalPrice: pricing.finalTotal,
    pricing,
    rating: Number(rating) || 0,
    area,
    lat,
    lng,
    isAvailable: true,
    availableSince: new Date(),
  };
}

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Filter and rank available workers for a user by proximity and service type.
 *
 * @param {object[]} workers – array of availability records (from Firestore)
 * @param {object}   params
 * @param {string}   params.serviceType – service the user needs
 * @param {number}   params.lat         – user latitude
 * @param {number}   params.lng         – user longitude
 * @param {number}   [params.radiusKm=20] – max distance in km
 * @returns {object[]} matched workers sorted by distance (nearest first), each with `distanceKm`
 */
export function matchNearbyWorkers(workers, { serviceType, lat, lng, radiusKm = 20 }) {
  if (!Array.isArray(workers)) return [];
  if (!serviceType) return [];

  return workers
    .filter((w) => {
      if (!w.isAvailable) return false;
      if (w.serviceType.toLowerCase() !== serviceType.toLowerCase()) return false;
      if (w.lat == null || w.lng == null) return false;
      return true;
    })
    .map((w) => {
      const distanceKm = haversineKm(lat, lng, w.lat, w.lng);
      return { ...w, distanceKm: Math.round(distanceKm * 10) / 10 };
    })
    .filter((w) => w.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Create an instant booking object when a user confirms and pays.
 *
 * Skips the quote step entirely — goes straight to `assigned` status
 * with the worker's fixed rate as the accepted price.
 *
 * @param {object} params
 * @param {string} params.userId       – consumer UID
 * @param {string} params.userName     – consumer display name
 * @param {string} params.userPhone    – consumer phone
 * @param {string} params.userAddress  – consumer address
 * @param {string} params.userCity     – consumer city
 * @param {object} params.worker       – matched worker availability record
 * @returns {object} booking document ready for Firestore
 */
export function createInstantBooking({
  userId,
  userName,
  userPhone,
  userAddress,
  userCity,
  worker,
}) {
  if (!userId) throw new Error('userId is required');
  if (!worker) throw new Error('worker is required');
  if (!worker.workerId || !worker.workerName) {
    throw new Error('worker must have workerId and workerName');
  }

  const rate = Number(worker.fixedRate);
  if (isNaN(rate) || rate <= 0) {
    throw new Error('worker must have a valid fixedRate');
  }

  const pricing = calculateFinalPrice(rate);

  return {
    userId,
    name: userName || '',
    phone: userPhone || '',
    address: userAddress || '',
    userLocationCity: userCity || '',
    serviceType: worker.serviceType,
    status: 'assigned',
    bookingType: 'instant',
    // Worker assignment (pre-filled — no quote step)
    assignedWorkerId: worker.workerId,
    workerName: worker.workerName,
    assignedWorker: worker.workerName,
    // Pricing
    fixedRate: rate,
    acceptedQuote: {
      price: pricing.baseAmount,
      finalPrice: pricing.finalTotal,
      pricing,
    },
    // Skip scheduling — this is immediate work
    isScheduled: false,
    estimatedDays: 1,
    issueTitle: `Instant booking – ${worker.serviceType}`,
    jobDetails: '',
    // Timestamps — to be replaced by serverTimestamp() on Firestore write
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Build a user-facing notification message for a nearby available worker.
 *
 * @param {object} worker – availability record with distanceKm
 * @returns {string} e.g. "⚡ Electrician near you available for ₹600/day to fix things!"
 */
export function buildNotificationText(worker) {
  if (!worker) return '';
  const rate = Number(worker.fixedRate) || 0;
  return `⚡ ${worker.serviceType} near you available for ₹${rate.toLocaleString('en-IN')}/day to fix things!`;
}

/**
 * Format a worker record for display in Step 1 of the instant booking modal.
 * Shows worker name and price — but NOT phone number (privacy).
 *
 * @param {object} worker – availability record
 * @returns {object} safe display data
 */
export function getWorkerDisplayInfo(worker) {
  if (!worker) return null;

  const pricing = calculateFinalPrice(worker.fixedRate);

  return {
    workerName: worker.workerName,
    serviceType: worker.serviceType,
    rating: worker.rating || 0,
    area: worker.area || '',
    fixedRate: worker.fixedRate,
    finalPrice: pricing.finalTotal,
    platformFee: pricing.platformFee,
    paymentCharge: pricing.paymentCharge,
    distanceKm: worker.distanceKm ?? null,
    // Phone is intentionally excluded for privacy
  };
}
