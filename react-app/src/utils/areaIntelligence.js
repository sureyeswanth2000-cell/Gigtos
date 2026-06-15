const HEALTH_WEIGHT = {
  supply_gap: 0,
  peak_active: 1,
  low_sample: 2,
  manual_override: 3,
  stale_snapshot: 4,
  missing_snapshot: 5,
  healthy: 6,
  disabled: 7,
};

const DEMAND_WEIGHT = {
  peak: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const CITY_FALLBACK_CENTERS = {
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  delhi: { lat: 28.6139, lng: 77.209 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
};

function getNestedCoordinate(source, latKeys, lngKeys) {
  if (!source || typeof source !== 'object') return null;
  for (const latKey of latKeys) {
    const lat = optionalNumber(source[latKey]);
    if (lat === null) continue;
    for (const lngKey of lngKeys) {
      const lng = optionalNumber(source[lngKey]);
      if (lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}

export function timestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatRelativeAge(value, now = Date.now()) {
  const millis = timestampToMillis(value);
  if (!millis) return 'not computed';
  const diffMinutes = Math.max(0, Math.round((Number(now) - millis) / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes ? `${hours}h ${minutes}m ago` : `${hours}h ago`;
}

export function getDemandBadgeClass(level) {
  if (level === 'peak') return 'is-peak';
  if (level === 'high') return 'is-high';
  if (level === 'low') return 'is-low';
  return 'is-normal';
}

function toNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function buildKey({ areaId, serviceId }) {
  return `${areaId || ''}_${serviceId || ''}`;
}

function getLatestSnapshots(areaDemandSnapshots) {
  const latestSnapshotByRule = new Map();
  areaDemandSnapshots.forEach(snapshot => {
    const key = buildKey(snapshot);
    const existing = latestSnapshotByRule.get(key);
    if (!existing || timestampToMillis(snapshot.computedAt) > timestampToMillis(existing.computedAt)) {
      latestSnapshotByRule.set(key, snapshot);
    }
  });
  return latestSnapshotByRule;
}

function buildQuoteStats(priceQuotes = []) {
  const quoteStats = new Map();
  priceQuotes.forEach(quote => {
    const key = buildKey(quote);
    if (!key.trim()) return;
    const current = quoteStats.get(key) || { shown: 0, converted: 0, totalPrice: 0 };
    const price = toNumber(quote.finalConsumerPrice || quote.workerReceivable || quote.unitPrice, 0);
    const status = String(quote.status || '').toLowerCase();
    const converted = Boolean(quote.bookingId) && !['expired', 'cancelled', 'canceled'].includes(status);
    quoteStats.set(key, {
      shown: current.shown + 1,
      converted: current.converted + (converted ? 1 : 0),
      totalPrice: current.totalPrice + price,
    });
  });
  return quoteStats;
}

function buildRecruitSuggestion({ rule, demandLevel, openWorkers, openJobs, noWorkerSearches, lowSampleSize, supplyGap }) {
  const service = rule.serviceName || rule.serviceId || 'this service';
  const area = rule.areaName || rule.areaId || 'this area';
  if (rule.enabled === false) return 'Rule disabled; enable only when supply is ready.';
  if (openWorkers === 0) return `Recruit or activate ${service} workers in ${area}.`;
  if (noWorkerSearches > 0) return `Recover ${noWorkerSearches} no-worker searches and recruit more ${service} workers.`;
  if (openJobs > openWorkers) return `Open jobs exceed open workers; ask verified ${service} workers to go online.`;
  if (demandLevel === 'peak') return `Peak demand active; keep price cap tight and activate reserve workers.`;
  if (lowSampleSize) return `Low worker sample; avoid fake peak pricing until supply grows.`;
  if (supplyGap) return `Watch supply closely before raising price again.`;
  return `Healthy for now; monitor conversion before changing caps.`;
}

function buildHealthLabels({ health, rule, snapshot, lowSampleSize, manualOverrideActive, peakActive, conversionPercent }) {
  const labels = [];
  if (health === 'disabled') labels.push('rule disabled');
  if (!snapshot) labels.push('missing snapshot');
  if (health === 'stale_snapshot') labels.push('stale snapshot');
  if (lowSampleSize) labels.push('low sample');
  if (manualOverrideActive) labels.push('manual override');
  if (peakActive) labels.push('peak active');
  if (conversionPercent !== null) labels.push(`${conversionPercent}% price-to-queue`);
  if (rule.enabled !== false && labels.length === 0) labels.push('healthy');
  return labels;
}

export function buildAreaIntelligenceRows(servicePriceRules = [], areaDemandSnapshots = [], priceQuotes = [], now = Date.now()) {
  const latestSnapshotByRule = getLatestSnapshots(areaDemandSnapshots);
  const quoteStats = buildQuoteStats(priceQuotes);

  return servicePriceRules.map(rule => {
    const key = buildKey(rule);
    const snapshot = latestSnapshotByRule.get(key);
    const stats = quoteStats.get(key) || { shown: 0, converted: 0, totalPrice: 0 };
    const expiresAtMs = timestampToMillis(snapshot?.expiresAt);
    const isStale = !snapshot || (expiresAtMs && expiresAtMs < Number(now));
    const openWorkers = toNumber(snapshot?.openWorkers, 0);
    const busyWorkers = toNumber(snapshot?.busyWorkers, 0);
    const activePoolWorkers = toNumber(snapshot?.activePoolWorkers, openWorkers + busyWorkers);
    const openJobs = toNumber(snapshot?.openJobs, 0);
    const searches = toNumber(snapshot?.searches, 0);
    const noWorkerSearches = toNumber(snapshot?.noWorkerSearches, 0);
    const demandLevel = rule.manualDemandLevel || snapshot?.demandLevel || 'normal';
    const lowSampleSize = Boolean(snapshot?.lowSampleSize) ||
      (activePoolWorkers > 0 && activePoolWorkers < Math.min(toNumber(rule.minimumWorkerThreshold, 20), 5));
    const manualOverrideActive = Boolean(rule.manualDemandLevel);
    const peakActive = demandLevel === 'peak';
    const supplyGap = rule.enabled !== false && (
      openWorkers === 0 ||
      noWorkerSearches > 0 ||
      openJobs > openWorkers ||
      peakActive
    );
    const conversionPercent = stats.shown > 0 ? Math.round((stats.converted / stats.shown) * 100) : null;
    const averageShownPrice = stats.shown > 0 ? Math.round(stats.totalPrice / stats.shown) : null;

    const health = rule.enabled === false
      ? 'disabled'
      : !snapshot
        ? 'missing_snapshot'
        : isStale
          ? 'stale_snapshot'
          : supplyGap
            ? 'supply_gap'
            : peakActive
              ? 'peak_active'
              : lowSampleSize
                ? 'low_sample'
                : manualOverrideActive
                  ? 'manual_override'
                  : 'healthy';

    return {
      id: rule.id || key,
      rule,
      snapshot,
      demandLevel,
      openWorkers,
      busyWorkers,
      activePoolWorkers,
      openJobs,
      searches,
      noWorkerSearches,
      utilizationPercent: toNumber(snapshot?.utilizationPercent, 0),
      recommendedPrice: toNumber(snapshot?.recommendedPrice || rule.normalPrice, 0),
      quoteShownCount: stats.shown,
      quoteConvertedCount: stats.converted,
      conversionPercent,
      averageShownPrice,
      health,
      healthLabels: buildHealthLabels({ health, rule, snapshot, lowSampleSize, manualOverrideActive, peakActive, conversionPercent }),
      isStale,
      lowSampleSize,
      manualOverrideActive,
      peakActive,
      supplyGap,
      computedAge: formatRelativeAge(snapshot?.computedAt, now),
      recruitSuggestion: buildRecruitSuggestion({
        rule,
        demandLevel,
        openWorkers,
        openJobs,
        noWorkerSearches,
        lowSampleSize,
        supplyGap,
      }),
    };
  }).sort((a, b) => {
    return (HEALTH_WEIGHT[a.health] ?? 99) - (HEALTH_WEIGHT[b.health] ?? 99) ||
      (DEMAND_WEIGHT[a.demandLevel] ?? 99) - (DEMAND_WEIGHT[b.demandLevel] ?? 99) ||
      String(a.rule.city || '').localeCompare(String(b.rule.city || '')) ||
      String(a.rule.areaId || '').localeCompare(String(b.rule.areaId || '')) ||
      String(a.rule.serviceId || '').localeCompare(String(b.rule.serviceId || ''));
  });
}

export function buildAreaIntelSummary(rows = [], servicePriceRules = [], areaDemandSnapshots = [], priceQuotes = []) {
  const quotesShown = rows.reduce((sum, row) => sum + row.quoteShownCount, 0);
  const quotesConverted = rows.reduce((sum, row) => sum + row.quoteConvertedCount, 0);
  return {
    totalRules: servicePriceRules.length,
    snapshotsWatched: areaDemandSnapshots.length,
    freshSnapshots: rows.filter(row => row.snapshot && !row.isStale).length,
    staleOrMissing: rows.filter(row => row.health === 'stale_snapshot' || row.health === 'missing_snapshot').length,
    supplyGaps: rows.filter(row => row.supplyGap).length,
    peakActive: rows.filter(row => row.peakActive).length,
    lowSample: rows.filter(row => row.lowSampleSize).length,
    manualOverrides: rows.filter(row => row.manualOverrideActive).length,
    quotesShown,
    quotesConverted,
    conversionPercent: quotesShown > 0 ? Math.round((quotesConverted / quotesShown) * 100) : null,
    priceQuoteSample: priceQuotes.length,
  };
}

function getRowCoordinate(row) {
  const rule = row?.rule || {};
  const snapshot = row?.snapshot || {};
  const direct = getNestedCoordinate(
    { ...snapshot, ...rule },
    ['areaCenterLat', 'centerLat', 'areaLat', 'lat'],
    ['areaCenterLng', 'centerLng', 'areaLng', 'lng']
  );
  const nested = direct ||
    getNestedCoordinate(rule.areaCenter, ['lat', 'latitude'], ['lng', 'longitude']) ||
    getNestedCoordinate(rule.center, ['lat', 'latitude'], ['lng', 'longitude']) ||
    getNestedCoordinate(rule.location, ['lat', 'latitude'], ['lng', 'longitude']) ||
    getNestedCoordinate(snapshot.areaCenter, ['lat', 'latitude'], ['lng', 'longitude']) ||
    getNestedCoordinate(snapshot.center, ['lat', 'latitude'], ['lng', 'longitude']) ||
    getNestedCoordinate(snapshot.location, ['lat', 'latitude'], ['lng', 'longitude']);
  if (nested) {
    return {
      ...nested,
      coordinateConfidence: 'area_center',
      coordinateSource: rule.areaCenterSource || snapshot.areaCenterSource || 'aggregate_area_center',
    };
  }
  const cityKey = String(rule.city || snapshot.city || '').trim().toLowerCase();
  const fallback = CITY_FALLBACK_CENTERS[cityKey];
  return fallback ? { ...fallback, coordinateConfidence: 'city_fallback', coordinateSource: 'city_fallback' } : null;
}

export function getAreaMapMarkerClass(health) {
  if (health === 'supply_gap' || health === 'peak_active') return 'is-critical';
  if (health === 'stale_snapshot' || health === 'missing_snapshot') return 'is-warning';
  if (health === 'low_sample' || health === 'manual_override') return 'is-watch';
  if (health === 'disabled') return 'is-muted';
  return 'is-healthy';
}

export function buildAreaMapPoints(rows = []) {
  const coordinateUseCount = new Map();
  return rows
    .map(row => {
      const coordinate = getRowCoordinate(row);
      if (!coordinate) return null;
      const key = `${coordinate.lat.toFixed(4)}_${coordinate.lng.toFixed(4)}`;
      const count = coordinateUseCount.get(key) || 0;
      coordinateUseCount.set(key, count + 1);
      const ring = Math.floor(count / 8) + 1;
      const angle = (count % 8) * (Math.PI / 4);
      const offset = count === 0 ? { lat: 0, lng: 0 } : {
        lat: Math.sin(angle) * 0.0025 * ring,
        lng: Math.cos(angle) * 0.0025 * ring,
      };
      return {
        id: row.id,
        lat: coordinate.lat + offset.lat,
        lng: coordinate.lng + offset.lng,
        originalLat: coordinate.lat,
        originalLng: coordinate.lng,
        coordinateConfidence: coordinate.coordinateConfidence,
        coordinateSource: coordinate.coordinateSource,
        city: row.rule?.city || row.snapshot?.city || '',
        areaName: row.rule?.areaName || row.rule?.areaId || '',
        areaId: row.rule?.areaId || row.snapshot?.areaId || '',
        serviceName: row.rule?.serviceName || row.rule?.serviceId || '',
        serviceId: row.rule?.serviceId || row.snapshot?.serviceId || '',
        health: row.health,
        healthLabels: row.healthLabels || [],
        markerClass: getAreaMapMarkerClass(row.health),
        demandLevel: row.demandLevel,
        openWorkers: row.openWorkers,
        busyWorkers: row.busyWorkers,
        activePoolWorkers: row.activePoolWorkers,
        openJobs: row.openJobs,
        noWorkerSearches: row.noWorkerSearches,
        searches: row.searches,
        utilizationPercent: row.utilizationPercent,
        recommendedPrice: row.recommendedPrice,
        conversionPercent: row.conversionPercent,
        quoteShownCount: row.quoteShownCount,
        recruitSuggestion: row.recruitSuggestion,
      };
    })
    .filter(Boolean);
}
