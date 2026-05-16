export const COLLECTIONS = {
  bookings: 'bookings',
  gigWorkers: 'gig_workers',
  workerAvailability: 'worker_availability',
  liveTrackingEvents: 'live_tracking_events',
  supportTickets: 'support_tickets',
  workerWalletLedger: 'worker_wallet_ledger',
  assignmentAudits: 'assignment_audits',
  operatorQualityNotes: 'operator_quality_notes',
};

export const LIVE_TRACKING_EVENTS = [
  'booking.accepted',
  'worker.started_travel',
  'worker.arrived',
  'work.started',
  'work.completed',
  'consumer.confirmed',
  'issue.raised',
  'replacement.requested',
  'guild.standby_requested',
];

export function buildWorkerAvailabilitySnapshot({
  workerId,
  serviceTypes = [],
  city,
  area,
  lat = null,
  lng = null,
  isReadyToday = false,
  emergencyEnabled = false,
}) {
  if (!workerId) throw new Error('workerId is required');
  return {
    workerId,
    serviceTypes,
    city: city || '',
    area: area || '',
    lat,
    lng,
    isReadyToday,
    emergencyEnabled,
    updatedAt: new Date(),
  };
}

export function buildAssignmentCandidate({ booking, worker, distanceKm = null, score = 0, reason = 'auto_match' }) {
  if (!booking?.id) throw new Error('booking.id is required');
  if (!worker?.id && !worker?.uid) throw new Error('worker id is required');

  return {
    bookingId: booking.id,
    workerId: worker.id || worker.uid,
    workerName: worker.name || worker.displayName || '',
    serviceType: booking.serviceType || booking.title || '',
    distanceKm,
    score,
    reason,
    rankingInputs: {
      socioScore: Number(worker.socioScore || 500),
      tier: worker.tier || 'Silver',
      price: Number(worker.price || booking.suggestedPriceBand?.mid || 0),
      readyToday: Boolean(worker.isReadyToday),
    },
  };
}

export function buildLiveTrackingEvent({ bookingId, workerId, consumerId, eventType, lat = null, lng = null, source = 'worker_app' }) {
  if (!bookingId) throw new Error('bookingId is required');
  if (!LIVE_TRACKING_EVENTS.includes(eventType)) throw new Error('Unknown live tracking event');

  return {
    bookingId,
    workerId: workerId || null,
    consumerId: consumerId || null,
    eventType,
    lat,
    lng,
    source,
    createdAt: new Date(),
    retentionClass: 'short_lived',
  };
}

export function buildSupportTicket({ actorId, role, issueType, title, bookingId = null, priority = 'Normal' }) {
  if (!actorId) throw new Error('actorId is required');
  if (!role) throw new Error('role is required');

  return {
    actorId,
    role,
    issueType: issueType || 'general',
    title: title || 'Support request',
    bookingId,
    priority,
    status: 'open',
    createdAt: new Date(),
  };
}

export function buildWorkerWalletDueEntry({ workerId, bookingId, platformFee, reason = 'cash_collection_platform_fee' }) {
  if (!workerId) throw new Error('workerId is required');
  if (!bookingId) throw new Error('bookingId is required');
  const fee = Number(platformFee || 0);
  if (fee <= 0) throw new Error('platformFee must be positive');

  return {
    workerId,
    bookingId,
    amount: -fee,
    reason,
    status: 'due',
    createdAt: new Date(),
  };
}

export function buildOperatorQualityNote({ operatorId, targetType, targetId, note, severity = 'Normal' }) {
  if (!operatorId) throw new Error('operatorId is required');
  if (!targetType || !targetId) throw new Error('target is required');
  if (!note) throw new Error('note is required');

  return {
    operatorId,
    targetType,
    targetId,
    note,
    severity,
    createdAt: new Date(),
    requiresSuperadminReview: severity === 'High',
  };
}
