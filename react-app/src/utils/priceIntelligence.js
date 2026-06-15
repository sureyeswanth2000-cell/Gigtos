import { getServiceByName } from './serviceCatalog';

// LEGACY OVERLAP NOTE:
// This helper uses static frontend service bands. MVP Auto Pricing v1 should use
// backend `service_price_rules` + `area_demand_snapshots` so SuperAdmin can change
// city/area/service prices without deploys and every booking stores pricing evidence.

export function getSuggestedPriceBand({ serviceType, urgency = 'Normal', estimatedDays = 1, cityMultiplier = 1 }) {
  const service = getServiceByName(serviceType);
  const days = Math.max(1, Number(estimatedDays) || 1);
  const urgencyMultiplier = urgency === 'High' ? 1.25 : urgency === 'Medium' ? 1.1 : 1;
  const multiplier = days * urgencyMultiplier * Number(cityMultiplier || 1);
  const band = service.priceBand;

  return {
    min: Math.round(band.min * multiplier),
    fairMin: Math.round(band.fairMin * multiplier),
    fairMax: Math.round(band.fairMax * multiplier),
    premiumMin: Math.round(band.premiumMin * multiplier),
    serviceId: service.id,
    serviceType: service.name,
  };
}

export function formatPriceBand(band) {
  return `INR ${band.fairMin.toLocaleString('en-IN')} - INR ${band.fairMax.toLocaleString('en-IN')}`;
}

export function classifyWorkerPrice({ amount, serviceType, urgency = 'Normal', estimatedDays = 1 }) {
  const value = Number(amount);
  if (!value || value <= 0) return { label: 'invalid', message: 'Enter a valid worker price.' };

  const band = getSuggestedPriceBand({ serviceType, urgency, estimatedDays });
  if (value < band.min) {
    return { label: 'too_low', band, message: 'Price is unusually low; confirm scope so worker quality is not damaged.' };
  }
  if (value < band.fairMin) {
    return { label: 'value', band, message: 'Value price. Good for simple work or new worker recovery.' };
  }
  if (value <= band.fairMax) {
    return { label: 'fair', band, message: 'Fair market range for this service.' };
  }
  if (value < band.premiumMin) {
    return { label: 'high', band, message: 'High price. Show clear reason such as urgency, distance, or difficult work.' };
  }
  return { label: 'premium', band, message: 'Premium price. Needs strong proof, rating, or complex work scope.' };
}
