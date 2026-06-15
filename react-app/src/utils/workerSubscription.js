export const DEFAULT_SUBSCRIPTION_PLAN = {
  monthlyFee: 1500,
  launchFreeDays: 30,
  verifiedExternalPlatformFreeDays: 30,
  highPerformanceAutoExtendDays: 60,
  highPerformanceScore: 600,
};

export const WORKER_FREEDOM_PROMISE =
  'Workers can use Gigtos alongside UC, Pivot, or any other legal work source. No exclusivity, no forced target, no pressure to leave another app.';

export function getLaunchAccessPlan({
  hasVerifiedExternalPlatform = false,
  plan = DEFAULT_SUBSCRIPTION_PLAN,
} = {}) {
  return {
    monthlyFee: plan.monthlyFee,
    freeDays: hasVerifiedExternalPlatform
      ? plan.verifiedExternalPlatformFreeDays
      : plan.launchFreeDays,
    founderManagedCosts: true,
    noExclusivity: true,
    workerKeepsJobEarnings: true,
    promise: hasVerifiedExternalPlatform
      ? 'First month free with verified previous-platform proof. Reach 600 GigScore in month one to unlock 2 extra free months.'
      : 'First 30 days free during launch; Gigtos founder manages early platform costs.',
  };
}

export function calculateFreeAccessUntil({
  joinedAt = new Date(),
  hasVerifiedExternalPlatform = false,
  extraFreeDays = 0,
  plan = DEFAULT_SUBSCRIPTION_PLAN,
}) {
  const start = new Date(joinedAt);
  const freeDays = hasVerifiedExternalPlatform
    ? plan.verifiedExternalPlatformFreeDays
    : plan.launchFreeDays;
  const until = new Date(start);
  until.setDate(until.getDate() + freeDays + Number(extraFreeDays || 0));
  return until;
}

export function getSubscriptionStatus({
  now = new Date(),
  freeAccessUntil,
  activeSubscriptionUntil,
}) {
  const current = new Date(now);
  const freeUntil = freeAccessUntil ? new Date(freeAccessUntil) : null;
  const paidUntil = activeSubscriptionUntil ? new Date(activeSubscriptionUntil) : null;

  if (freeUntil && freeUntil >= current) {
    return { status: 'free_access', accessAllowed: true, daysRemaining: Math.ceil((freeUntil - current) / 86400000) };
  }
  if (paidUntil && paidUntil >= current) {
    return { status: 'paid_active', accessAllowed: true, daysRemaining: Math.ceil((paidUntil - current) / 86400000) };
  }
  return { status: 'subscription_due', accessAllowed: false, daysRemaining: 0 };
}

export function getGigScoreFreeAccessProgress({
  joinedAt = new Date(),
  now = new Date(),
  gigScore,
  socioScore,
  alreadyExtended = false,
  plan = DEFAULT_SUBSCRIPTION_PLAN,
} = {}) {
  const start = new Date(joinedAt);
  const current = new Date(now);
  const daysSinceJoin = Number.isNaN(start.getTime()) ? 999 : Math.floor((current - start) / 86400000);
  const score = Number(gigScore ?? socioScore ?? 450);
  const pointsNeeded = Math.max(0, plan.highPerformanceScore - score);
  const eligibleWindowOpen = daysSinceJoin >= 0 && daysSinceJoin <= 31;

  return {
    targetScore: plan.highPerformanceScore,
    extensionDays: plan.highPerformanceAutoExtendDays,
    score,
    pointsNeeded,
    eligibleWindowOpen,
    alreadyExtended,
    unlocked: alreadyExtended || (eligibleWindowOpen && pointsNeeded === 0),
    message: alreadyExtended
      ? 'Your GigScore free-access extension is active.'
      : eligibleWindowOpen
        ? `Reach ${plan.highPerformanceScore} GigScore this month to unlock ${plan.highPerformanceAutoExtendDays} extra free days.`
        : 'GigScore free-access window has ended; superadmin can still extend from review.',
  };
}

export function evaluateSubscriptionRefund({
  leadsReceived = 0,
  completedJobs = 0,
  verifiedOneStarCount = 0,
  qualityIssueCount = 0,
  gigScore,
  socioScore,
  monthlyFee = DEFAULT_SUBSCRIPTION_PLAN.monthlyFee,
}) {
  const effectiveGigScore = Number(gigScore ?? socioScore ?? 500);
  const disqualified =
    Number(verifiedOneStarCount) >= 3 ||
    Number(qualityIssueCount) >= 3 ||
    effectiveGigScore < 400;

  if (disqualified) {
    return {
      eligible: false,
      refundAmount: 0,
      reasonCode: 'quality_or_score_disqualified',
      reasonText: 'Refund not eligible because verified quality risk or low GigScore protects consumers.',
      requiresSuperadminOverride: true,
    };
  }

  if (Number(leadsReceived) === 0 && Number(completedJobs) === 0) {
    return {
      eligible: true,
      refundAmount: Math.round(monthlyFee * 0.5),
      reasonCode: 'no_meaningful_leads',
      reasonText: 'Worker received no proper leads/jobs; offer partial refund or platform credit.',
      requiresSuperadminOverride: false,
    };
  }

  if (Number(leadsReceived) < 3 && Number(completedJobs) === 0) {
    return {
      eligible: true,
      refundAmount: Math.round(monthlyFee * 0.25),
      reasonCode: 'low_lead_value',
      reasonText: 'Worker received too few useful leads; offer small refund or credit.',
      requiresSuperadminOverride: false,
    };
  }

  return {
    eligible: false,
    refundAmount: 0,
    reasonCode: 'value_delivered',
    reasonText: 'Subscription value was delivered through leads/jobs.',
    requiresSuperadminOverride: false,
  };
}
