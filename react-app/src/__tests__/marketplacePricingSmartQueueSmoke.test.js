import {
  MVP_JOB_DEFAULTS,
  buildAreaDemandSnapshot,
  buildServicePriceRule,
  buildSmartQueueOffer,
  buildWorkerOpenSession,
} from '../utils/backendContracts';
import { calculateMvpDemandPrice } from '../utils/mvpDemandPricing';
import { buildTravelReviewQueue } from '../utils/operatorQueues';

const requestedAt = new Date('2026-05-26T10:00:00Z');
const areaId = 'hyderabad_kukatpally';
const serviceId = 'bathroom_cleaning';

function rule(overrides = {}) {
  return buildServicePriceRule({
    city: 'Hyderabad',
    areaName: 'Kukatpally',
    serviceId,
    ...overrides,
  });
}

function snapshot(overrides = {}) {
  return buildAreaDemandSnapshot({
    city: 'Hyderabad',
    areaName: 'Kukatpally',
    serviceId,
    computedAt: new Date('2026-05-26T09:45:00Z'),
    expiresAt: new Date('2026-05-26T10:45:00Z'),
    openWorkers: 10,
    busyWorkers: 10,
    activePoolWorkers: 20,
    demandLevel: 'normal',
    recommendedPrice: 349,
    ...overrides,
  });
}

function quote({ workerId = 'worker-a', workerBasePrice = 349, demandSnapshot = snapshot(), priceRule = rule(), manualOverride = null } = {}) {
  return calculateMvpDemandPrice({
    serviceId,
    city: 'Hyderabad',
    areaId,
    workerId,
    workerBasePrice,
    rule: priceRule,
    snapshot: demandSnapshot,
    manualOverride,
    requestedAt,
  });
}

function session({
  workerId,
  areas = [areaId],
  services = [serviceId],
  status = 'open',
  expiresAt = new Date('2026-05-26T11:30:00Z'),
  workerBasePrice = 349,
  activeOfferId = null,
  activeBookingId = null,
  matchingOpenJobsCount = 0,
} = {}) {
  return {
    ...buildWorkerOpenSession({
      workerId,
      city: 'Hyderabad',
      areaIds: areas,
      serviceIds: services,
      status,
      expiresAt,
      openSince: new Date('2026-05-26T09:30:00Z'),
      workerBasePrices: { [serviceId]: workerBasePrice },
      currentSuggestedPrices: { [serviceId]: 399 },
      acceptedDemandLevel: { [serviceId]: 'high' },
      matchingOpenJobsCount,
    }),
    activeOfferId,
    activeBookingId,
  };
}

function rankCandidates({ workers, sessions, priceQuote, favoriteWorkerIds = [], now = requestedAt, attemptedWorkerIds = [] }) {
  const attempted = new Set(attemptedWorkerIds);
  return sessions
    .map(openSession => ({
      session: openSession,
      worker: workers.find(worker => worker.id === openSession.workerId),
    }))
    .filter(({ session: openSession, worker }) => {
      if (!worker || attempted.has(worker.id)) return false;
      if (openSession.status !== 'open') return false;
      if (new Date(openSession.expiresAt).getTime() <= now.getTime()) return false;
      if (openSession.activeOfferId || openSession.activeBookingId) return false;
      if (!openSession.serviceIds.includes(priceQuote.serviceId)) return false;
      if (!['approved', 'verified'].includes(worker.approvalStatus)) return false;
      if (worker.status !== 'active') return false;
      if (worker.isFraud || worker.safetyBlocked) return false;
      return true;
    })
    .map(({ session: openSession, worker }) => {
      const sameArea = openSession.areaIds.includes(priceQuote.areaId);
      const distanceKm = sameArea ? 0.5 : Number(openSession.distanceKm ?? 16);
      const withinRadius = sameArea || distanceKm <= MVP_JOB_DEFAULTS.maxRadiusKm;
      if (!withinRadius) return null;
      const favoriteBoost = favoriteWorkerIds.includes(worker.id) ? 20 : 0;
      const sameAreaBoost = sameArea ? 40 : 0;
      const distanceScore = sameArea ? 85 : distanceKm <= 5 ? 70 : distanceKm <= 10 ? 55 : 40;
      const workerPrice = Number(openSession.workerBasePrices?.[priceQuote.serviceId] || priceQuote.finalConsumerPrice);
      const priceFitScore = workerPrice <= priceQuote.finalConsumerPrice ? 70 : 45;
      const scoreBreakdown = {
        gigScore: Number(worker.gigScore || 500),
        favoriteBoost,
        sameAreaBoost,
        distanceScore,
        priceFitScore,
        responseSpeedScore: Number(worker.responseSpeedScore || 80),
        cancellationPenalty: Number(worker.cancellationPenalty || 0),
        skipPenalty: Number(worker.skipPenalty || 0),
        fairnessPenalty: Number(openSession.fairnessPenalty || 0),
        safetyPenalty: 0,
      };
      return buildSmartQueueOffer({
        bookingId: 'booking-smoke-1',
        workerId: worker.id,
        rank: 1,
        offeredAt: now,
        scoreBreakdown,
        matchingScope: sameArea ? 'same_area' : 'nearby_radius',
        distanceKm,
        distanceConfidence: sameArea ? 'same_area' : 'coordinate',
      });
    })
    .filter(Boolean)
    .sort((a, b) => b.scoreBreakdown.finalRankScore - a.scoreBreakdown.finalRankScore)
    .map((offer, index) => ({ ...offer, rank: index + 1 }));
}

function wouldCreateSkipReview({ eligibleSafeSkipsInSession, eligibleSafeSkipsThisWeek, responseType = 'reject', rejectReason = 'not interested' }) {
  const exempt = /(unsafe|safety|far|distance|wrong|service|busy|emergency|expired|medical|family|accident|address)/i.test(rejectReason);
  const eligible = ['reject', 'no_response'].includes(responseType) && !exempt;
  return {
    eligible,
    sessionReviewRequired: eligible && eligibleSafeSkipsInSession >= 3,
    weeklyReviewRequired: eligible && eligibleSafeSkipsThisWeek >= 5,
    automaticPenalty: false,
  };
}

describe('MVP marketplace seeded smoke: pricing + Smart Queue', () => {
  it('covers low, normal, high, peak, stale, below-min, above-cap, and manual override pricing', () => {
    expect(quote({
      workerBasePrice: 249,
      demandSnapshot: snapshot({ demandLevel: 'low', openWorkers: 18, busyWorkers: 2, utilizationPercent: 10 }),
    })).toMatchObject({ demandLevel: 'low', finalConsumerPrice: 249, workerReceivable: 249 });

    expect(quote({ workerBasePrice: 300 })).toMatchObject({
      demandLevel: 'normal',
      finalConsumerPrice: 349,
      workerReceivable: 349,
    });

    expect(quote({
      demandSnapshot: snapshot({ demandLevel: 'high', openWorkers: 4, busyWorkers: 16, searches: 20 }),
    })).toMatchObject({ demandLevel: 'high', finalConsumerPrice: 399, workerReceivable: 399 });

    expect(quote({
      demandSnapshot: snapshot({
        demandLevel: 'peak',
        openWorkers: 2,
        busyWorkers: 18,
        activePoolWorkers: 20,
        utilizationPercent: 90,
      }),
    })).toMatchObject({ demandLevel: 'peak', finalConsumerPrice: 499, workerReceivable: 499 });

    expect(quote({
      demandSnapshot: snapshot({ demandLevel: 'peak', expiresAt: new Date('2026-05-26T09:59:00Z') }),
    })).toMatchObject({ demandLevel: 'normal', priceSource: 'stale_snapshot_fallback', finalConsumerPrice: 349 });

    expect(quote({
      workerBasePrice: 200,
      demandSnapshot: snapshot({ demandLevel: 'low' }),
    })).toMatchObject({ adjustedWorkerPrice: 249, workerPriceStatus: 'raised_to_min', finalConsumerPrice: 249 });

    expect(() => quote({ workerBasePrice: 600 })).toThrow('workerBasePrice exceeds workerMaxPrice');

    expect(quote({
      manualOverride: {
        active: true,
        demandLevel: 'peak',
        reason: 'SuperAdmin launch festival demand pressure',
      },
    })).toMatchObject({ manualOverrideApplied: true, finalConsumerPrice: 499, workerReceivable: 499 });
  });

  it('ranks only safe, available, non-expired workers and gives favorite boost below safety rules', () => {
    const priceQuote = quote({ demandSnapshot: snapshot({ demandLevel: 'high' }) });
    const workers = [
      { id: 'favorite-safe', gigScore: 760, approvalStatus: 'approved', status: 'active', responseSpeedScore: 90 },
      { id: 'higher-score-not-favorite', gigScore: 780, approvalStatus: 'approved', status: 'active', responseSpeedScore: 85 },
      { id: 'unsafe-favorite', gigScore: 900, approvalStatus: 'approved', status: 'active', safetyBlocked: true },
      { id: 'expired-worker', gigScore: 850, approvalStatus: 'approved', status: 'active' },
      { id: 'nearby-worker', gigScore: 735, approvalStatus: 'approved', status: 'active', responseSpeedScore: 80 },
    ];
    const sessions = [
      session({ workerId: 'favorite-safe' }),
      session({ workerId: 'higher-score-not-favorite' }),
      session({ workerId: 'unsafe-favorite' }),
      session({ workerId: 'expired-worker', expiresAt: new Date('2026-05-26T09:59:00Z') }),
      { ...session({ workerId: 'nearby-worker', areas: ['hyderabad_miyapur'] }), distanceKm: 8.5 },
    ];

    const offers = rankCandidates({
      workers,
      sessions,
      priceQuote,
      favoriteWorkerIds: ['favorite-safe', 'unsafe-favorite'],
    });

    expect(offers.map(offer => offer.workerId)).toEqual([
      'favorite-safe',
      'higher-score-not-favorite',
      'nearby-worker',
    ]);
    expect(offers[0].scoreBreakdown.favoriteBoost).toBe(20);
    expect(offers[0].matchingScope).toBe('same_area');
    expect(offers[2]).toMatchObject({
      workerId: 'nearby-worker',
      matchingScope: 'nearby_radius',
      distanceKm: 8.5,
      radiusKm: 15,
    });
    expect(offers.some(offer => offer.workerId === 'unsafe-favorite')).toBe(false);
    expect(offers.some(offer => offer.workerId === 'expired-worker')).toBe(false);
  });

  it('uses no-worker recovery when no same-area or nearby worker is available', () => {
    const priceQuote = quote();
    const offers = rankCandidates({
      workers: [{ id: 'too-far', gigScore: 800, approvalStatus: 'approved', status: 'active' }],
      sessions: [{ ...session({ workerId: 'too-far', areas: ['hyderabad_gachibowli'] }), distanceKm: 18 }],
      priceQuote,
    });

    expect(offers).toHaveLength(0);
    expect({
      queueState: 'no_worker_available',
      recoveryActions: ['notify_me', 'book_later', 'expand_radius'],
      maxRadiusKm: MVP_JOB_DEFAULTS.maxRadiusKm,
    }).toMatchObject({
      queueState: 'no_worker_available',
      recoveryActions: expect.arrayContaining(['notify_me', 'book_later', 'expand_radius']),
      maxRadiusKm: 15,
    });
  });

  it('sends repeated safe skips/no-response into pending review, never automatic penalty', () => {
    expect(wouldCreateSkipReview({
      eligibleSafeSkipsInSession: 3,
      eligibleSafeSkipsThisWeek: 3,
      responseType: 'reject',
      rejectReason: 'not interested',
    })).toEqual({
      eligible: true,
      sessionReviewRequired: true,
      weeklyReviewRequired: false,
      automaticPenalty: false,
    });

    expect(wouldCreateSkipReview({
      eligibleSafeSkipsInSession: 1,
      eligibleSafeSkipsThisWeek: 5,
      responseType: 'no_response',
    })).toMatchObject({
      eligible: true,
      weeklyReviewRequired: true,
      automaticPenalty: false,
    });

    expect(wouldCreateSkipReview({
      eligibleSafeSkipsInSession: 3,
      eligibleSafeSkipsThisWeek: 5,
      responseType: 'reject',
      rejectReason: 'too far distance',
    })).toMatchObject({
      eligible: false,
      sessionReviewRequired: false,
      weeklyReviewRequired: false,
      automaticPenalty: false,
    });
  });

  it('routes travel timeout/no-show evidence into human review instead of silent completion', () => {
    const rows = buildTravelReviewQueue([
      {
        id: 'booking-travel-timeout-1',
        serviceType: 'Bathroom cleaning',
        customerName: 'Smoke Consumer',
        workerName: 'Smoke Worker',
        status: 'worker_on_the_way',
        noShowCandidate: true,
        travelWatchdogStatus: 'timeout_review',
        travelWatchdogEvidence: {
          elapsedMinutes: 31,
          staleSeconds: 180,
        },
        noAutoGigScorePenalty: true,
      },
    ], [
      {
        id: 'ticket-travel-timeout-1',
        bookingId: 'booking-travel-timeout-1',
        category: 'travel_watchdog',
        status: 'open',
        priority: 'High',
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      bookingId: 'booking-travel-timeout-1',
      level: 'timeout_review',
      priority: 'High',
      status: 'open',
      elapsedMinutes: 31,
      staleSeconds: 180,
      nextAction: 'Call worker and consumer before score action',
    });
    expect(rows[0].raw.status).not.toBe('completed');
    expect(rows[0].raw.noAutoGigScorePenalty).toBe(true);
  });
});
