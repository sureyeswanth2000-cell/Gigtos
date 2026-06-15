import {
  MVP_JOB_DEFAULTS,
  buildAreaDemandSnapshot,
  buildAreaId,
  buildAssignmentCandidate,
  buildBookingPricingEvidence,
  buildLiveTrackingEvent,
  buildOperatorQualityNote,
  buildServicePriceRule,
  buildSmartQueueOffer,
  buildSupportTicket,
  buildWorkerOpenSession,
  buildWorkerAvailabilitySnapshot,
  buildWorkerWalletDueEntry,
} from './backendContracts';
import { buildOperatorConsoleSnapshot } from './operatorQueues';

describe('backend contract scaffolds', () => {
  it('builds assignment and availability payloads with stable IDs', () => {
    const availability = buildWorkerAvailabilitySnapshot({
      workerId: 'w1',
      serviceTypes: ['Kitchen Help'],
      city: 'Bangalore',
      area: 'Indiranagar',
      isReadyToday: true,
    });

    const candidate = buildAssignmentCandidate({
      booking: { id: 'b1', serviceType: 'Kitchen Help' },
      worker: { id: 'w1', name: 'Worker', gigScore: 720, tier: 'Gold', isReadyToday: true },
      distanceKm: 3,
      score: 92,
    });

    expect(availability.workerId).toBe('w1');
    expect(candidate.bookingId).toBe('b1');
    expect(candidate.rankingInputs.tier).toBe('Gold');
  });

  it('builds live tracking, support, wallet, and quality-note payloads', () => {
    expect(buildLiveTrackingEvent({
      bookingId: 'b1',
      workerId: 'w1',
      consumerId: 'c1',
      eventType: 'worker.arrived',
    })).toMatchObject({ bookingId: 'b1', eventType: 'worker.arrived', retentionClass: 'short_lived' });

    expect(buildSupportTicket({
      actorId: 'c1',
      role: 'consumer',
      issueType: 'payment',
      title: 'Payment pending',
    })).toMatchObject({ status: 'open', priority: 'Normal' });

    expect(buildWorkerWalletDueEntry({
      workerId: 'w1',
      bookingId: 'b1',
      platformFee: 19,
    })).toMatchObject({ amount: -19, status: 'due' });

    expect(buildOperatorQualityNote({
      operatorId: 'op1',
      targetType: 'worker',
      targetId: 'w1',
      note: 'Completion photo unclear',
      severity: 'High',
    })).toMatchObject({ requiresSuperadminReview: true });
  });

  it('derives operator queues for verification, disputes, quality, and support', () => {
    const snapshot = buildOperatorConsoleSnapshot({
      workers: [
        { id: 'w1', name: 'Pending Worker', approvalStatus: 'pending' },
        { id: 'w2', name: 'Low Score Worker', approvalStatus: 'approved', gigScore: 420 },
      ],
      bookings: [
        { id: 'b1', serviceType: 'Cleaning', workerId: 'w2', dispute: { status: 'open' } },
      ],
      tickets: [
        { id: 't1', title: 'Need help', status: 'open' },
      ],
    });

    expect(snapshot.totals).toEqual({ verification: 1, disputes: 1, quality: 1, support: 1, travel: 0 });
    expect(snapshot.travelResolvedHistoryQueue).toEqual([]);
  });

  it('keeps resolved travel watchdog cases in audit history without open queue count', () => {
    const snapshot = buildOperatorConsoleSnapshot({
      bookings: [
        {
          id: 'booking-travel-resolved',
          serviceType: 'Kitchen Help',
          workerName: 'Sana Khan',
          customerName: 'Dev Consumer',
          travelWatchdogStatus: 'timeout_review',
          travelWatchdogResolutionStatus: 'resolved',
          travelWatchdogResolutionDecision: 'confirmed_no_show',
          travelWatchdogResolutionReason: 'Confirmed after route evidence and calls.',
          travelWatchdogResolvedAt: new Date('2026-06-02T10:00:00Z'),
          travelWatchdogScoreDecision: 'pending_gigscore_review',
          travelWatchdogGigScoreReviewEventId: 'travel_no_show_booking-travel-resolved',
        },
      ],
      tickets: [
        {
          id: 'travel-ticket-resolved',
          bookingId: 'booking-ticket-only',
          category: 'travel_watchdog',
          status: 'closed',
          resolutionDecision: 'dismiss_gps_issue',
          resolution: 'GPS was stale but worker arrived after consumer call.',
          workerId: 'worker-1',
          resolvedAt: new Date('2026-06-02T09:00:00Z'),
        },
      ],
    });

    expect(snapshot.totals.travel).toBe(0);
    expect(snapshot.travelReviewQueue).toHaveLength(0);
    expect(snapshot.travelResolvedHistoryQueue).toHaveLength(2);
    expect(snapshot.travelResolvedHistoryQueue[0]).toMatchObject({
      bookingId: 'booking-travel-resolved',
      decision: 'confirmed_no_show',
      scoreDecision: 'pending_gigscore_review',
      gigScoreReviewEventId: 'travel_no_show_booking-travel-resolved',
    });
  });

  it('builds MVP area and service price-rule contracts with stable IDs and caps', () => {
    expect(buildAreaId({ city: 'Hyderabad', areaName: 'Kukatpally Phase 1' })).toBe('hyderabad_kukatpally_phase_1');

    const rule = buildServicePriceRule({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      updatedBy: 'superadmin-1',
      updateReason: 'MVP launch setup',
    });

    expect(rule).toMatchObject({
      id: 'hyderabad_kukatpally_bathroom_cleaning',
      areaId: 'hyderabad_kukatpally',
      minPrice: 249,
      normalPrice: 349,
      highPrice: 399,
      peakPrice: 499,
      workerMinPrice: 249,
      workerMaxPrice: 499,
      minimumWorkerThreshold: MVP_JOB_DEFAULTS.minimumWorkerThreshold,
      peakUtilizationPercent: 90,
    });
  });

  it('builds demand snapshots with derived active pool, utilization, and expiry', () => {
    const computedAt = new Date('2026-05-26T10:00:00Z');
    const snapshot = buildAreaDemandSnapshot({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      computedAt,
      openWorkers: 2,
      busyWorkers: 18,
      searches: 30,
      demandLevel: 'peak',
      recommendedPrice: 499,
      reasonCodes: ['NINETY_PERCENT_OCCUPIED'],
    });

    expect(snapshot).toMatchObject({
      areaId: 'hyderabad_kukatpally',
      activePoolWorkers: 20,
      utilizationPercent: 90,
      demandLevel: 'peak',
      recommendedPrice: 499,
    });
    expect(snapshot.expiresAt.toISOString()).toBe('2026-05-26T11:15:00.000Z');
  });

  it('builds worker Open-to-Work sessions with expiry and price context', () => {
    const openSince = new Date('2026-05-26T09:00:00Z');
    const session = buildWorkerOpenSession({
      workerId: 'worker-1',
      city: 'Hyderabad',
      areaIds: ['hyderabad_kukatpally'],
      serviceIds: ['bathroom_cleaning'],
      openSince,
      locationConsent: true,
      workerBasePrices: { bathroom_cleaning: 349 },
      currentSuggestedPrices: { bathroom_cleaning: 399 },
      acceptedDemandLevel: { bathroom_cleaning: 'high' },
    });

    expect(session).toMatchObject({
      workerId: 'worker-1',
      status: 'open',
      locationConsent: true,
      areaServiceKeys: ['hyderabad_kukatpally__bathroom_cleaning'],
      matchingOpenJobsCount: 0,
    });
    expect(session.expiresAt.toISOString()).toBe('2026-05-26T10:30:00.000Z');
  });

  it('stores MVP booking pricing evidence where consumer price equals worker receivable', () => {
    const rule = buildServicePriceRule({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
    });
    const snapshot = buildAreaDemandSnapshot({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      demandLevel: 'high',
      recommendedPrice: 399,
      reasonCodes: ['FEW_OPEN_WORKERS'],
      explanationConsumer: 'High demand now. Few workers are open nearby.',
    });

    const evidence = buildBookingPricingEvidence({
      serviceId: 'bathroom_cleaning',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      workerId: 'worker-1',
      workerBasePrice: 349,
      rule,
      snapshot,
      finalConsumerPrice: 399,
    });

    expect(evidence).toMatchObject({
      finalConsumerPrice: 399,
      workerReceivable: 399,
      platformFee: 0,
      snapshotDemandLevel: 'high',
      explanation: 'High demand now. Few workers are open nearby.',
    });
    expect(() => buildBookingPricingEvidence({
      serviceId: 'bathroom_cleaning',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      workerId: 'worker-1',
      finalConsumerPrice: 399,
      workerReceivable: 349,
    })).toThrow('MVP pricing requires');
  });

  it('builds Smart Queue offers with transparent rank score inputs', () => {
    const offer = buildSmartQueueOffer({
      bookingId: 'booking-1',
      workerId: 'worker-1',
      rank: 1,
      offeredAt: new Date('2026-05-26T10:00:00Z'),
      scoreBreakdown: {
        gigScore: 780,
        favoriteBoost: 20,
        sameAreaBoost: 40,
        distanceScore: 85,
        priceFitScore: 70,
        responseSpeedScore: 90,
        cancellationPenalty: 0,
        skipPenalty: 2,
        fairnessPenalty: 15,
      },
      matchingScope: 'nearby_radius',
      distanceKm: 4.2,
      distanceConfidence: 'coordinate',
    });

    expect(offer.scoreBreakdown.finalRankScore).toBe(1068);
    expect(offer.scoreBreakdown.fairnessPenalty).toBe(15);
    expect(offer.expiresAt.toISOString()).toBe('2026-05-26T10:01:30.000Z');
    expect(offer).toMatchObject({
      id: 'booking-1_worker-1_1',
      status: 'offered',
      queueVersion: 1,
      matchingScope: 'nearby_radius',
      distanceKm: 4.2,
      distanceConfidence: 'coordinate',
      radiusKm: 15,
    });
  });
});
