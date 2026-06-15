import {
  COLLECTIONS,
  DEMAND_LEVELS,
  MVP_JOB_DEFAULTS,
  buildBookingPricingEvidence,
} from './backendContracts';

export const DEMAND_REFRESH_EVENTS = [
  'worker_opened',
  'worker_closed',
  'worker_busy',
  'worker_available',
  'booking_requested',
  'booking_accepted',
  'booking_completed',
  'booking_cancelled',
  'consumer_search',
  'no_worker_search',
  'manual_override_saved',
];

export const DEMAND_REFRESH_PUBSUB = {
  topic: 'gigtos-demand-refresh-v1',
  collection: COLLECTIONS.demandRefreshQueue,
  dedupePrefix: 'demand_refresh',
  transport: 'pubsub',
};

export const MVP_MANUAL_OVERRIDE_HIERARCHY =
  'disabled_rule > worker_price_cap > superadmin_manual_demand_with_reason > fresh_snapshot > safe_normal_fallback > max_price_cap';

export const DEMAND_REFRESH_PRIORITY_BY_EVENT = {
  manual_override_saved: 'immediate',
  booking_requested: 'high',
  booking_accepted: 'high',
  no_worker_search: 'high',
  worker_opened: 'high',
  worker_closed: 'high',
  worker_busy: 'high',
  worker_available: 'high',
  booking_completed: 'normal',
  booking_cancelled: 'normal',
  consumer_search: 'normal',
};

export const DEMAND_REFRESH_DEBOUNCE_SECONDS = {
  immediate: 0,
  high: 30,
  normal: 120,
  none: null,
};

const DEMAND_PRICE_FIELDS = {
  low: 'minPrice',
  normal: 'normalPrice',
  high: 'highPrice',
  peak: 'peakPrice',
};

function toDate(value, fallback = new Date()) {
  if (!value) return new Date(fallback);
  return value instanceof Date ? value : new Date(value);
}

function addMinutes(date, minutes) {
  return new Date(toDate(date).getTime() + Number(minutes || 0) * 60000);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requireValue(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required`);
  }
}

function clampPrice(value, min, max) {
  return Math.min(Math.max(Number(value), Number(min)), Number(max));
}

function isExpiredAt(expiresAt, requestedAt) {
  if (!expiresAt) return false;
  return toDate(expiresAt).getTime() <= toDate(requestedAt).getTime();
}

function normalizeDemandLevel(level, fallback = 'normal') {
  return DEMAND_LEVELS.includes(level) ? level : fallback;
}

function sanitizeKeyPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

function bucketTime(date, debounceSeconds) {
  if (!debounceSeconds) return toDate(date).toISOString();
  const ms = Number(debounceSeconds) * 1000;
  return new Date(Math.floor(toDate(date).getTime() / ms) * ms).toISOString();
}

function hasDemandPressure(snapshot) {
  if (!snapshot) return false;
  return (
    toNumber(snapshot.openJobs) > 0 ||
    toNumber(snapshot.searches) >= 5 ||
    toNumber(snapshot.noWorkerSearches) > 0 ||
    toNumber(snapshot.busyWorkers) > toNumber(snapshot.openWorkers)
  );
}

function getManualDemandOverride({ rule, manualOverride, requestedAt }) {
  const override = manualOverride || {};
  const demandLevel = override.demandLevel || rule?.manualDemandLevel;
  const reason = override.reason || rule?.manualOverrideReason || '';
  const active = override.active !== false && Boolean(demandLevel);
  const expired = override.expiresAt ? isExpiredAt(override.expiresAt, requestedAt) : false;

  if (!active || expired || !DEMAND_LEVELS.includes(demandLevel)) {
    return null;
  }

  return { demandLevel, reason };
}

export function evaluateDemandSnapshotState({
  snapshot,
  requestedAt = new Date(),
  maxAgeMinutes = MVP_JOB_DEFAULTS.demandSnapshotExpiryMinutes,
}) {
  if (!snapshot) {
    return {
      usable: false,
      stale: true,
      missing: true,
      lowSampleSize: false,
      reasonCodes: ['SNAPSHOT_MISSING'],
    };
  }

  const computedAt = toDate(snapshot.computedAt || snapshot.windowStart || requestedAt, requestedAt);
  const ageMinutes = Math.max(0, Math.round((toDate(requestedAt).getTime() - computedAt.getTime()) / 60000));
  const expired = snapshot.expiresAt
    ? isExpiredAt(snapshot.expiresAt, requestedAt)
    : ageMinutes > Number(maxAgeMinutes);
  const lowSampleSize = Boolean(snapshot.lowSampleSize);

  return {
    usable: !expired,
    stale: expired,
    missing: false,
    lowSampleSize,
    ageMinutes,
    reasonCodes: [
      ...(expired ? ['SNAPSHOT_STALE'] : ['SNAPSHOT_FRESH']),
      ...(lowSampleSize ? ['LOW_SAMPLE_SIZE'] : []),
    ],
  };
}

export function shouldRefreshDemandSnapshot({
  eventType,
  snapshot,
  requestedAt = new Date(),
  refreshEvents = DEMAND_REFRESH_EVENTS,
  city,
  areaId,
  serviceId,
}) {
  const state = evaluateDemandSnapshotState({ snapshot, requestedAt });
  const eventDrivenRefresh = refreshEvents.includes(eventType);
  const eventPriority = DEMAND_REFRESH_PRIORITY_BY_EVENT[eventType] || 'normal';
  const priority = eventType === 'manual_override_saved'
    ? 'immediate'
    : state.stale
      ? 'high'
      : eventDrivenRefresh
        ? eventPriority
        : 'none';
  const debounceSeconds = DEMAND_REFRESH_DEBOUNCE_SECONDS[priority];
  const aggregationKey = buildDemandRefreshAggregationKey({ city, areaId, serviceId });

  return {
    shouldRefresh: state.stale || eventDrivenRefresh,
    priority,
    transport: DEMAND_REFRESH_PUBSUB.transport,
    topic: DEMAND_REFRESH_PUBSUB.topic,
    aggregationKey,
    debounceSeconds,
    reasonCodes: [
      ...state.reasonCodes,
      ...(eventDrivenRefresh ? ['EVENT_REFRESH_REQUIRED'] : []),
      ...(eventType === 'manual_override_saved' ? ['MANUAL_OVERRIDE_REFRESH'] : []),
      ...(debounceSeconds ? ['PUBSUB_DEBOUNCE_APPLIED'] : []),
    ],
    nextRefreshBy: priority === 'immediate'
      ? toDate(requestedAt)
      : new Date(toDate(requestedAt).getTime() + Number(debounceSeconds || 0) * 1000),
  };
}

export function buildDemandRefreshAggregationKey({ city, areaId, serviceId }) {
  return [
    sanitizeKeyPart(city),
    sanitizeKeyPart(areaId),
    sanitizeKeyPart(serviceId),
  ].join('__');
}

export function buildDemandRefreshPubSubMessage({
  eventType,
  city,
  areaId,
  serviceId,
  snapshot,
  requestedAt = new Date(),
  source = 'app',
  actorRole = 'system',
  workerId = null,
  bookingId = null,
  searchId = null,
}) {
  requireValue(eventType, 'eventType');
  requireValue(city, 'city');
  requireValue(areaId, 'areaId');
  requireValue(serviceId, 'serviceId');

  const refresh = shouldRefreshDemandSnapshot({
    eventType,
    snapshot,
    requestedAt,
    city,
    areaId,
    serviceId,
  });
  const aggregationKey = refresh.aggregationKey;
  const bucket = bucketTime(requestedAt, refresh.debounceSeconds);
  const dedupeKey = [
    DEMAND_REFRESH_PUBSUB.dedupePrefix,
    aggregationKey,
    refresh.priority,
    bucket,
  ].map(sanitizeKeyPart).join('__');

  return {
    topic: DEMAND_REFRESH_PUBSUB.topic,
    orderingKey: aggregationKey,
    dedupeKey,
    firestoreQueueDocId: dedupeKey,
    attributes: {
      eventType,
      city: sanitizeKeyPart(city),
      areaId: sanitizeKeyPart(areaId),
      serviceId: sanitizeKeyPart(serviceId),
      priority: refresh.priority,
      aggregationKey,
    },
    json: {
      eventType,
      city,
      areaId,
      serviceId,
      source,
      actorRole,
      workerId,
      bookingId,
      searchId,
      requestedAt: toDate(requestedAt).toISOString(),
      priority: refresh.priority,
      debounceSeconds: refresh.debounceSeconds,
      reasonCodes: refresh.reasonCodes,
      aggregationKey,
      dedupeKey,
      nextRefreshBy: refresh.nextRefreshBy.toISOString(),
    },
    refresh,
  };
}

export function resolveDemandLevel({
  rule,
  snapshot,
  manualOverride,
  requestedAt = new Date(),
}) {
  requireValue(rule, 'rule');
  const snapshotState = evaluateDemandSnapshotState({ snapshot, requestedAt });
  const override = getManualDemandOverride({ rule, manualOverride, requestedAt });
  const reasonCodes = [...snapshotState.reasonCodes];

  if (override) {
    if (!override.reason || override.reason.trim().length < 12) {
      reasonCodes.push('MANUAL_OVERRIDE_BLOCKED_MISSING_AUDIT_REASON');
    } else {
      return {
        demandLevel: override.demandLevel,
        priceSource: 'manual_override',
        snapshotState,
        reasonCodes: [...reasonCodes, 'MANUAL_OVERRIDE_ACTIVE'],
        overrideReason: override.reason,
        manualOverrideApplied: true,
        manualOverrideReason: override.reason,
      };
    }
  }

  if (!snapshotState.usable) {
    return {
      demandLevel: 'normal',
      priceSource: snapshotState.missing ? 'missing_snapshot_fallback' : 'stale_snapshot_fallback',
      snapshotState,
      reasonCodes,
      overrideReason: '',
      manualOverrideApplied: false,
      manualOverrideReason: null,
    };
  }

  const activePoolWorkers = toNumber(snapshot.activePoolWorkers, toNumber(snapshot.openWorkers) + toNumber(snapshot.busyWorkers));
  const utilizationPercent = toNumber(snapshot.utilizationPercent, activePoolWorkers > 0
    ? Math.round((toNumber(snapshot.busyWorkers) / activePoolWorkers) * 100)
    : 0);
  const canUsePeak =
    activePoolWorkers >= toNumber(rule.minimumWorkerThreshold, MVP_JOB_DEFAULTS.minimumWorkerThreshold) &&
    utilizationPercent >= toNumber(rule.peakUtilizationPercent, MVP_JOB_DEFAULTS.peakUtilizationPercent) &&
    !snapshotState.lowSampleSize;
  const snapshotLevel = normalizeDemandLevel(snapshot.demandLevel);

  if (snapshotLevel === 'peak' && !canUsePeak) {
    return {
      demandLevel: hasDemandPressure(snapshot) ? 'high' : 'normal',
      priceSource: 'snapshot_peak_guarded',
      snapshotState,
      reasonCodes: [
        ...reasonCodes,
        'PEAK_BLOCKED_BY_SAMPLE_OR_THRESHOLD',
      ],
      overrideReason: '',
      manualOverrideApplied: false,
      manualOverrideReason: null,
    };
  }

  return {
    demandLevel: snapshotLevel,
    priceSource: 'demand_snapshot',
    snapshotState,
    reasonCodes: [
      ...reasonCodes,
      ...(snapshotLevel === 'peak' ? ['NINETY_PERCENT_RULE_CONFIRMED'] : []),
    ],
    overrideReason: '',
    manualOverrideApplied: false,
    manualOverrideReason: null,
  };
}

export function calculateMvpDemandPrice({
  serviceId,
  city,
  areaId,
  workerId,
  workerBasePrice,
  rule,
  snapshot,
  manualOverride = null,
  requestedAt = new Date(),
  quantity = 1,
}) {
  requireValue(serviceId, 'serviceId');
  requireValue(city, 'city');
  requireValue(areaId, 'areaId');
  requireValue(workerId, 'workerId');
  requireValue(rule, 'rule');

  if (rule.enabled === false) {
    throw new Error('price rule is disabled');
  }
  if (rule.serviceId !== serviceId) {
    throw new Error('price rule service mismatch');
  }
  if (rule.city !== city) {
    throw new Error('price rule city mismatch');
  }
  if (rule.areaId !== areaId) {
    throw new Error('price rule area mismatch');
  }

  const workerPrice = toNumber(workerBasePrice);
  if (workerPrice <= 0) {
    throw new Error('workerBasePrice must be positive');
  }

  const minWorkerPrice = toNumber(rule.workerMinPrice, rule.minPrice);
  const maxWorkerPrice = toNumber(rule.workerMaxPrice, rule.maxAllowedPrice);
  if (workerPrice > maxWorkerPrice) {
    throw new Error('workerBasePrice exceeds workerMaxPrice');
  }

  const quantityValue = Math.max(1, toNumber(quantity, 1));
  const adjustedWorkerPrice = clampPrice(workerPrice, minWorkerPrice, maxWorkerPrice);
  const demand = resolveDemandLevel({ rule, snapshot, manualOverride, requestedAt });
  const demandPriceField = DEMAND_PRICE_FIELDS[demand.demandLevel] || DEMAND_PRICE_FIELDS.normal;
  const demandPrice = toNumber(rule[demandPriceField], rule.normalPrice);
  const unitPrice = clampPrice(Math.max(adjustedWorkerPrice, demandPrice), rule.minPrice, rule.maxAllowedPrice);
  const finalConsumerPrice = Math.round(unitPrice * quantityValue);
  const priceLockedUntil = addMinutes(requestedAt, MVP_JOB_DEFAULTS.priceLockMinutes);
  const reasonCodes = [
    ...demand.reasonCodes,
    ...(adjustedWorkerPrice > workerPrice ? ['WORKER_PRICE_RAISED_TO_MIN'] : []),
    ...(unitPrice === toNumber(rule.maxAllowedPrice) ? ['MAX_CAP_APPLIED'] : []),
    ...(quantityValue > 1 ? ['QUANTITY_APPLIED'] : []),
  ];
  const explanationConsumer = buildConsumerExplanation({
    demandLevel: demand.demandLevel,
    priceSource: demand.priceSource,
    reasonCodes,
    priceLockedUntil,
  });
  const explanationWorker = buildWorkerExplanation({
    workerPrice,
    adjustedWorkerPrice,
    demandLevel: demand.demandLevel,
    finalConsumerPrice,
  });

  const evidence = buildBookingPricingEvidence({
    serviceId,
    city,
    areaId,
    unitType: rule.unitType,
    workerId,
    workerBasePrice: workerPrice,
    rule,
    snapshot,
    finalConsumerPrice,
    workerReceivable: finalConsumerPrice,
    priceSource: demand.priceSource,
    explanation: explanationConsumer,
    reasonCodes,
    calculatedAt: requestedAt,
    priceLockedUntil,
  });

  return {
    ...evidence,
    demandLevel: demand.demandLevel,
    confidence: demand.snapshotState.stale ? 'low' : snapshot?.confidence || 'medium',
    lowSampleSize: demand.snapshotState.lowSampleSize,
    manualOverrideApplied: Boolean(demand.manualOverrideApplied),
    manualOverrideReason: demand.manualOverrideReason || null,
    overrideHierarchy: MVP_MANUAL_OVERRIDE_HIERARCHY,
    quantity: quantityValue,
    unitPrice,
    adjustedWorkerPrice,
    workerPriceStatus: adjustedWorkerPrice > workerPrice ? 'raised_to_min' : 'accepted',
    priceSource: demand.priceSource,
    explanationConsumer,
    explanationWorker,
    snapshotRefresh: shouldRefreshDemandSnapshot({
      eventType: 'booking_requested',
      snapshot,
      requestedAt,
      city,
      areaId,
      serviceId,
    }),
  };
}

function buildConsumerExplanation({ demandLevel, priceSource, reasonCodes, priceLockedUntil }) {
  if (priceSource === 'stale_snapshot_fallback' || priceSource === 'missing_snapshot_fallback') {
    return `Normal area price. Worker receives the full customer price during launch. Price locked until ${priceLockedUntil.toISOString()}.`;
  }
  if (demandLevel === 'peak') {
    return `Peak demand now. Most nearby workers are already busy. Worker receives the full customer price during launch. Price locked until ${priceLockedUntil.toISOString()}.`;
  }
  if (demandLevel === 'high') {
    return `High demand now because few workers are open nearby. Worker receives the full customer price during launch. Price locked until ${priceLockedUntil.toISOString()}.`;
  }
  if (demandLevel === 'low') {
    return `Normal local price. Worker receives the full customer price during launch. Price locked until ${priceLockedUntil.toISOString()}.`;
  }
  if (reasonCodes.includes('MANUAL_OVERRIDE_ACTIVE')) {
    return `Current area demand price is active. Worker receives the full customer price during launch. Price locked until ${priceLockedUntil.toISOString()}.`;
  }
  return `Normal area price. Worker receives the full customer price during launch. Price locked until ${priceLockedUntil.toISOString()}.`;
}

function buildWorkerExplanation({ workerPrice, adjustedWorkerPrice, demandLevel, finalConsumerPrice }) {
  if (adjustedWorkerPrice > workerPrice) {
    return `Your entered price was below the local minimum, so this quote uses INR ${adjustedWorkerPrice}. You receive INR ${finalConsumerPrice} during launch.`;
  }
  if (demandLevel === 'high' || demandLevel === 'peak') {
    return `Demand is ${demandLevel} in this area now. You receive the full INR ${finalConsumerPrice} during launch.`;
  }
  return `You receive the full INR ${finalConsumerPrice} during launch.`;
}
