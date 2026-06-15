export const COLLECTIONS = {
  bookings: 'bookings',
  gigWorkers: 'gig_workers',
  gigScoreEvents: 'gigscore_events',
  workerAvailability: 'worker_availability',
  servicePriceRules: 'service_price_rules',
  areaDemandSnapshots: 'area_demand_snapshots',
  workerOpenSessions: 'worker_open_sessions',
  smartQueueOffers: 'smart_queue_offers',
  bookingAssignmentStates: 'booking_assignment_states',
  demandRefreshQueue: 'demand_refresh_queue',
  liveTrackingEvents: 'live_tracking_events',
  supportTickets: 'support_tickets',
  workerWalletLedger: 'worker_wallet_ledger',
  assignmentAudits: 'assignment_audits',
  operatorQualityNotes: 'operator_quality_notes',
};

export const MVP_JOB_DEFAULTS = {
  currency: 'INR',
  openSessionMinutes: 90,
  queueOfferSeconds: 90,
  demandSnapshotMinutes: 60,
  demandSnapshotExpiryMinutes: 75,
  minimumWorkerThreshold: 20,
  peakUtilizationPercent: 90,
  maxRadiusKm: 15,
  priceLockMinutes: 10,
  consumerWaitMinutes: 8,
  dailyPositiveScoreCap: 40,
  monthlyPositiveScoreCap: 160,
};

export const DEMAND_LEVELS = ['low', 'normal', 'high', 'peak'];
export const DEMAND_CONFIDENCE = ['low', 'medium', 'high'];
export const OPEN_SESSION_STATUSES = ['open', 'offered', 'busy', 'paused', 'expired', 'closed'];
export const SMART_QUEUE_OFFER_STATUSES = ['offered', 'accepted', 'rejected', 'expired', 'skipped'];

export const MVP_SERVICE_PRICE_CAPS = {
  maid_hourly_basic_help: {
    serviceId: 'maid_hourly_basic_help',
    serviceName: 'Maid hourly basic help',
    unitType: 'hourly',
    minPrice: 150,
    normalPrice: 180,
    highPrice: 220,
    peakPrice: 250,
    maxAllowedPrice: 250,
  },
  kitchen_help: {
    serviceId: 'kitchen_help',
    serviceName: 'Kitchen utensils/basic kitchen help',
    unitType: 'hourly',
    minPrice: 150,
    normalPrice: 200,
    highPrice: 240,
    peakPrice: 280,
    maxAllowedPrice: 280,
  },
  bedroom_cleaning: {
    serviceId: 'bedroom_cleaning',
    serviceName: 'Bedroom cleaning',
    unitType: 'per_room',
    minPrice: 199,
    normalPrice: 299,
    highPrice: 399,
    peakPrice: 449,
    maxAllowedPrice: 449,
  },
  bathroom_cleaning: {
    serviceId: 'bathroom_cleaning',
    serviceName: 'Bathroom/washroom cleaning',
    unitType: 'per_bathroom',
    minPrice: 249,
    normalPrice: 349,
    highPrice: 399,
    peakPrice: 499,
    maxAllowedPrice: 499,
  },
  full_house_basic_cleaning: {
    serviceId: 'full_house_basic_cleaning',
    serviceName: 'Full house basic cleaning',
    unitType: 'per_job',
    minPrice: 699,
    normalPrice: 999,
    highPrice: 1499,
    peakPrice: 1799,
    maxAllowedPrice: 1799,
  },
  deep_kitchen_cleaning: {
    serviceId: 'deep_kitchen_cleaning',
    serviceName: 'Deep kitchen cleaning',
    unitType: 'per_job',
    minPrice: 699,
    normalPrice: 999,
    highPrice: 1499,
    peakPrice: 1799,
    maxAllowedPrice: 1799,
  },
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function requireValue(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required`);
  }
}

function assertPositiveNumber(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be positive`);
  }
  return number;
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + Number(minutes || 0) * 60000);
}

function addSeconds(date, seconds) {
  return new Date(new Date(date).getTime() + Number(seconds || 0) * 1000);
}

export function buildAreaId({ city, areaName }) {
  requireValue(city, 'city');
  requireValue(areaName, 'areaName');
  return `${slugify(city)}_${slugify(areaName)}`;
}

export function buildServicePriceRule({
  city,
  areaId,
  areaName,
  serviceId,
  serviceName,
  unitType,
  minPrice,
  normalPrice,
  highPrice,
  peakPrice,
  maxAllowedPrice,
  workerMinPrice,
  workerMaxPrice,
  minimumWorkerThreshold = MVP_JOB_DEFAULTS.minimumWorkerThreshold,
  peakUtilizationPercent = MVP_JOB_DEFAULTS.peakUtilizationPercent,
  demandMultiplierLow = 1,
  demandMultiplierNormal = 1,
  demandMultiplierHigh = 1.15,
  demandMultiplierPeak = 1.35,
  manualDemandLevel = null,
  manualOverrideReason = '',
  peakWindows = [],
  enabled = true,
  version = 1,
  updatedBy = null,
  updatedAt = new Date(),
  updateReason = '',
}) {
  requireValue(city, 'city');
  requireValue(areaName || areaId, 'area');
  requireValue(serviceId, 'serviceId');
  const resolvedAreaId = areaId || buildAreaId({ city, areaName });
  const preset = MVP_SERVICE_PRICE_CAPS[serviceId] || {};
  const resolvedMin = assertPositiveNumber(minPrice ?? preset.minPrice, 'minPrice');
  const resolvedNormal = assertPositiveNumber(normalPrice ?? preset.normalPrice, 'normalPrice');
  const resolvedHigh = assertPositiveNumber(highPrice ?? preset.highPrice, 'highPrice');
  const resolvedPeak = assertPositiveNumber(peakPrice ?? preset.peakPrice, 'peakPrice');
  const resolvedMax = assertPositiveNumber(maxAllowedPrice ?? preset.maxAllowedPrice ?? resolvedPeak, 'maxAllowedPrice');

  if (!(resolvedMin <= resolvedNormal && resolvedNormal <= resolvedHigh && resolvedHigh <= resolvedPeak && resolvedPeak <= resolvedMax)) {
    throw new Error('price ladder must be min <= normal <= high <= peak <= maxAllowed');
  }
  if (manualDemandLevel && !DEMAND_LEVELS.includes(manualDemandLevel)) {
    throw new Error('manualDemandLevel is invalid');
  }

  return {
    id: `${resolvedAreaId}_${slugify(serviceId)}`,
    city,
    areaId: resolvedAreaId,
    areaName: areaName || resolvedAreaId,
    serviceId,
    serviceName: serviceName || preset.serviceName || serviceId,
    unitType: unitType || preset.unitType || 'per_job',
    currency: MVP_JOB_DEFAULTS.currency,
    minPrice: resolvedMin,
    normalPrice: resolvedNormal,
    highPrice: resolvedHigh,
    peakPrice: resolvedPeak,
    maxAllowedPrice: resolvedMax,
    workerMinPrice: Number(workerMinPrice ?? resolvedMin),
    workerMaxPrice: Number(workerMaxPrice ?? resolvedMax),
    minimumWorkerThreshold: Number(minimumWorkerThreshold),
    peakUtilizationPercent: Number(peakUtilizationPercent),
    demandMultiplierLow: Number(demandMultiplierLow),
    demandMultiplierNormal: Number(demandMultiplierNormal),
    demandMultiplierHigh: Number(demandMultiplierHigh),
    demandMultiplierPeak: Number(demandMultiplierPeak),
    manualDemandLevel,
    manualOverrideReason,
    peakWindows,
    enabled: Boolean(enabled),
    version: Number(version),
    updatedBy,
    updatedAt,
    updateReason,
  };
}

export function buildAreaDemandSnapshot({
  city,
  areaId,
  areaName,
  serviceId,
  windowStart = new Date(),
  windowEnd,
  computedAt = new Date(),
  expiresAt,
  approvedWorkers = 0,
  openWorkers = 0,
  busyWorkers = 0,
  activePoolWorkers,
  openJobs = 0,
  activeBookings = 0,
  searches = 0,
  noWorkerSearches = 0,
  cancellations = 0,
  utilizationPercent,
  demandPressureScore = 0,
  demandLevel = 'normal',
  recommendedPrice,
  confidence = 'medium',
  lowSampleSize = false,
  usedManualOverride = false,
  reasonCodes = [],
  explanationConsumer = '',
  explanationWorker = '',
  ruleId,
  ruleVersion = 1,
}) {
  requireValue(city, 'city');
  requireValue(serviceId, 'serviceId');
  const resolvedAreaId = areaId || buildAreaId({ city, areaName });
  if (!DEMAND_LEVELS.includes(demandLevel)) throw new Error('demandLevel is invalid');
  if (!DEMAND_CONFIDENCE.includes(confidence)) throw new Error('confidence is invalid');
  const resolvedPool = Number(activePoolWorkers ?? Number(openWorkers) + Number(busyWorkers));
  const resolvedUtilization = utilizationPercent ?? (resolvedPool > 0 ? Math.round((Number(busyWorkers) / resolvedPool) * 100) : 0);

  return {
    id: `${resolvedAreaId}_${slugify(serviceId)}_${new Date(windowStart).toISOString().slice(0, 13)}`,
    city,
    areaId: resolvedAreaId,
    serviceId,
    windowStart,
    windowEnd: windowEnd || addMinutes(windowStart, MVP_JOB_DEFAULTS.demandSnapshotMinutes),
    computedAt,
    expiresAt: expiresAt || addMinutes(computedAt, MVP_JOB_DEFAULTS.demandSnapshotExpiryMinutes),
    approvedWorkers: Number(approvedWorkers),
    openWorkers: Number(openWorkers),
    busyWorkers: Number(busyWorkers),
    activePoolWorkers: resolvedPool,
    openJobs: Number(openJobs),
    activeBookings: Number(activeBookings),
    searches: Number(searches),
    noWorkerSearches: Number(noWorkerSearches),
    cancellations: Number(cancellations),
    utilizationPercent: resolvedUtilization,
    demandPressureScore: Number(demandPressureScore),
    demandLevel,
    recommendedPrice: Number(recommendedPrice || 0),
    confidence,
    lowSampleSize: Boolean(lowSampleSize),
    usedManualOverride: Boolean(usedManualOverride),
    reasonCodes,
    explanationConsumer,
    explanationWorker,
    ruleId,
    ruleVersion: Number(ruleVersion),
  };
}

export function buildWorkerOpenSession({
  workerId,
  city,
  areaIds = [],
  serviceIds = [],
  status = 'open',
  openSince = new Date(),
  expiresAt,
  lastHeartbeatAt = new Date(),
  locationConsent = false,
  approximateLocation = null,
  workerBasePrices = {},
  currentSuggestedPrices = {},
  acceptedDemandLevel = {},
  matchingOpenJobsCount = 0,
  matchingSearchesLastHour = 0,
  activeBookingId = null,
  createdAt = new Date(),
  updatedAt = new Date(),
}) {
  requireValue(workerId, 'workerId');
  requireValue(city, 'city');
  if (!OPEN_SESSION_STATUSES.includes(status)) throw new Error('status is invalid');
  if (!Array.isArray(areaIds) || areaIds.length === 0) throw new Error('areaIds are required');
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) throw new Error('serviceIds are required');
  const areaServiceKeys = areaIds.flatMap((areaId) =>
    serviceIds.map((serviceId) => `${areaId}__${serviceId}`)
  );

  return {
    id: `${workerId}_${new Date(openSince).getTime()}`,
    workerId,
    city,
    areaIds,
    serviceIds,
    areaServiceKeys,
    status,
    openSince,
    expiresAt: expiresAt || addMinutes(openSince, MVP_JOB_DEFAULTS.openSessionMinutes),
    lastHeartbeatAt,
    locationConsent: Boolean(locationConsent),
    approximateLocation,
    workerBasePrices,
    currentSuggestedPrices,
    acceptedDemandLevel,
    matchingOpenJobsCount: Number(matchingOpenJobsCount),
    matchingSearchesLastHour: Number(matchingSearchesLastHour),
    activeBookingId,
    createdAt,
    updatedAt,
  };
}

export function buildBookingPricingEvidence({
  serviceId,
  city,
  areaId,
  unitType,
  workerId,
  workerBasePrice,
  rule,
  snapshot,
  finalConsumerPrice,
  workerReceivable,
  platformFee = 0,
  launchFeeWaived = 0,
  priceSource = 'demand_snapshot',
  explanation,
  reasonCodes,
  calculatedAt = new Date(),
  priceLockedUntil,
}) {
  requireValue(serviceId, 'serviceId');
  requireValue(city, 'city');
  requireValue(areaId, 'areaId');
  requireValue(workerId, 'workerId');
  const consumerPrice = assertPositiveNumber(finalConsumerPrice, 'finalConsumerPrice');
  const receivable = assertPositiveNumber(workerReceivable ?? finalConsumerPrice, 'workerReceivable');
  // Intentional MVP launch guard: no platform fee is charged in the job price yet,
  // so consumer price must equal worker receivable. Remove/replace only when
  // payment settlement and explicit fee disclosure are reintroduced.
  if (consumerPrice !== receivable) {
    throw new Error('MVP pricing requires finalConsumerPrice to equal workerReceivable');
  }

  return {
    serviceId,
    city,
    areaId,
    unitType: unitType || rule?.unitType || 'per_job',
    currency: MVP_JOB_DEFAULTS.currency,
    workerId,
    workerBasePrice: Number(workerBasePrice || 0),
    ruleId: rule?.id || null,
    ruleVersion: Number(rule?.version || 1),
    snapshotId: snapshot?.id || null,
    snapshotComputedAt: snapshot?.computedAt || null,
    snapshotDemandLevel: snapshot?.demandLevel || 'normal',
    minPrice: Number(rule?.minPrice || 0),
    normalPrice: Number(rule?.normalPrice || 0),
    highPrice: Number(rule?.highPrice || 0),
    peakPrice: Number(rule?.peakPrice || 0),
    maxAllowedPrice: Number(rule?.maxAllowedPrice || 0),
    finalConsumerPrice: consumerPrice,
    workerReceivable: receivable,
    platformFee: Number(platformFee),
    launchFeeWaived: Number(launchFeeWaived),
    priceSource,
    explanation: explanation || snapshot?.explanationConsumer || 'Normal area price.',
    reasonCodes: reasonCodes || snapshot?.reasonCodes || [],
    calculatedAt,
    priceLockedUntil: priceLockedUntil || addMinutes(calculatedAt, MVP_JOB_DEFAULTS.priceLockMinutes),
  };
}

export function buildSmartQueueOffer({
  bookingId,
  workerId,
  rank = 1,
  scoreBreakdown = {},
  status = 'offered',
  offeredAt = new Date(),
  expiresAt,
  respondedAt = null,
  skipReason = null,
  matchingScope = 'same_area',
  distanceKm = null,
  distanceConfidence = 'same_area',
  radiusKm = MVP_JOB_DEFAULTS.maxRadiusKm,
  queueVersion = 1,
}) {
  requireValue(bookingId, 'bookingId');
  requireValue(workerId, 'workerId');
  if (!SMART_QUEUE_OFFER_STATUSES.includes(status)) throw new Error('status is invalid');
  const normalizedScore = {
    gigScore: Number(scoreBreakdown.gigScore || 0),
    favoriteBoost: Number(scoreBreakdown.favoriteBoost || 0),
    sameAreaBoost: Number(scoreBreakdown.sameAreaBoost || 0),
    distanceScore: Number(scoreBreakdown.distanceScore || 0),
    priceFitScore: Number(scoreBreakdown.priceFitScore || 0),
    responseSpeedScore: Number(scoreBreakdown.responseSpeedScore || 0),
    cancellationPenalty: Number(scoreBreakdown.cancellationPenalty || 0),
    skipPenalty: Number(scoreBreakdown.skipPenalty || 0),
    fairnessPenalty: Number(scoreBreakdown.fairnessPenalty || 0),
    safetyPenalty: Number(scoreBreakdown.safetyPenalty || 0),
  };
  normalizedScore.finalRankScore = Number(
    scoreBreakdown.finalRankScore ??
    normalizedScore.gigScore +
      normalizedScore.favoriteBoost +
      normalizedScore.sameAreaBoost +
      normalizedScore.distanceScore +
      normalizedScore.priceFitScore +
      normalizedScore.responseSpeedScore -
      normalizedScore.cancellationPenalty -
      normalizedScore.skipPenalty -
      normalizedScore.fairnessPenalty -
      normalizedScore.safetyPenalty
  );

  return {
    id: `${bookingId}_${workerId}_${rank}`,
    bookingId,
    workerId,
    rank: Number(rank),
    scoreBreakdown: normalizedScore,
    status,
    matchingScope,
    distanceKm,
    distanceConfidence,
    radiusKm: Number(radiusKm),
    offeredAt,
    expiresAt: expiresAt || addSeconds(offeredAt, MVP_JOB_DEFAULTS.queueOfferSeconds),
    respondedAt,
    skipReason,
    queueVersion: Number(queueVersion),
  };
}

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
      gigScore: Number(worker.gigScore ?? worker.socioScore ?? 500),
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
