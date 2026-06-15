import {
  buildAreaIntelSummary,
  buildAreaIntelligenceRows,
  buildAreaMapPoints,
  getDemandBadgeClass,
} from './areaIntelligence';
import { buildAreaDemandSnapshot, buildServicePriceRule } from './backendContracts';

describe('area intelligence aggregation', () => {
  const now = new Date('2026-05-27T10:00:00Z').getTime();

  it('prioritizes supply gaps and keeps recruiting advice aggregate-only', () => {
    const rule = buildServicePriceRule({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      minimumWorkerThreshold: 20,
    });
    const snapshot = buildAreaDemandSnapshot({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      computedAt: new Date('2026-05-27T09:58:00Z'),
      expiresAt: new Date('2026-05-27T11:00:00Z'),
      openWorkers: 0,
      busyWorkers: 8,
      openJobs: 3,
      noWorkerSearches: 2,
      demandLevel: 'high',
      recommendedPrice: 399,
    });

    const [row] = buildAreaIntelligenceRows([rule], [snapshot], [], now);

    expect(row).toMatchObject({
      health: 'supply_gap',
      supplyGap: true,
      noWorkerSearches: 2,
      demandLevel: 'high',
    });
    expect(row.recruitSuggestion).toContain('Recruit or activate');
    expect(row.recruitSuggestion).not.toContain('lat');
    expect(row.recruitSuggestion).not.toContain('lng');
  });

  it('flags stale, low sample, manual override, and quote conversion signals', () => {
    const rule = buildServicePriceRule({
      city: 'Hyderabad',
      areaName: 'Miyapur',
      serviceId: 'maid_hourly_basic_help',
      manualDemandLevel: 'peak',
    });
    const snapshot = buildAreaDemandSnapshot({
      city: 'Hyderabad',
      areaName: 'Miyapur',
      serviceId: 'maid_hourly_basic_help',
      computedAt: new Date('2026-05-27T08:00:00Z'),
      expiresAt: new Date('2026-05-27T09:00:00Z'),
      openWorkers: 2,
      busyWorkers: 1,
      demandLevel: 'normal',
      lowSampleSize: true,
      recommendedPrice: 180,
    });
    const priceQuotes = [
      {
        areaId: 'hyderabad_miyapur',
        serviceId: 'maid_hourly_basic_help',
        status: 'active',
        bookingId: 'booking-1',
        finalConsumerPrice: 180,
      },
      {
        areaId: 'hyderabad_miyapur',
        serviceId: 'maid_hourly_basic_help',
        status: 'expired',
        finalConsumerPrice: 180,
      },
    ];

    const [row] = buildAreaIntelligenceRows([rule], [snapshot], priceQuotes, now);
    const summary = buildAreaIntelSummary([row], [rule], [snapshot], priceQuotes);

    expect(row.health).toBe('stale_snapshot');
    expect(row.demandLevel).toBe('peak');
    expect(row.lowSampleSize).toBe(true);
    expect(row.manualOverrideActive).toBe(true);
    expect(row.conversionPercent).toBe(50);
    expect(row.healthLabels).toEqual(expect.arrayContaining(['stale snapshot', 'low sample', 'manual override', 'peak active', '50% price-to-queue']));
    expect(summary).toMatchObject({
      totalRules: 1,
      staleOrMissing: 1,
      lowSample: 1,
      manualOverrides: 1,
      quotesShown: 2,
      quotesConverted: 1,
      conversionPercent: 50,
    });
  });

  it('uses stable demand badge classes', () => {
    expect(getDemandBadgeClass('low')).toBe('is-low');
    expect(getDemandBadgeClass('high')).toBe('is-high');
    expect(getDemandBadgeClass('peak')).toBe('is-peak');
    expect(getDemandBadgeClass('normal')).toBe('is-normal');
  });

  it('builds aggregate map points from area centers without exact user locations', () => {
    const rule = {
      ...buildServicePriceRule({
        city: 'Hyderabad',
        areaName: 'Kukatpally',
        serviceId: 'bathroom_cleaning',
      }),
      areaCenter: { lat: 17.4933, lng: 78.3996 },
      areaCenterSource: 'superadmin_manual_area_center',
    };
    const snapshot = buildAreaDemandSnapshot({
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      openWorkers: 5,
      busyWorkers: 3,
      openJobs: 1,
      recommendedPrice: 349,
    });

    const [row] = buildAreaIntelligenceRows([rule], [snapshot], [], now);
    const [point] = buildAreaMapPoints([row]);

    expect(point).toMatchObject({
      coordinateConfidence: 'area_center',
      coordinateSource: 'superadmin_manual_area_center',
      city: 'Hyderabad',
      areaName: 'Kukatpally',
      serviceId: 'bathroom_cleaning',
      recommendedPrice: 349,
    });
    expect(point.lat).toBeCloseTo(17.4933, 5);
    expect(point.lng).toBeCloseTo(78.3996, 5);
    expect(JSON.stringify(point)).not.toContain('consumerLat');
    expect(JSON.stringify(point)).not.toContain('workerLat');
  });

  it('falls back to city map center and offsets overlapping service points', () => {
    const rules = ['maid_hourly_basic_help', 'kitchen_help'].map(serviceId => buildServicePriceRule({
      city: 'Bangalore',
      areaName: 'Indiranagar',
      serviceId,
    }));
    const snapshots = rules.map(rule => buildAreaDemandSnapshot({
      city: rule.city,
      areaName: rule.areaName,
      serviceId: rule.serviceId,
      openWorkers: 1,
      openJobs: 2,
      noWorkerSearches: 1,
      demandLevel: 'high',
    }));

    const rows = buildAreaIntelligenceRows(rules, snapshots, [], now);
    const points = buildAreaMapPoints(rows);

    expect(points).toHaveLength(2);
    expect(points[0].coordinateConfidence).toBe('city_fallback');
    expect(points[0].originalLat).toBeCloseTo(12.9716, 4);
    expect(points[0].originalLng).toBeCloseTo(77.5946, 4);
    expect(points[1].lat).not.toBe(points[0].lat);
    expect(points[1].lng).not.toBe(points[0].lng);
  });
});
