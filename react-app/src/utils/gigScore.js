export const GIG_SCORE_MIN = 0;
export const GIG_SCORE_MAX = 1000;
export const GIG_SCORE_INACTIVITY_FLOOR = 450;
export const WORKER_START_SCORE = 450;
export const WORKER_READY_SCORE = 500;

export const GIG_SCORE_EVENT_STATUS = {
  PENDING: 'pending',
  FINALIZED: 'finalized',
  REVERSED: 'reversed',
};

export const GIG_SCORE_ACCOUNT_STATUS = {
  ACTIVE: 'active',
  RISK_PENDING: 'risk_pending',
  SCORE_FROZEN: 'score_frozen',
  WORK_FROZEN: 'work_frozen',
  BOOKING_FROZEN: 'booking_frozen',
};

export const GIG_SCORE_CAPS = {
  dailyPositive: 40,
  monthlyPositive: 160,
  monthlyTipPositive: 40,
};

export const DEFAULT_GIG_SCORE_SETTINGS = {
  copperThreshold: 450,
  recoveryDiscountPercent: 10,
  workerFreezeBelow: 300,
  workerRecoveryBelow: 400,
  inactivityFloor: GIG_SCORE_INACTIVITY_FLOOR,
  inactivityDecayAfterDays: 10,
  workerInactivityDecay: -5,
  consumerInactivityDecay: -2,
  diamondWorkerOptionalPriceIncreasePercent: 10,
  eliteConsumerMinimumRealConsumers: 3000,
  eliteConsumerDiscountPercent: 25,
  eliteConsumerMonthlyBookingLimit: 8,
  guildMinMembers: 3,
  guildMaxMembers: 6,
  guildDiamondShieldDays: 7,
};

export const DEFAULT_GIG_SCORE_FEATURE_FLAGS = {
  gigScore: true,
  guilds: true,
  elite: false,
  subscriptions: true,
  payments: false,
  rewards: false,
  aiAssistant: true,
  notifications: false,
  workerPayouts: false,
};

export const GIG_TIERS = [
  { name: 'Copper', min: 0, max: 399, color: '#b45309' },
  { name: 'Bronze', min: 400, max: 599, color: '#92400e' },
  { name: 'Silver', min: 600, max: 749, color: '#64748b' },
  { name: 'Gold', min: 750, max: 899, color: '#ca8a04' },
  { name: 'Diamond', min: 900, max: 1000, color: '#0891b2' },
];

export const GIG_SCORE_REASON_CODES = {
  FIVE_STAR_JOB: 'five_star_job',
  FOUR_STAR_JOB: 'four_star_job',
  TWO_STAR_ISSUE: 'two_star_issue',
  ONE_STAR_ISSUE: 'one_star_issue',
  WORKER_FAULT_DISPUTE: 'worker_fault_dispute',
  WORKER_CANCELLATION_RISKY: 'worker_cancellation_risky',
  WORKER_NO_SHOW: 'worker_no_show',
  LATE_NO_UPDATE: 'late_no_update',
  ON_TIME_COMPLETION: 'on_time_completion',
  COMPLETED_BOOKING: 'completed_booking',
  FAIR_RATING_SUBMITTED: 'fair_rating_submitted',
  HELPFUL_REVIEW_PHOTO: 'helpful_review_photo',
  PAYMENT_ON_TIME: 'payment_on_time',
  PAYMENT_LATE_OR_MISSING: 'payment_late_or_missing',
  RECURRING_WEEKLY: 'recurring_weekly',
  RECURRING_MONTHLY: 'recurring_monthly',
  RECURRING_MILESTONE: 'recurring_milestone',
  IN_APP_TIP: 'in_app_tip',
  COMPLETION_PHOTO: 'completion_photo',
  GUILD_RIPPLE: 'guild_ripple',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  INACTIVITY_DECAY: 'inactivity_decay',
  SAME_PAIR_LIMIT: 'same_pair_limit',
};

const SEVERE_REASON_CODES = new Set([
  GIG_SCORE_REASON_CODES.WORKER_FAULT_DISPUTE,
  'fraud',
  'safety_issue',
  'repeated_no_show',
]);

export function clampGigScore(score) {
  return Math.max(GIG_SCORE_MIN, Math.min(GIG_SCORE_MAX, Math.round(Number(score) || 0)));
}

export function getGigScoreValue(entity = {}, fallback = WORKER_READY_SCORE) {
  return clampGigScore(entity.gigScore ?? entity.socioScore ?? fallback);
}

export function getTierFromScore(score) {
  const value = clampGigScore(score);
  if (value >= 900) return 'Diamond';
  if (value >= 750) return 'Gold';
  if (value >= 600) return 'Silver';
  if (value >= 400) return 'Bronze';
  return 'Copper';
}

export function getTierMeta(score) {
  const value = clampGigScore(score);
  return GIG_TIERS.find((tier) => value >= tier.min && value <= tier.max) || GIG_TIERS[0];
}

export function getTierDisplay({ score, role = 'worker', status = GIG_SCORE_ACCOUNT_STATUS.ACTIVE }) {
  const tier = getTierMeta(score);
  const restricted = getScoreRestriction({ role, score, status });
  if (tier.name === 'Copper') {
    return {
      ...tier,
      publicName: ['frozen', 'score_frozen', 'work_frozen'].includes(restricted.level) ? 'Review recovery' : 'Recovery',
      tone: 'recovery',
      description: role === 'worker'
        ? 'Recovery mode with clear next steps, training, and clean-job targets.'
        : 'Recovery mode with fair-use guidance and clean booking targets.',
    };
  }
  return {
    ...tier,
    publicName: tier.name,
    tone: tier.name.toLowerCase(),
    description: `${tier.name} trust tier based on finalized GigScore.`,
  };
}

export function getPointsToNextTier(score) {
  const value = clampGigScore(score);
  const next = GIG_TIERS.find((tier) => tier.min > value);
  return next ? next.min - value : 0;
}

export function applyInactivityFloor({ oldScore, delta, reasonCode }) {
  const previous = clampGigScore(oldScore);
  const change = Number(delta) || 0;
  const raw = previous + change;

  if (reasonCode === GIG_SCORE_REASON_CODES.INACTIVITY_DECAY && raw < GIG_SCORE_INACTIVITY_FLOOR) {
    return GIG_SCORE_INACTIVITY_FLOOR;
  }

  return clampGigScore(raw);
}

export function getLazyInactivityDecayEvent({
  role = 'consumer',
  score = WORKER_READY_SCORE,
  lastActiveAt,
  now = new Date(),
  settings = DEFAULT_GIG_SCORE_SETTINGS,
} = {}) {
  if (!lastActiveAt) {
    return { shouldApply: false, delta: 0, reasonCode: GIG_SCORE_REASON_CODES.INACTIVITY_DECAY };
  }

  const lastActiveDate = lastActiveAt?.toDate ? lastActiveAt.toDate() : new Date(lastActiveAt);
  const nowDate = now?.toDate ? now.toDate() : new Date(now);
  if (Number.isNaN(lastActiveDate.getTime()) || Number.isNaN(nowDate.getTime()) || nowDate <= lastActiveDate) {
    return { shouldApply: false, delta: 0, reasonCode: GIG_SCORE_REASON_CODES.INACTIVITY_DECAY };
  }

  const inactiveDays = Math.floor((nowDate.getTime() - lastActiveDate.getTime()) / 86400000);
  const decayWindows = Math.floor(inactiveDays / Number(settings.inactivityDecayAfterDays || 10));
  if (decayWindows <= 0) {
    return {
      shouldApply: false,
      delta: 0,
      inactiveDays,
      reasonCode: GIG_SCORE_REASON_CODES.INACTIVITY_DECAY,
    };
  }

  const perWindowDelta = role === 'worker'
    ? Number(settings.workerInactivityDecay || -5)
    : Number(settings.consumerInactivityDecay || -2);
  const rawDelta = perWindowDelta * decayWindows;
  const currentScore = clampGigScore(score);
  const nextScore = applyInactivityFloor({
    oldScore: currentScore,
    delta: rawDelta,
    reasonCode: GIG_SCORE_REASON_CODES.INACTIVITY_DECAY,
  });
  const effectiveDelta = nextScore - currentScore;

  return {
    shouldApply: effectiveDelta !== 0,
    delta: effectiveDelta,
    rawDelta,
    oldScore: currentScore,
    newScore: nextScore,
    inactiveDays,
    decayWindows,
    reasonCode: GIG_SCORE_REASON_CODES.INACTIVITY_DECAY,
    reasonText: `Inactive for ${inactiveDays} days; normal inactivity decay is capped at ${settings.inactivityFloor || GIG_SCORE_INACTIVITY_FLOOR}.`,
    improvementAdvice: 'Open the app and complete clean bookings or jobs to keep GigScore active.',
  };
}

export function getRecoveryAdvice({ score, role = 'worker', recentEvents = [] }) {
  const tier = getTierFromScore(score);
  const hasPenalty = recentEvents.some((event) => Number(event.delta) < 0);

  if (role === 'worker' && Number(score) < 300) {
    return 'Account needs review. Superadmin or field operator can unlock a recovery path.';
  }

  if (role === 'worker' && Number(score) < 400) {
    return 'Recovery mode: finish training, keep proof photos, and complete 3 clean jobs.';
  }

  if (tier === 'Copper') {
    return role === 'worker'
      ? 'Complete training plus 3 clean jobs to recover toward Bronze/Silver.'
      : 'Complete clean bookings, pay on time, and submit fair feedback to recover.';
  }

  if (hasPenalty) {
    return 'Keep the next jobs clean and issue-free; finalized positive points can repair the drop.';
  }

  const points = getPointsToNextTier(score);
  return points > 0 ? `${points} points to ${GIG_TIERS.find((tierDef) => tierDef.min > score)?.name}.` : 'Diamond tier active. Keep quality stable.';
}

export function getScoreChangeAdvice(event = {}) {
  const code = event.reasonCode || '';
  const delta = Number(event.delta || 0);

  if (code.includes('late_no_update')) return 'Improve: send an update before delay becomes a complaint.';
  if (code.includes('worker_cancellation')) return 'Improve: accept only jobs you can complete and keep the next 3 jobs clean.';
  if (code.includes('worker_no_show')) return 'Improve: confirm travel early; repeated no-show can freeze work access.';
  if (code.includes('one_star')) return 'Improve: keep before/after proof and resolve the issue through support review.';
  if (code.includes('two_star')) return 'Improve: review service checklist and upload clear completion photos.';
  if (code.includes('payment_late')) return 'Improve: clear dues on time to keep booking benefits active.';
  if (code.includes('completion_photo')) return 'Good habit: proof photos protect your score during disputes.';
  if (code.includes('recurring')) return 'Keep clean recurring bookings to unlock stable trust growth.';
  if (code.includes('tip')) return 'Tip points are capped so rewards stay fair.';
  if (delta < 0) return 'Recovery: complete clean jobs and avoid repeat issues to repair this drop.';
  if (delta > 0) return 'Keep this pattern consistent; clean proof-backed work grows GigScore safely.';
  return 'No score movement. Keep the next booking clean and documented.';
}

export function getVisibleDailyScoreEvents({ events = [], now = new Date() }) {
  const end = new Date(now);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);

  return events
    .filter((event) => {
      const created = event.createdAt?.toDate ? event.createdAt.toDate() : new Date(event.createdAt || 0);
      return created >= start && created <= end;
    })
    .map((event) => ({
      ...event,
      improvementAdvice: event.improvementAdvice || getScoreChangeAdvice(event),
    }));
}

export function getScoreRestriction({ role = 'worker', score = WORKER_READY_SCORE, status = GIG_SCORE_ACCOUNT_STATUS.ACTIVE }) {
  const value = clampGigScore(score);
  if ([GIG_SCORE_ACCOUNT_STATUS.WORK_FROZEN, GIG_SCORE_ACCOUNT_STATUS.BOOKING_FROZEN].includes(status)) {
    return { restricted: true, level: 'frozen', reason: 'Account is frozen for review.', nextAction: 'Contact support or wait for superadmin review.' };
  }
  if (status === GIG_SCORE_ACCOUNT_STATUS.SCORE_FROZEN) {
    return { restricted: true, level: 'score_frozen', reason: 'Score cannot increase until review is complete.', nextAction: 'Resolve pending review items.' };
  }
  if (role === 'worker' && value < 300) {
    return { restricted: true, level: 'work_frozen', reason: 'Worker score is below 300.', nextAction: 'Field operator or superadmin review is required.' };
  }
  if (role === 'worker' && value < 400) {
    return { restricted: false, level: 'recovery', reason: 'Worker is in recovery pricing/training mode.', nextAction: 'Complete training and 3 clean jobs.' };
  }
  return { restricted: false, level: 'normal', reason: 'GigScore status is normal.', nextAction: 'Keep quality stable.' };
}

export function getFinalizedScoreView({ score = 0, events = [], role = 'worker', status = GIG_SCORE_ACCOUNT_STATUS.ACTIVE }) {
  const visible = getVisibleDailyScoreEvents({ events });
  const pendingDelta = events
    .filter((event) => event.status === GIG_SCORE_EVENT_STATUS.PENDING)
    .reduce((sum, event) => sum + Number(event.delta || 0), 0);
  const finalizedScore = clampGigScore(score);
  return {
    currentFinalizedScore: finalizedScore,
    pendingDelta,
    scoreAtRisk: pendingDelta < 0 ? Math.abs(pendingDelta) : 0,
    tier: getTierFromScore(finalizedScore),
    tierDisplay: getTierDisplay({ score: finalizedScore, role, status }),
    yesterdayToTodayEvents: visible,
    recoveryPath: getRecoveryAdvice({ score: finalizedScore, role, recentEvents: visible }),
  };
}

export function getScorePsychologyMessage({ type = 'reinforcement', delta = 0, score = 0, role = 'worker' }) {
  const pointsToNextTier = getPointsToNextTier(score);
  const nextTier = GIG_TIERS.find((tier) => tier.min > Number(score || 0))?.name || 'Diamond';
  if (type === 'loss_aversion') {
    return role === 'worker'
      ? 'Cancelling after accepting can reduce GigScore and delay better work access.'
      : 'Cancelling too late can reduce GigScore and delay trust benefits.';
  }
  if (type === 'recovery') {
    return role === 'worker'
      ? 'Complete training plus 3 clean jobs to rebuild trust.'
      : 'Complete clean bookings, pay on time, and give fair feedback to rebuild trust.';
  }
  return `${Number(delta) >= 0 ? '+' : ''}${Number(delta || 0)} added. ${pointsToNextTier || 0} points to ${nextTier}.`;
}

export function shouldFreezeConsumerForOneStarPattern({
  oneStarCount30Days = 0,
  oneStarRate60Days = 0,
  reversedWeakOneStarCount = 0,
}) {
  return Number(oneStarCount30Days) >= 3 ||
    Number(oneStarRate60Days) >= 0.4 ||
    Number(reversedWeakOneStarCount) >= 2;
}

export function getGigScoreFraudRiskDecision({
  samePairPositiveEventsThisWeek = 0,
  sameDeviceAccounts30Days = 0,
  newPairJobs7Days = 0,
  tinyJobFarming30Days = 0,
  photoReuseCount = 0,
  impossibleTravelSignals = 0,
  refundRequests30Days = 0,
  oneStarAttackSignals = 0,
} = {}) {
  const signals = [];
  if (Number(samePairPositiveEventsThisWeek) > 2) signals.push('same_pair_farming');
  if (Number(sameDeviceAccounts30Days) >= 3) signals.push('device_or_payment_cluster');
  if (Number(newPairJobs7Days) >= 3) signals.push('new_pair_fast_loop');
  if (Number(tinyJobFarming30Days) >= 3) signals.push('tiny_job_farming');
  if (Number(photoReuseCount) >= 2) signals.push('photo_reuse');
  if (Number(impossibleTravelSignals) >= 1) signals.push('impossible_travel');
  if (Number(refundRequests30Days) >= 3) signals.push('refund_loop');
  if (Number(oneStarAttackSignals) >= 2) signals.push('one_star_attack');

  return {
    riskPending: signals.length > 0,
    scoreFrozen: signals.length >= 2 || signals.includes('one_star_attack') || signals.includes('refund_loop'),
    signals,
    action: signals.length >= 2 ? 'freeze_score_and_review' : signals.length === 1 ? 'risk_pending_review' : 'allow',
  };
}

export function validateGigScoreServerWrite(event = {}) {
  const errors = [];
  if (!event.actorId) errors.push('actorId_required');
  if (!event.actorRole) errors.push('actorRole_required');
  if (!event.reasonCode) errors.push('reasonCode_required');
  if (!Object.values(GIG_SCORE_EVENT_STATUS).includes(event.status || GIG_SCORE_EVENT_STATUS.PENDING)) errors.push('invalid_status');
  if (Math.abs(Number(event.delta || 0)) > 100 && event.reasonCode !== 'manual_adjustment') errors.push('large_delta_needs_manual_adjustment');
  return { valid: errors.length === 0, errors };
}

export function getWalletDebtGigScorePolicy({ platformFeeDue = 0, automationEnabled = false } = {}) {
  const limited = Number(platformFeeDue) > 100;
  return {
    limitedToOneJobPerDay: limited,
    dailyScorePenalty: limited && automationEnabled ? -5 : 0,
    requiresDiscussionBeforeAutomation: !automationEnabled,
    message: limited
      ? 'Wallet debt above Rs 100 limits work access; daily GigScore penalty needs explicit rollout approval.'
      : 'Wallet health is normal.',
  };
}

export function getVerifiedHelperRewardPolicy({ reachedSosLocation = false, verifiedBySupport = false } = {}) {
  const eligible = Boolean(reachedSosLocation && verifiedBySupport);
  return {
    eligible,
    delta: eligible ? 5 : 0,
    status: eligible ? GIG_SCORE_EVENT_STATUS.PENDING : GIG_SCORE_EVENT_STATUS.REVERSED,
    reasonCode: 'verified_sos_helper',
    rule: 'Nearby helper GigScore reward requires support verification before finalization.',
  };
}

export function getAiPhotoQualityScorePolicy({ aiSignal = 'neutral', humanVerified = false } = {}) {
  const positive = aiSignal === 'clean_completion_photo';
  const negative = ['reused_photo', 'missing_after_photo', 'suspicious_photo'].includes(aiSignal);
  return {
    canAffectScore: humanVerified && (positive || negative),
    delta: !humanVerified ? 0 : positive ? 2 : negative ? -5 : 0,
    status: humanVerified ? GIG_SCORE_EVENT_STATUS.FINALIZED : GIG_SCORE_EVENT_STATUS.PENDING,
    rule: 'AI photo quality can suggest score impact, but human/support verification is required for final score movement.',
  };
}

export function getWorkerRatingDelta(rating) {
  const stars = Number(rating);
  if (stars === 5) return 8;
  if (stars === 4) return 4;
  if (stars === 3) return 0;
  if (stars === 2) return -5;
  if (stars === 1) return -20;
  throw new Error('rating must be from 1 to 5');
}

export function getConsumerRatingDelta(rating) {
  const stars = Number(rating);
  if (stars === 5) return 5;
  if (stars === 4) return 3;
  if (stars >= 1 && stars <= 3) return 0;
  throw new Error('rating must be from 1 to 5');
}

export function getPenaltyDampening({ tier, reasonCode, severe = false }) {
  if (severe || SEVERE_REASON_CODES.has(reasonCode)) return 1;
  if (tier === 'Diamond') return 0.6;
  if (tier === 'Gold') return 0.8;
  return 1;
}

export function applyTierPenaltyDampening({ oldScore, delta, reasonCode, severe = false }) {
  const change = Number(delta) || 0;
  if (change >= 0) return change;
  const multiplier = getPenaltyDampening({
    tier: getTierFromScore(oldScore),
    reasonCode,
    severe,
  });
  return Math.round(change * multiplier);
}

export function getRecurringConsumerBonus({ cadence = 'weekly', cleanCompletionsInStreak = 1 }) {
  const normalized = cadence === 'monthly' ? 'monthly' : 'weekly';
  const streak = Math.max(1, Number(cleanCompletionsInStreak) || 1);
  const milestoneBonus = streak >= 4 && streak % 4 === 0 ? 20 : 0;

  return {
    reasonCode: normalized === 'monthly'
      ? GIG_SCORE_REASON_CODES.RECURRING_MONTHLY
      : GIG_SCORE_REASON_CODES.RECURRING_WEEKLY,
    baseDelta: 10,
    milestoneDelta: milestoneBonus,
    totalDelta: 10 + milestoneBonus,
    milestoneReached: milestoneBonus > 0,
  };
}

export function getTipScoreDeltas({ tipAmount = 0, consumerCap = 10, workerCap = 5 }) {
  const tip = Math.max(0, Number(tipAmount) || 0);
  return {
    consumerDelta: Math.min(Math.floor(tip / 10), consumerCap),
    workerDelta: Math.min(Math.floor(tip / 20), workerCap),
  };
}

export function getSamePairPositiveMultiplier({ weeklyPositiveCount = 0, monthlyPositiveCount = 0 }) {
  if (Number(weeklyPositiveCount) >= 2 || Number(monthlyPositiveCount) >= 3) return 0;
  if (Number(monthlyPositiveCount) === 0) return 1;
  if (Number(monthlyPositiveCount) === 1) return 0.6;
  if (Number(monthlyPositiveCount) === 2) return 0.3;
  return 0;
}

export function buildGigScoreEvent({
  actorId,
  actorRole,
  bookingId,
  guildId = null,
  reasonCode,
  reasonText,
  oldScore,
  delta,
  status = GIG_SCORE_EVENT_STATUS.PENDING,
  createdAt = new Date(),
  metadata = {},
}) {
  if (!actorId) throw new Error('actorId is required');
  if (!actorRole) throw new Error('actorRole is required');
  if (!bookingId) throw new Error('bookingId is required');
  if (!reasonCode) throw new Error('reasonCode is required');

  const previous = clampGigScore(oldScore);
  const change = Number(delta) || 0;
  const newScore = applyInactivityFloor({ oldScore: previous, delta: change, reasonCode });

  return {
    scoreSystem: 'gig_score',
    actorId,
    actorRole,
    bookingId,
    guildId,
    reasonCode,
    reasonText: reasonText || reasonCode,
    oldScore: previous,
    delta: change,
    newScore,
    oldTier: getTierFromScore(previous),
    newTier: getTierFromScore(newScore),
    status,
    createdAt,
    finalizedAt: status === GIG_SCORE_EVENT_STATUS.FINALIZED ? createdAt : null,
    fraudReviewState: 'not_required',
    metadata,
  };
}

export function buildDailyScoreDigest({ events = [], currentScore = 0, role = 'worker', date = new Date() }) {
  const finalized = events.filter((event) => event.status === GIG_SCORE_EVENT_STATUS.FINALIZED);
  const pending = events.filter((event) => event.status === GIG_SCORE_EVENT_STATUS.PENDING);
  const finalizedDelta = finalized.reduce((sum, event) => sum + Number(event.delta || 0), 0);
  const pendingDelta = pending.reduce((sum, event) => sum + Number(event.delta || 0), 0);
  const positiveReasons = events.filter((event) => Number(event.delta || 0) > 0).map((event) => event.reasonText || event.reasonCode);
  const negativeReasons = events.filter((event) => Number(event.delta || 0) < 0).map((event) => event.reasonText || event.reasonCode);

  return {
    date,
    currentScore: clampGigScore(currentScore),
    tier: getTierFromScore(currentScore),
    pointsToNextTier: getPointsToNextTier(currentScore),
    finalizedDelta,
    pendingDelta,
    positiveReasons,
    negativeReasons,
    recoveryAdvice: getRecoveryAdvice({ score: currentScore, role, recentEvents: events }),
  };
}

export function buildRatingScoreEvents({
  booking,
  rating,
  workerOldScore = WORKER_READY_SCORE,
  consumerOldScore = 0,
}) {
  if (!booking) throw new Error('booking is required');
  const workerId = booking.assignedWorkerId || booking.workerId || booking.adminId;
  const consumerId = booking.userId || booking.consumerId;
  if (!workerId) throw new Error('booking must have assignedWorkerId');
  if (!consumerId) throw new Error('booking must have userId');

  const workerDelta = getWorkerRatingDelta(rating);
  const consumerDelta = getConsumerRatingDelta(rating);
  const status = Number(rating) <= 2 ? GIG_SCORE_EVENT_STATUS.PENDING : GIG_SCORE_EVENT_STATUS.FINALIZED;
  const ratingValue = Number(rating);
  const workerReasonCode = ratingValue >= 5
    ? GIG_SCORE_REASON_CODES.FIVE_STAR_JOB
    : ratingValue === 4
      ? GIG_SCORE_REASON_CODES.FOUR_STAR_JOB
      : ratingValue <= 1
        ? GIG_SCORE_REASON_CODES.ONE_STAR_ISSUE
        : ratingValue === 2
          ? GIG_SCORE_REASON_CODES.TWO_STAR_ISSUE
          : GIG_SCORE_REASON_CODES.COMPLETED_BOOKING;

  return [
    buildGigScoreEvent({
      actorId: workerId,
      actorRole: 'worker',
      bookingId: booking.id,
      guildId: booking.guildId || null,
      reasonCode: workerReasonCode,
      reasonText: `Consumer gave ${rating}-star feedback for completed work.`,
      oldScore: workerOldScore,
      delta: workerDelta,
      status,
    }),
    buildGigScoreEvent({
      actorId: consumerId,
      actorRole: 'consumer',
      bookingId: booking.id,
      reasonCode: GIG_SCORE_REASON_CODES.FAIR_RATING_SUBMITTED,
      reasonText: `Submitted ${rating}-star feedback after service completion.`,
      oldScore: consumerOldScore,
      delta: consumerDelta,
      status,
    }),
  ];
}

export function calculateGuildScore({
  members = [],
  guildBehaviorBonus = 0,
  guildRiskPenalty = 0,
  now = new Date(),
}) {
  const weightedMembers = members.map((member) => {
    const completedJobs = Number(member.completedJobs || 0);
    const joinedAt = member.joinedAt ? new Date(member.joinedAt) : null;
    const daysSinceJoin = joinedAt ? Math.max(0, (now.getTime() - joinedAt.getTime()) / 86400000) : 999;
    let weight = 1;
    let protectionState = 'full';

    if (completedJobs < 5 || daysSinceJoin < 30) {
      weight = 0;
      protectionState = 'protected_first_5_jobs';
    } else if (daysSinceJoin < 60) {
      weight = 0.5;
      protectionState = 'recent_half_weight';
    }

    return {
      ...member,
      score: clampGigScore(member.score ?? member.gigScore ?? member.socioScore ?? 0),
      weight,
      protectionState,
    };
  });

  const included = weightedMembers.filter((member) => member.weight > 0);
  const weightTotal = included.reduce((sum, member) => sum + member.weight, 0);
  const baseScore = weightTotal
    ? included.reduce((sum, member) => sum + member.score * member.weight, 0) / weightTotal
    : 0;
  const guildScore = clampGigScore(Math.round(baseScore + Number(guildBehaviorBonus || 0) - Number(guildRiskPenalty || 0)));

  return {
    guildScore,
    guildTier: getTierFromScore(guildScore),
    memberCount: members.length,
    includedMemberCount: included.length,
    protectedMemberCount: weightedMembers.filter((member) => member.weight === 0).length,
    members: weightedMembers,
  };
}

export function validateGuildMembership({ memberCount = 0, settings = DEFAULT_GIG_SCORE_SETTINGS } = {}) {
  const count = Number(memberCount) || 0;
  return {
    valid: count >= settings.guildMinMembers && count <= settings.guildMaxMembers,
    minMembers: settings.guildMinMembers,
    maxMembers: settings.guildMaxMembers,
    reason: count < settings.guildMinMembers
      ? `Guild needs at least ${settings.guildMinMembers} workers.`
      : count > settings.guildMaxMembers
        ? `Guild can have at most ${settings.guildMaxMembers} workers.`
        : 'Guild size is valid.',
  };
}

export function getGuildDiamondShieldState({
  previousTier,
  newTier,
  shieldStartedAt,
  now = new Date(),
  fraudOrSafetyIssue = false,
  settings = DEFAULT_GIG_SCORE_SETTINGS,
} = {}) {
  if (fraudOrSafetyIssue) {
    return { shieldActive: false, downgradeAllowed: true, reason: 'Fraud or safety issue pauses Diamond shield.' };
  }
  if (previousTier !== 'Diamond' || newTier === 'Diamond') {
    return { shieldActive: false, downgradeAllowed: false, reason: 'No Diamond downgrade shield needed.' };
  }
  const started = shieldStartedAt ? new Date(shieldStartedAt) : new Date(now);
  const ageDays = Math.max(0, (new Date(now).getTime() - started.getTime()) / 86400000);
  const shieldActive = ageDays < settings.guildDiamondShieldDays;
  return {
    shieldActive,
    downgradeAllowed: !shieldActive,
    daysRemaining: shieldActive ? Math.ceil(settings.guildDiamondShieldDays - ageDays) : 0,
    reason: shieldActive
      ? 'Diamond guild shield is active for ordinary score movement.'
      : 'Diamond guild shield expired; downgrade can apply.',
  };
}

export function getGuildJoinPreview({ requester = {}, guild = {} }) {
  const memberCount = Number(guild.memberCount || guild.members?.length || 0);
  const validation = validateGuildMembership({ memberCount: memberCount + 1 });
  return {
    requesterId: requester.id || requester.uid || null,
    requesterName: requester.name || requester.displayName || 'Worker',
    requesterTier: requester.gigScoreTier || getTierFromScore(requester.gigScore ?? requester.socioScore ?? WORKER_START_SCORE),
    requesterScore: clampGigScore(requester.gigScore ?? requester.socioScore ?? WORKER_START_SCORE),
    serviceType: requester.serviceType || requester.gigTypes?.[0] || 'not_set',
    city: requester.locationCity || requester.city || guild.city || '',
    recentRiskFlags: requester.recentRiskFlags || [],
    firstFiveJobsProtected: Number(requester.completedJobs || 0) < 5,
    canJoin: validation.valid,
    validation,
  };
}

export function getGuildPricingRule(guildTier) {
  if (guildTier === 'Diamond') {
    return { priceMultiplier: 1.1, rankingBoost: 'first_when_nearby_and_fit', label: 'Diamond guild priority' };
  }
  if (guildTier === 'Copper') {
    return { priceMultiplier: 0.9, rankingBoost: 'recovery_only', label: 'Copper recovery price' };
  }
  if (guildTier === 'Gold') {
    return { priceMultiplier: 1, rankingBoost: 'trust_boost', label: 'Gold trust badge' };
  }
  return { priceMultiplier: 1, rankingBoost: 'normal', label: `${guildTier || 'Standard'} guild` };
}

export function getTierBenefit({ role, tier, isGuild = false, isElite = false, monthlyEliteBookingsUsed = 0 }) {
  if (role === 'consumer' && isElite) {
    const withinLimit = Number(monthlyEliteBookingsUsed) < 8;
    return {
      platformFeeFree: withinLimit,
      discountPercent: withinLimit ? 25 : 0,
      monthlyBookingLimit: 8,
      note: withinLimit
        ? 'Elite consumer gets 25% off and no platform fee for eligible monthly bookings.'
        : 'Elite monthly benefit limit reached; normal pricing applies.',
    };
  }
  if (role === 'consumer' && tier === 'Diamond') {
    return { platformFeeFree: false, discountPercent: 0, note: 'Diamond consumer has trust status; discount unlocks only through Elite.' };
  }
  if (role === 'worker' && tier === 'Diamond') {
    return { platformFeeFree: true, optionalPriceIncreasePercent: 10, note: 'Diamond worker can optionally enable +10% future-job pricing.' };
  }
  if (isGuild && tier === 'Diamond') {
    return { platformFeeFree: false, priceMultiplier: 1.1, recommendation: 'priority_when_fit', note: 'Diamond guild can charge 10% higher and be recommended first when fit.' };
  }
  if (tier === 'Copper') {
    return { platformFeeFree: false, discountPercent: 10, note: 'Copper recovery/intro pricing can show 10% discount when enabled.' };
  }
  return { platformFeeFree: false, discountPercent: 0, note: `${tier || 'Standard'} tier has normal pricing.` };
}

export function getWorkerTierPolicy({ score = WORKER_READY_SCORE, diamondPriceIncreaseEnabled = false } = {}) {
  const tier = getTierFromScore(score);
  const restriction = getScoreRestriction({ role: 'worker', score });
  const tierBenefit = getTierBenefit({ role: 'worker', tier });
  return {
    tier,
    restriction,
    canEditFuturePrice: true,
    priceChangeAppliesTo: 'future_unaccepted_jobs_only',
    canChangeAcceptedBookingPrice: false,
    diamondPriceIncreaseEnabled: tier === 'Diamond' && Boolean(diamondPriceIncreaseEnabled),
    optionalPriceIncreasePercent: tier === 'Diamond' ? tierBenefit.optionalPriceIncreasePercent : 0,
    recoveryDiscountPercent: restriction.level === 'recovery' ? DEFAULT_GIG_SCORE_SETTINGS.recoveryDiscountPercent : 0,
    eliteEligibleForReview: tier === 'Diamond' && restriction.level === 'normal',
  };
}

export function getConsumerTierPolicy({
  score = 0,
  isElite = false,
  monthlyEliteBookingsUsed = 0,
  realConsumerCount = 0,
} = {}) {
  const tier = getTierFromScore(score);
  const eliteOpen = Number(realConsumerCount) >= DEFAULT_GIG_SCORE_SETTINGS.eliteConsumerMinimumRealConsumers;
  const benefit = getTierBenefit({
    role: 'consumer',
    tier,
    isElite: isElite && eliteOpen,
    monthlyEliteBookingsUsed,
  });
  return {
    tier,
    eliteOpen,
    discountEligibility: benefit.discountPercent || 0,
    platformFeeFree: Boolean(benefit.platformFeeFree),
    fairUseWarning: 'Late cancellation, fake complaint, or payment abuse can pause benefits for review.',
    note: benefit.note,
  };
}

export function buildCopperMonitorSummary({ consumers = [], workers = [], guilds = [], threshold = 400 }) {
  const isCopper = (item) => Number(item.score ?? item.guildScore ?? 0) < threshold;
  const copperConsumers = consumers.filter(isCopper);
  const copperWorkers = workers.filter(isCopper);
  const copperGuilds = guilds.filter(isCopper);

  return {
    threshold,
    copperConsumersCount: copperConsumers.length,
    copperWorkersCount: copperWorkers.length,
    copperGuildsCount: copperGuilds.length,
    copperConsumers,
    copperWorkers,
    copperGuilds,
    needsAttention: copperConsumers.length + copperWorkers.length + copperGuilds.length > 0,
  };
}

export const SCORE_EVENT_STATUS = GIG_SCORE_EVENT_STATUS;
export const SCORE_REASON_CODES = GIG_SCORE_REASON_CODES;
export const SOCIO_TIERS = GIG_TIERS;
export const buildScoreEvent = buildGigScoreEvent;
