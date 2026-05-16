import {
  buildCopperMonitorSummary,
  buildDailyScoreDigest,
  calculateGuildScore,
  getGuildPricingRule,
  getPointsToNextTier,
  getTierBenefit,
  getTierFromScore,
} from './socioScore';
import {
  calculateFreeAccessUntil,
  evaluateSubscriptionRefund,
  getSubscriptionStatus,
} from './workerSubscription';
import { t, translateScoreEvent } from './localization';

describe('SocioScore core model', () => {
  it('calculates tiers and points to next tier', () => {
    expect(getTierFromScore(440)).toBe('Copper');
    expect(getTierFromScore(450)).toBe('Bronze');
    expect(getTierFromScore(750)).toBe('Gold');
    expect(getTierFromScore(900)).toBe('Diamond');
    expect(getPointsToNextTier(740)).toBe(10);
    expect(getPointsToNextTier(950)).toBe(0);
  });

  it('builds daily score digest with reasons and recovery advice', () => {
    const digest = buildDailyScoreDigest({
      currentScore: 430,
      role: 'worker',
      events: [
        { delta: 15, status: 'finalized', reasonText: '5-star job' },
        { delta: -60, status: 'pending', reasonText: '1-star review pending check' },
      ],
    });

    expect(digest.tier).toBe('Copper');
    expect(digest.finalizedDelta).toBe(15);
    expect(digest.pendingDelta).toBe(-60);
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
      platformFeeFree: true,
      discountPercent: 0,
    });
    expect(getGuildPricingRule('Diamond')).toMatchObject({ priceMultiplier: 1.1 });
    expect(getGuildPricingRule('Copper')).toMatchObject({ priceMultiplier: 0.9 });
  });

  it('summarizes Copper monitoring counts', () => {
    const summary = buildCopperMonitorSummary({
      consumers: [{ id: 'c1', score: 300 }, { id: 'c2', score: 800 }],
      workers: [{ id: 'w1', score: 440 }],
      guilds: [{ id: 'g1', guildScore: 430 }],
    });

    expect(summary.copperConsumersCount).toBe(1);
    expect(summary.copperWorkersCount).toBe(1);
    expect(summary.copperGuildsCount).toBe(1);
    expect(summary.needsAttention).toBe(true);
  });
});

describe('worker subscription model', () => {
  it('grants one-year free access for verified external platform workers', () => {
    expect(calculateFreeAccessUntil({
      joinedAt: '2026-01-01T00:00:00Z',
      hasVerifiedExternalPlatform: true,
    }).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('reports subscription status and refund decisions', () => {
    expect(getSubscriptionStatus({
      now: '2026-05-01T00:00:00Z',
      freeAccessUntil: '2026-05-10T00:00:00Z',
    })).toMatchObject({ status: 'free_access', accessAllowed: true });

    expect(evaluateSubscriptionRefund({
      leadsReceived: 0,
      completedJobs: 0,
      socioScore: 650,
    })).toMatchObject({ eligible: true, refundAmount: 500 });

    expect(evaluateSubscriptionRefund({
      verifiedOneStarCount: 3,
      socioScore: 650,
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
