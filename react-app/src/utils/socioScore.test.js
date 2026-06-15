import {
  buildCopperMonitorSummary,
  buildDailyScoreDigest,
  calculateGuildScore,
  getConsumerTierPolicy,
  getFinalizedScoreView,
  getAiPhotoQualityScorePolicy,
  getGigScoreFraudRiskDecision,
  getGuildDiamondShieldState,
  getGuildJoinPreview,
  getLazyInactivityDecayEvent,
  getGuildPricingRule,
  getPointsToNextTier,
  getScorePsychologyMessage,
  getTierBenefit,
  getTierDisplay,
  getTierFromScore,
  getVerifiedHelperRewardPolicy,
  getWalletDebtGigScorePolicy,
  getWorkerTierPolicy,
  validateGigScoreServerWrite,
  validateGuildMembership,
  getRecurringConsumerBonus,
  getSamePairPositiveMultiplier,
  getScoreRestriction,
  getTipScoreDeltas,
  getVisibleDailyScoreEvents,
  getWorkerRatingDelta,
  shouldFreezeConsumerForOneStarPattern,
} from './gigScore';
import {
  WORKER_FREEDOM_PROMISE,
  calculateFreeAccessUntil,
  getGigScoreFreeAccessProgress,
  evaluateSubscriptionRefund,
  getLaunchAccessPlan,
  getSubscriptionStatus,
} from './workerSubscription';
import { t, translateScoreEvent } from './localization';

describe('GigScore core model', () => {
  it('calculates tiers and points to next tier', () => {
    expect(getTierFromScore(390)).toBe('Copper');
    expect(getTierFromScore(400)).toBe('Bronze');
    expect(getTierFromScore(750)).toBe('Gold');
    expect(getTierFromScore(900)).toBe('Diamond');
    expect(getPointsToNextTier(740)).toBe(10);
    expect(getPointsToNextTier(950)).toBe(0);
  });

  it('builds daily score digest with reasons and recovery advice', () => {
    const digest = buildDailyScoreDigest({
      currentScore: 380,
      role: 'worker',
      events: [
        { delta: 15, status: 'finalized', reasonText: '5-star job' },
        { delta: -20, status: 'pending', reasonText: '1-star review pending check' },
      ],
    });

    expect(digest.tier).toBe('Copper');
    expect(digest.finalizedDelta).toBe(15);
    expect(digest.pendingDelta).toBe(-20);
    expect(digest.negativeReasons).toContain('1-star review pending check');
    expect(digest.recoveryAdvice).toContain('3 clean jobs');
  });

  it('calculates guild score with first-5-jobs protection', () => {
    const now = new Date('2026-05-16T00:00:00Z');
    const guild = calculateGuildScore({
      now,
      members: [
        { id: 'senior-1', score: 900, completedJobs: 20, joinedAt: '2026-01-01T00:00:00Z' },
        { id: 'new-1', score: 200, completedJobs: 4, joinedAt: '2026-05-01T00:00:00Z' },
      ],
    });

    expect(guild.guildScore).toBe(900);
    expect(guild.guildTier).toBe('Diamond');
    expect(guild.protectedMemberCount).toBe(1);
  });

  it('applies tier benefits and guild pricing rules', () => {
    expect(getTierBenefit({ role: 'consumer', tier: 'Diamond' })).toMatchObject({
      platformFeeFree: false,
      discountPercent: 0,
    });
    expect(getTierBenefit({ role: 'consumer', tier: 'Diamond', isElite: true })).toMatchObject({
      platformFeeFree: true,
      discountPercent: 25,
    });
    expect(getGuildPricingRule('Diamond')).toMatchObject({ priceMultiplier: 1.1 });
    expect(getGuildPricingRule('Copper')).toMatchObject({ priceMultiplier: 0.9 });
  });

  it('keeps growth slow and caps farming signals', () => {
    expect(getWorkerRatingDelta(5)).toBe(8);
    expect(getWorkerRatingDelta(1)).toBe(-20);
    expect(getSamePairPositiveMultiplier({ weeklyPositiveCount: 2, monthlyPositiveCount: 1 })).toBe(0);
    expect(getSamePairPositiveMultiplier({ weeklyPositiveCount: 0, monthlyPositiveCount: 2 })).toBe(0.3);
    expect(getTipScoreDeltas({ tipAmount: 250 })).toEqual({ consumerDelta: 10, workerDelta: 5 });
    expect(getRecurringConsumerBonus({ cadence: 'weekly', cleanCompletionsInStreak: 4 })).toMatchObject({
      totalDelta: 30,
      milestoneReached: true,
    });
  });

  it('applies lazy inactivity decay without dropping normal inactivity below 450', () => {
    expect(getLazyInactivityDecayEvent({
      role: 'consumer',
      score: 452,
      lastActiveAt: '2026-04-01T00:00:00Z',
      now: '2026-05-01T00:00:00Z',
    })).toMatchObject({
      shouldApply: true,
      delta: -2,
      newScore: 450,
      reasonCode: 'inactivity_decay',
    });

    expect(getLazyInactivityDecayEvent({
      role: 'worker',
      score: 500,
      lastActiveAt: '2026-04-01T00:00:00Z',
      now: '2026-04-08T00:00:00Z',
    })).toMatchObject({
      shouldApply: false,
      delta: 0,
    });
  });

  it('summarizes Copper monitoring counts', () => {
    const summary = buildCopperMonitorSummary({
      consumers: [{ id: 'c1', score: 300 }, { id: 'c2', score: 800 }],
      workers: [{ id: 'w1', score: 390 }],
      guilds: [{ id: 'g1', guildScore: 390 }],
    });

    expect(summary.copperConsumersCount).toBe(1);
    expect(summary.copperWorkersCount).toBe(1);
    expect(summary.copperGuildsCount).toBe(1);
    expect(summary.needsAttention).toBe(true);
  });

  it('uses recovery wording instead of public shame for Copper', () => {
    expect(getTierDisplay({ score: 390, role: 'worker' })).toMatchObject({
      publicName: 'Recovery',
      tone: 'recovery',
    });
  });

  it('separates finalized score, pending risk, and daily visible events', () => {
    const view = getFinalizedScoreView({
      score: 600,
      role: 'consumer',
      events: [
        { status: 'pending', delta: -20, reasonCode: 'one_star_issue', createdAt: new Date() },
        { status: 'finalized', delta: 3, reasonCode: 'payment_on_time', createdAt: new Date() },
      ],
    });

    expect(view).toMatchObject({
      currentFinalizedScore: 600,
      pendingDelta: -20,
      scoreAtRisk: 20,
      tier: 'Silver',
    });
    expect(view.yesterdayToTodayEvents).toHaveLength(2);
  });

  it('documents worker and consumer tier policies', () => {
    expect(getWorkerTierPolicy({ score: 910, diamondPriceIncreaseEnabled: true })).toMatchObject({
      tier: 'Diamond',
      canEditFuturePrice: true,
      canChangeAcceptedBookingPrice: false,
      optionalPriceIncreasePercent: 10,
      eliteEligibleForReview: true,
    });
    expect(getConsumerTierPolicy({ score: 920, isElite: true, realConsumerCount: 2999 })).toMatchObject({
      tier: 'Diamond',
      eliteOpen: false,
      discountEligibility: 0,
      platformFeeFree: false,
    });
    expect(getConsumerTierPolicy({ score: 920, isElite: true, realConsumerCount: 3000 })).toMatchObject({
      eliteOpen: true,
      discountEligibility: 25,
      platformFeeFree: true,
    });
  });

  it('validates guild rules, join previews, and Diamond shield', () => {
    expect(validateGuildMembership({ memberCount: 2 })).toMatchObject({ valid: false, minMembers: 3 });
    expect(validateGuildMembership({ memberCount: 6 })).toMatchObject({ valid: true });
    expect(getGuildJoinPreview({
      requester: { id: 'w1', name: 'New Worker', gigScore: 450, completedJobs: 2, serviceType: 'maid' },
      guild: { memberCount: 3, city: 'Bengaluru' },
    })).toMatchObject({
      requesterTier: 'Bronze',
      firstFiveJobsProtected: true,
      canJoin: true,
    });
    expect(getGuildDiamondShieldState({
      previousTier: 'Diamond',
      newTier: 'Gold',
      shieldStartedAt: '2026-05-18T00:00:00Z',
      now: '2026-05-19T00:00:00Z',
    })).toMatchObject({ shieldActive: true, downgradeAllowed: false });
    expect(getGuildDiamondShieldState({
      previousTier: 'Diamond',
      newTier: 'Gold',
      fraudOrSafetyIssue: true,
    })).toMatchObject({ shieldActive: false, downgradeAllowed: true });
  });

  it('has reinforcement, loss aversion, and recovery copy helpers', () => {
    expect(getScorePsychologyMessage({ type: 'reinforcement', delta: 8, score: 600 })).toContain('+8 added');
    expect(getScorePsychologyMessage({ type: 'loss_aversion', role: 'worker' })).toContain('Cancelling');
    expect(getScorePsychologyMessage({ type: 'recovery', role: 'worker' })).toContain('3 clean jobs');
  });

  it('codifies risk, wallet, SOS helper, AI photo, and server validation guardrails', () => {
    expect(getGigScoreFraudRiskDecision({
      sameDeviceAccounts30Days: 3,
      refundRequests30Days: 3,
    })).toMatchObject({ scoreFrozen: true, action: 'freeze_score_and_review' });
    expect(validateGigScoreServerWrite({ actorId: 'u1', actorRole: 'consumer', reasonCode: 'payment_on_time', delta: 3, status: 'finalized' })).toMatchObject({ valid: true });
    expect(getWalletDebtGigScorePolicy({ platformFeeDue: 150 })).toMatchObject({ limitedToOneJobPerDay: true, dailyScorePenalty: 0 });
    expect(getVerifiedHelperRewardPolicy({ reachedSosLocation: true, verifiedBySupport: true })).toMatchObject({ eligible: true, delta: 5 });
    expect(getAiPhotoQualityScorePolicy({ aiSignal: 'reused_photo', humanVerified: false })).toMatchObject({ canAffectScore: false, delta: 0, status: 'pending' });
  });

  it('shows only recent score reasons with advice for user-facing daily view', () => {
    const now = new Date('2026-05-19T12:00:00Z');
    const visible = getVisibleDailyScoreEvents({
      now,
      events: [
        { reasonCode: 'payment_on_time', reasonText: 'Paid on time', delta: 3, createdAt: '2026-05-19T10:00:00Z' },
        { reasonCode: 'old_event', reasonText: 'Old score change', delta: 3, createdAt: '2026-05-17T10:00:00Z' },
      ],
    });

    expect(visible).toHaveLength(1);
    expect(visible[0].improvementAdvice).toContain('Keep');
  });

  it('freezes risky consumer rating attacks without auto-punishing from AI alone', () => {
    expect(shouldFreezeConsumerForOneStarPattern({ oneStarCount30Days: 3 })).toBe(true);
    expect(shouldFreezeConsumerForOneStarPattern({ oneStarCount30Days: 1 })).toBe(false);
    expect(getScoreRestriction({ role: 'worker', score: 290 })).toMatchObject({ level: 'work_frozen' });
  });
});

describe('worker subscription model', () => {
  it('documents launch access and worker freedom without exclusivity', () => {
    expect(getLaunchAccessPlan()).toMatchObject({
      freeDays: 30,
      founderManagedCosts: true,
      noExclusivity: true,
      workerKeepsJobEarnings: true,
    });
    expect(getLaunchAccessPlan({ hasVerifiedExternalPlatform: true })).toMatchObject({
      freeDays: 30,
      monthlyFee: 1500,
    });
    expect(WORKER_FREEDOM_PROMISE).toContain('No exclusivity');
  });

  it('grants launch free access for verified external platform workers', () => {
    expect(calculateFreeAccessUntil({
      joinedAt: '2026-01-01T00:00:00Z',
      hasVerifiedExternalPlatform: true,
    }).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('shows the 600 GigScore free-access extension target', () => {
    const progress = getGigScoreFreeAccessProgress({
      joinedAt: '2026-05-01T00:00:00Z',
      now: '2026-05-10T00:00:00Z',
      gigScore: 580,
    });

    expect(progress).toMatchObject({
      targetScore: 600,
      extensionDays: 60,
      pointsNeeded: 20,
      eligibleWindowOpen: true,
      unlocked: false,
    });
  });

  it('reports subscription status and refund decisions', () => {
    expect(getSubscriptionStatus({
      now: '2026-05-01T00:00:00Z',
      freeAccessUntil: '2026-05-10T00:00:00Z',
    })).toMatchObject({ status: 'free_access', accessAllowed: true });

    expect(evaluateSubscriptionRefund({
      leadsReceived: 0,
      completedJobs: 0,
      gigScore: 650,
    })).toMatchObject({ eligible: true, refundAmount: 750 });

    expect(evaluateSubscriptionRefund({
      verifiedOneStarCount: 3,
      gigScore: 650,
    })).toMatchObject({ eligible: false, reasonCode: 'quality_or_score_disqualified' });
  });
});

describe('local language support', () => {
  it('translates score reasons in the initial supported languages', () => {
    expect(t('score_up', 'hi')).toBe('आपका स्कोर बढ़ा.');
    expect(t('score_down', 'te')).toBe('మీ స్కోర్ తగ్గింది.');
    expect(translateScoreEvent({ delta: 15, reasonText: '5-star job' }, 'ta')).toContain('5-star job');
  });
});
