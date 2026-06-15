const EARTH_RADIUS_KM = 6371;

// LEGACY OVERLAP NOTE:
// This utility is a local/frontend matcher for the older marketplace screens. The
// MVP Smart Queue v1 must move final ranking to backend-owned logic with approved
// workers, Open-to-Work sessions, same-area-first search, Google Maps ETA, radius
// expansion up to 15 km, favorite boost, skip history, and audit evidence.
// Keep this helper for existing tests/UI until the backend queue replaces it.

export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return Infinity;
  const toRad = (degrees) => (Number(degrees) * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export function getMatchingScope({ service, availableWorkerCount = 0, areaMinimum = 3 }) {
  if (service?.rareService || Number(availableWorkerCount) < Number(areaMinimum)) {
    return 'city';
  }
  return 'area_10km';
}

export function rankAvailableWorkers({
  workers = [],
  consumerLocation,
  serviceType,
  consumerId,
  badMatches = [],
  now = new Date(),
}) {
  const blockedWorkerIds = new Set(
    badMatches
      .filter((item) => item.consumerId === consumerId && item.active !== false)
      .map((item) => item.workerId)
  );

  return workers
    .filter((worker) => worker.availableToday !== false)
    .filter((worker) => !blockedWorkerIds.has(worker.id))
    .filter((worker) => !serviceType || worker.services?.includes(serviceType))
    .map((worker) => {
      const distance = distanceKm(consumerLocation, worker.location);
      const price = Number(worker.price || worker.dayRate || 0);
      const tierBoost = worker.tier === 'Diamond' ? 80 : worker.tier === 'Gold' ? 50 : worker.tier === 'Silver' ? 25 : 0;
      const score = Math.round(
        Number(worker.gigScore ?? worker.socioScore ?? 0) +
        tierBoost -
        Math.min(distance, 30) * 8 -
        Math.min(price / 100, 40)
      );
      return { ...worker, distanceKm: distance, matchScore: score, rankedAt: now };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function chooseAutoSelectWorker(input) {
  return rankAvailableWorkers(input)[0] || null;
}
