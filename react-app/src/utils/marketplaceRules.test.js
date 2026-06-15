import { createBadMatchRecord, shouldHideWorkerForConsumer } from './badMatchMemory';
import { getEmergencyBookingRule, getRecurringBookingPriority, validateFutureBookingWindow } from './bookingRules';
import { classifyWorkerPrice, getSuggestedPriceBand } from './priceIntelligence';
import { getLaunchServices, getRecruitableServices } from './serviceCatalog';
import { chooseAutoSelectWorker, distanceKm, getMatchingScope } from './workerMatching';
import { approveExternalPlatformProof, createExternalPlatformProof, getExperiencedWorkerBadge } from './workerVerification';
import { calculateWalletBalance, evaluateWalletRestrictions, recordCashPlatformFeeDebt } from './wallet';

describe('service catalog and price intelligence', () => {
  test('launch services focus on maid/helper and electrician while backend can recruit all', () => {
    expect(getLaunchServices().map((service) => service.name)).toContain('Electrician');
    expect(getLaunchServices().map((service) => service.name)).toContain('Kitchen Help');
    expect(getRecruitableServices().map((service) => service.name)).toContain('Painter');
  });

  test('suggests and classifies worker prices without forcing worker amount', () => {
    const band = getSuggestedPriceBand({ serviceType: 'Electrician', urgency: 'High' });
    expect(band.fairMin).toBeGreaterThan(900);
    expect(classifyWorkerPrice({ amount: band.fairMin, serviceType: 'Electrician' }).label).toBe('fair');
    expect(classifyWorkerPrice({ amount: band.premiumMin + 500, serviceType: 'Electrician' }).label).toBe('premium');
  });
});

describe('worker matching and bad-match memory', () => {
  test('excludes worker after verified one-star bad match and ranks remaining workers', () => {
    const badMatch = createBadMatchRecord({
      consumerId: 'c1',
      workerId: 'w1',
      bookingId: 'b1',
      rating: 1,
    });
    const selected = chooseAutoSelectWorker({
      consumerId: 'c1',
      serviceType: 'Electrician',
      consumerLocation: { lat: 12.9716, lng: 77.5946 },
      badMatches: [badMatch],
      workers: [
        { id: 'w1', services: ['Electrician'], location: { lat: 12.9716, lng: 77.5946 }, gigScore: 950, tier: 'Diamond', price: 500 },
        { id: 'w2', services: ['Electrician'], location: { lat: 12.98, lng: 77.6 }, gigScore: 700, tier: 'Silver', price: 900 },
      ],
    });

    expect(shouldHideWorkerForConsumer({ consumerId: 'c1', workerId: 'w1', badMatches: [badMatch] })).toBe(true);
    expect(selected.id).toBe('w2');
  });

  test('uses city scope for rare or sparse services', () => {
    expect(distanceKm({ lat: 12.9716, lng: 77.5946 }, { lat: 12.9816, lng: 77.6046 })).toBeGreaterThan(0);
    expect(getMatchingScope({ service: { rareService: true }, availableWorkerCount: 10 })).toBe('city');
    expect(getMatchingScope({ service: { rareService: false }, availableWorkerCount: 2 })).toBe('city');
    expect(getMatchingScope({ service: { rareService: false }, availableWorkerCount: 4 })).toBe('area_10km');
  });
});

describe('worker verification and wallet debt', () => {
  test('stores external platform proof as masked display plus audit trail', () => {
    const proof = createExternalPlatformProof({
      workerId: 'w1',
      platformName: 'UC',
      externalId: 'UC-123456789',
    });
    const approved = approveExternalPlatformProof(proof, {
      reviewedBy: 'superadmin',
      freeAccessUntil: new Date('2027-05-16T00:00:00Z'),
    });

    expect(proof.maskedId).toBe('****6789');
    expect(approved.verificationStatus).toBe('approved');
    expect(approved.audit).toHaveLength(2);
  });

  test('shows experienced worker badge only after proof review with safe public copy', () => {
    const pending = createExternalPlatformProof({
      workerId: 'w1',
      platformName: 'UC',
      externalId: 'UC-123456789',
    });
    const approved = approveExternalPlatformProof(pending, {
      reviewedBy: 'superadmin',
      freeAccessUntil: new Date('2027-05-16T00:00:00Z'),
    });

    expect(getExperiencedWorkerBadge({ externalPlatformProofs: [pending] }).visible).toBe(false);

    const safeBadge = getExperiencedWorkerBadge({ externalPlatformProofs: [approved] });
    expect(safeBadge.visible).toBe(true);
    expect(safeBadge.label).toBe('Verified previous platform experience');
    expect(safeBadge.description).not.toContain('UC');
    expect(safeBadge.sourcePlatformName).toBeNull();

    const legallyApprovedBadge = getExperiencedWorkerBadge({
      externalPlatformProofs: [approved],
      legalCopyApproved: true,
    });
    expect(legallyApprovedBadge.sourcePlatformName).toBe('UC');
  });

  test('wallet records cash platform fee debt and flags restriction after -100', () => {
    const entries = [
      recordCashPlatformFeeDebt({ walletId: 'w1', bookingId: 'b1', platformFee: 60 }),
      recordCashPlatformFeeDebt({ walletId: 'w1', bookingId: 'b2', platformFee: 50 }),
    ];
    const balance = calculateWalletBalance(entries);
    const restriction = evaluateWalletRestrictions({ balance });

    expect(balance).toBe(-110);
    expect(restriction.limited).toBe(true);
    expect(restriction.maxJobsPerDay).toBe(1);
    expect(restriction.gigScorePenaltyNeedsDiscussion).toBe(-5);
  });
});

describe('future, recurring, and emergency booking rules', () => {
  test('limits future bookings to two weeks', () => {
    expect(validateFutureBookingWindow({
      requestedAt: new Date('2026-05-16T00:00:00Z'),
      scheduledAt: new Date('2026-05-29T00:00:00Z'),
    }).valid).toBe(true);
    expect(validateFutureBookingWindow({
      requestedAt: new Date('2026-05-16T00:00:00Z'),
      scheduledAt: new Date('2026-06-10T00:00:00Z'),
    }).reason).toBe('beyond_2_weeks');
  });

  test('prioritizes recurring bookings without overriding open issues', () => {
    expect(getRecurringBookingPriority({ frequency: 'weekly', cleanCompletions: 5 }).priority).toBe('recurring');
    expect(getRecurringBookingPriority({ frequency: 'weekly', hasOpenIssue: true }).priority).toBe('hold');
  });

  test('marks emergency jobs eligible only when a worker is truly available', () => {
    expect(getEmergencyBookingRule({ requestedWithinHours: 4, workerAvailable: true }).eligible).toBe(true);
    expect(getEmergencyBookingRule({ requestedWithinHours: 4, workerAvailable: false }).eligible).toBe(false);
  });
});
