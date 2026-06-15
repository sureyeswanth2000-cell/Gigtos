import {
  buildAreaDemandSnapshot,
  buildServicePriceRule,
} from './backendContracts';
import {
  calculateMvpDemandPrice,
  buildDemandRefreshPubSubMessage,
  evaluateDemandSnapshotState,
  resolveDemandLevel,
  shouldRefreshDemandSnapshot,
} from './mvpDemandPricing';

const requestedAt = new Date('2026-05-26T10:00:00Z');

function bathroomRule(overrides = {}) {
  return buildServicePriceRule({
    city: 'Hyderabad',
    areaName: 'Kukatpally',
    serviceId: 'bathroom_cleaning',
    ...overrides,
  });
}

function bathroomSnapshot(overrides = {}) {
  return buildAreaDemandSnapshot({
    city: 'Hyderabad',
    areaName: 'Kukatpally',
    serviceId: 'bathroom_cleaning',
    computedAt: new Date('2026-05-26T09:30:00Z'),
    expiresAt: new Date('2026-05-26T10:45:00Z'),
    openWorkers: 10,
    busyWorkers: 10,
    activePoolWorkers: 20,
    demandLevel: 'normal',
    recommendedPrice: 349,
    ...overrides,
  });
}

function quote(overrides = {}) {
  return calculateMvpDemandPrice({
    serviceId: 'bathroom_cleaning',
    city: 'Hyderabad',
    areaId: 'hyderabad_kukatpally',
    workerId: 'worker-1',
    workerBasePrice: 349,
    rule: bathroomRule(),
    snapshot: bathroomSnapshot(),
    requestedAt,
    ...overrides,
  });
}

describe('MVP deterministic demand pricing', () => {
  it('uses low demand pricing without reducing below the valid worker/min price', () => {
    const result = quote({
      workerBasePrice: 249,
      snapshot: bathroomSnapshot({
        demandLevel: 'low',
        openWorkers: 18,
        busyWorkers: 2,
        utilizationPercent: 10,
        searches: 1,
      }),
    });

    expect(result).toMatchObject({
      demandLevel: 'low',
      finalConsumerPrice: 249,
      workerReceivable: 249,
      priceSource: 'demand_snapshot',
    });
  });

  it('uses normal area price when demand is stable', () => {
    const result = quote({ workerBasePrice: 300 });

    expect(result).toMatchObject({
      demandLevel: 'normal',
      finalConsumerPrice: 349,
      workerReceivable: 349,
      unitPrice: 349,
    });
  });

  it('uses high demand price within cap', () => {
    const result = quote({
      snapshot: bathroomSnapshot({
        demandLevel: 'high',
        openWorkers: 4,
        busyWorkers: 16,
        searches: 20,
        recommendedPrice: 399,
      }),
    });

    expect(result).toMatchObject({
      demandLevel: 'high',
      finalConsumerPrice: 399,
      workerReceivable: 399,
    });
    expect(result.explanationConsumer).toContain('High demand now');
  });

  it('uses peak price only when minimum pool and 90 percent utilization pass', () => {
    const result = quote({
      snapshot: bathroomSnapshot({
        demandLevel: 'peak',
        openWorkers: 2,
        busyWorkers: 18,
        activePoolWorkers: 20,
        utilizationPercent: 90,
        recommendedPrice: 499,
      }),
    });

    expect(result).toMatchObject({
      demandLevel: 'peak',
      finalConsumerPrice: 499,
      workerReceivable: 499,
    });
    expect(result.reasonCodes).toContain('NINETY_PERCENT_RULE_CONFIRMED');
  });

  it('blocks fake peak pricing when sample size or threshold is too low', () => {
    const resolved = resolveDemandLevel({
      rule: bathroomRule(),
      requestedAt,
      snapshot: bathroomSnapshot({
        demandLevel: 'peak',
        openWorkers: 0,
        busyWorkers: 1,
        activePoolWorkers: 1,
        utilizationPercent: 100,
        lowSampleSize: true,
        searches: 8,
      }),
    });

    expect(resolved.demandLevel).toBe('high');
    expect(resolved.priceSource).toBe('snapshot_peak_guarded');
    expect(resolved.reasonCodes).toContain('PEAK_BLOCKED_BY_SAMPLE_OR_THRESHOLD');
  });

  it('falls back to normal price when demand snapshot is stale', () => {
    const result = quote({
      snapshot: bathroomSnapshot({
        demandLevel: 'peak',
        expiresAt: new Date('2026-05-26T09:59:00Z'),
      }),
    });

    expect(result).toMatchObject({
      demandLevel: 'normal',
      priceSource: 'stale_snapshot_fallback',
      finalConsumerPrice: 349,
      workerReceivable: 349,
      confidence: 'low',
    });
    expect(result.reasonCodes).toContain('SNAPSHOT_STALE');
  });

  it('raises worker price to local minimum when worker entered too low', () => {
    const result = quote({
      workerBasePrice: 200,
      snapshot: bathroomSnapshot({ demandLevel: 'low' }),
    });

    expect(result).toMatchObject({
      finalConsumerPrice: 249,
      workerReceivable: 249,
      adjustedWorkerPrice: 249,
      workerPriceStatus: 'raised_to_min',
    });
    expect(result.reasonCodes).toContain('WORKER_PRICE_RAISED_TO_MIN');
  });

  it('blocks worker price above max guardrail instead of silently reducing it', () => {
    expect(() => quote({ workerBasePrice: 600 })).toThrow('workerBasePrice exceeds workerMaxPrice');
  });

  it('allows SuperAdmin manual demand override but still respects max cap', () => {
    const result = quote({
      workerBasePrice: 480,
      manualOverride: {
        active: true,
        demandLevel: 'peak',
        reason: 'Festival local demand',
      },
      snapshot: bathroomSnapshot({ demandLevel: 'normal' }),
    });

    expect(result).toMatchObject({
      demandLevel: 'peak',
      priceSource: 'manual_override',
      finalConsumerPrice: 499,
      workerReceivable: 499,
      manualOverrideApplied: true,
      manualOverrideReason: 'Festival local demand',
      overrideHierarchy: 'disabled_rule > worker_price_cap > superadmin_manual_demand_with_reason > fresh_snapshot > safe_normal_fallback > max_price_cap',
    });
    expect(result.reasonCodes).toContain('MANUAL_OVERRIDE_ACTIVE');
    expect(result.reasonCodes).toContain('MAX_CAP_APPLIED');
  });

  it('blocks manual demand override when audit reason is missing', () => {
    const result = quote({
      workerBasePrice: 300,
      manualOverride: {
        active: true,
        demandLevel: 'peak',
        reason: 'short',
      },
      snapshot: bathroomSnapshot({ demandLevel: 'normal' }),
    });

    expect(result).toMatchObject({
      demandLevel: 'normal',
      priceSource: 'demand_snapshot',
      manualOverrideApplied: false,
      manualOverrideReason: null,
      finalConsumerPrice: 349,
    });
    expect(result.reasonCodes).toContain('MANUAL_OVERRIDE_BLOCKED_MISSING_AUDIT_REASON');
    expect(result.reasonCodes).not.toContain('MANUAL_OVERRIDE_ACTIVE');
  });

  it('marks missing or stale snapshot data for refresh before it can hurt pricing', () => {
    expect(evaluateDemandSnapshotState({ snapshot: null, requestedAt })).toMatchObject({
      usable: false,
      stale: true,
      missing: true,
    });

    const refresh = shouldRefreshDemandSnapshot({
      eventType: 'booking_requested',
      snapshot: bathroomSnapshot(),
      requestedAt,
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
    });

    expect(refresh).toMatchObject({
      shouldRefresh: true,
      priority: 'high',
      transport: 'pubsub',
      topic: 'gigtos-demand-refresh-v1',
      aggregationKey: 'hyderabad__hyderabad_kukatpally__bathroom_cleaning',
      debounceSeconds: 30,
    });
    expect(refresh.reasonCodes).toContain('EVENT_REFRESH_REQUIRED');
    expect(refresh.reasonCodes).toContain('PUBSUB_DEBOUNCE_APPLIED');
  });

  it('builds Pub/Sub refresh messages that can debounce database load by area and service', () => {
    const first = buildDemandRefreshPubSubMessage({
      eventType: 'consumer_search',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      snapshot: bathroomSnapshot(),
      requestedAt: new Date('2026-05-26T10:00:15Z'),
      searchId: 'search-1',
    });
    const second = buildDemandRefreshPubSubMessage({
      eventType: 'consumer_search',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      snapshot: bathroomSnapshot(),
      requestedAt: new Date('2026-05-26T10:01:30Z'),
      searchId: 'search-2',
    });

    expect(first).toMatchObject({
      topic: 'gigtos-demand-refresh-v1',
      orderingKey: 'hyderabad__hyderabad_kukatpally__bathroom_cleaning',
      firestoreQueueDocId: first.dedupeKey,
    });
    expect(first.dedupeKey).toBe(second.dedupeKey);
    expect(first.attributes).toEqual({
      eventType: 'consumer_search',
      city: 'hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      priority: 'normal',
      aggregationKey: 'hyderabad__hyderabad_kukatpally__bathroom_cleaning',
    });
    expect(first.json).not.toHaveProperty('consumerAddress');
    expect(first.json.debounceSeconds).toBe(120);
  });

  it('keeps manual override Pub/Sub refresh immediate and non-debounced', () => {
    const message = buildDemandRefreshPubSubMessage({
      eventType: 'manual_override_saved',
      city: 'Hyderabad',
      areaId: 'hyderabad_kukatpally',
      serviceId: 'bathroom_cleaning',
      snapshot: bathroomSnapshot(),
      requestedAt,
    });

    expect(message.refresh).toMatchObject({
      priority: 'immediate',
      debounceSeconds: 0,
    });
    expect(message.json.nextRefreshBy).toBe('2026-05-26T10:00:00.000Z');
    expect(message.refresh.reasonCodes).toContain('MANUAL_OVERRIDE_REFRESH');
  });
});
