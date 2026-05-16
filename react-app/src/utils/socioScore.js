export const SCORE_EVENT_STATUS = {
  PENDING: 'pending',
  FINALIZED: 'finalized',
  REVERSED: 'reversed',
};

export const SOCIO_TIERS = [
  { name: 'Copper', min: 0, max: 449, color: '#b45309' },
  { name: 'Bronze', min: 450, max: 599, color: '#92400e' },
  { name: 'Silver', min: 600, max: 749, color: '#64748b' },
  { name: 'Gold', min: 750, max: 899, color: '#ca8a04' },
  { name: 'Diamond', min: 900, max: 1000, color: '#0891b2' },
];

export const SCORE_REASON_CODES = {
  FIVE_STAR_JOB: 'five_star_job',
  FOUR_STAR_JOB: 'four_star_job',
  ONE_STAR_JOB: 'one_star_job',
  CANCELLATION: 'cancellation',
  COMPLETION_PHOTO: 'completion_photo',
  RECURRING_BOOKING: 'recurring_booking',
  GUILD_RIPPLE: 'guild_ripple',
  MANUAL_ADJUSTMENT: 'manual_adjustment',
};

export function getTierFromScore(score) {
  const value = Number(score) || 0;
  if (value >= 900) return 'Diamond';
  if (value >= 750) return 'Gold';
  if (value >= 600) return 'Silver';
  if (value >= 450) return 'Bronze';
  return 'Copper';
}

export function getTierMeta(score) {
  const value = Math.max(0, Math.min(1000, Number(score) || 0));
  return SOCIO_TIERS.find((tier) => value >= tier.min && value <= tier.max) || SOCIO_TIERS[0];
}

export function getPointsToNextTier(score) {
  const value = Math.max(0, Math.min(1000, Number(score) || 0));
  const next = SOCIO_TIERS.find((tier) => tier.min > value);
  return next ? next.min - value : 0;
}

export function getRecoveryAdvice({ score, role = 'worker', recentEvents = [] }) {
  const tier = getTierFromScore(score);
  const hasPenalty = recentEvents.some((event) => Number(event.delta) < 0);

  if (tier === 'Copper') {
    return role === 'worker'
      ? 'Complete 3 clean jobs with proof photos to recover toward Bronze/Silver.'
      : 'Complete clean bookings, avoid late cancellations, and submit truthful feedback to recover.';
  }

  if (hasPenalty) {
    return 'Keep the next jobs clean and issue-free; pending positive points can repair the drop.';
  }

  const points = getPointsToNextTier(score);
  return points > 0 ? `${points} points to ${SOCIO_TIERS.find((tierDef) => tierDef.min > score)?.name}.` : 'Diamond tier active. Keep quality stable.';
}

export function getWorkerRatingDelta(rating) {
  const stars = Number(rating);
  if (stars === 5) return 15;
  if (stars === 4) return 8;
  if (stars === 3) return 0;
  if (stars === 2) return -30;
  if (stars === 1) return -60;
  throw new Error('rating must be from 1 to 5');
}

export function getConsumerRatingDelta(rating) {
  const stars = Number(rating);
  if (stars === 5) return 10;
  if (stars === 4) return 5;
  if (stars === 3) return 0;
  if (stars === 2) return -10;
  if (stars === 1) return -30;
  throw new Error('rating must be from 1 to 5');
}

export function buildScoreEvent({
  actorId,
  actorRole,
  bookingId,
  guildId = null,
  reasonCode,
  reasonText,
  oldScore,
  delta,
  status = SCORE_EVENT_STATUS.PENDING,
  createdAt = new Date(),
}) {
  if (!actorId) throw new Error('actorId is required');
  if (!actorRole) throw new Error('actorRole is required');
  if (!bookingId) throw new Error('bookingId is required');
  if (!reasonCode) throw new Error('reasonCode is required');

  const previous = Number(oldScore) || 0;
  const change = Number(delta) || 0;
  const newScore = Math.max(0, Math.min(1000, previous + change));

  return {
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
    finalizedAt: status === SCORE_EVENT_STATUS.FINALIZED ? createdAt : null,
    fraudReviewState: 'not_required',
  };
}

export function buildDailyScoreDigest({ events = [], currentScore = 0, role = 'worker', date = new Date() }) {
  const finalized = events.filter((event) => event.status === SCORE_EVENT_STATUS.FINALIZED);
  const pending = events.filter((event) => event.status === SCORE_EVENT_STATUS.PENDING);
  const finalizedDelta = finalized.reduce((sum, event) => sum + Number(event.delta || 0), 0);
  const pendingDelta = pending.reduce((sum, event) => sum + Number(event.delta || 0), 0);
  const positiveReasons = events.filter((event) => Number(event.delta || 0) > 0).map((event) => event.reasonText || event.reasonCode);
  const negativeReasons = events.filter((event) => Number(event.delta || 0) < 0).map((event) => event.reasonText || event.reasonCode);

  return {
    date,
    currentScore: Math.max(0, Math.min(1000, Number(currentScore) || 0)),
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
  workerOldScore = 500,
  consumerOldScore = 0,
}) {
  if (!booking) throw new Error('booking is required');
  const workerId = booking.assignedWorkerId || booking.workerId;
  const consumerId = booking.userId;
  if (!workerId) throw new Error('booking must have assignedWorkerId');
  if (!consumerId) throw new Error('booking must have userId');

  const workerDelta = getWorkerRatingDelta(rating);
  const consumerDelta = getConsumerRatingDelta(rating);
  const status = Number(rating) <= 2 ? SCORE_EVENT_STATUS.PENDING : SCORE_EVENT_STATUS.FINALIZED;

  return [
    buildScoreEvent({
      actorId: workerId,
      actorRole: 'worker',
      bookingId: booking.id,
      guildId: booking.guildId || null,
      reasonCode: `consumer_rating_${rating}`,
      reasonText: `Consumer gave ${rating}-star feedback for completed work.`,
      oldScore: workerOldScore,
      delta: workerDelta,
      status,
    }),
    buildScoreEvent({
      actorId: consumerId,
      actorRole: 'consumer',
      bookingId: booking.id,
      reasonCode: `rating_submitted_${rating}`,
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
      score: Math.max(0, Math.min(1000, Number(member.score) || 0)),
      weight,
      protectionState,
    };
  });

  const included = weightedMembers.filter((member) => member.weight > 0);
  const weightTotal = included.reduce((sum, member) => sum + member.weight, 0);
  const baseScore = weightTotal
    ? included.reduce((sum, member) => sum + member.score * member.weight, 0) / weightTotal
    : 0;
  const guildScore = Math.max(0, Math.min(1000, Math.round(baseScore + Number(guildBehaviorBonus || 0) - Number(guildRiskPenalty || 0))));

  return {
    guildScore,
    guildTier: getTierFromScore(guildScore),
    memberCount: members.length,
    includedMemberCount: included.length,
    protectedMemberCount: weightedMembers.filter((member) => member.weight === 0).length,
    members: weightedMembers,
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

export function getTierBenefit({ role, tier, isGuild = false }) {
  if (role === 'consumer' && tier === 'Diamond') {
    return { platformFeeFree: true, discountPercent: 0, note: 'Diamond consumer gets platform-fee-free eligible bookings.' };
  }
  if (isGuild && tier === 'Diamond') {
    return { platformFeeFree: false, priceMultiplier: 1.1, recommendation: 'priority_when_fit', note: 'Diamond guild can charge 10% higher and be recommended first when fit.' };
  }
  if (tier === 'Copper') {
    return { platformFeeFree: false, discountPercent: 10, note: 'Copper recovery/intro pricing may show 10% discount when campaign allows.' };
  }
  return { platformFeeFree: false, discountPercent: 0, note: `${tier || 'Standard'} tier has normal pricing.` };
}

export function buildCopperMonitorSummary({ consumers = [], workers = [], guilds = [], threshold = 450 }) {
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
