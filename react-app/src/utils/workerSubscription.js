export const DEFAULT_SUBSCRIPTION_PLAN = {
  monthlyFee: 1000,
  launchFreeDays: 30,
  verifiedExternalPlatformFreeDays: 365,
};

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

export function evaluateSubscriptionRefund({
  leadsReceived = 0,
  completedJobs = 0,
  verifiedOneStarCount = 0,
  qualityIssueCount = 0,
  socioScore = 500,
  monthlyFee = DEFAULT_SUBSCRIPTION_PLAN.monthlyFee,
}) {
  const disqualified =
    Number(verifiedOneStarCount) >= 3 ||
    Number(qualityIssueCount) >= 3 ||
    Number(socioScore) < 450;

  if (disqualified) {
    return {
      eligible: false,
      refundAmount: 0,
      reasonCode: 'quality_or_score_disqualified',
      reasonText: 'Refund not eligible because verified quality risk or low SocioScore protects consumers.',
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
