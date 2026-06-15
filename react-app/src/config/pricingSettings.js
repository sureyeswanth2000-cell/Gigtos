export const DEFAULT_PRICING_SETTINGS = {
  platformFeeMode: 'tiered',
  platformFeeFlat: 29,
  platformFeePercent: 2,
  tieredFeeLowMax: 500,
  tieredFeeLow: 19,
  tieredFeeMidMax: 1000,
  tieredFeeMid: 29,
  tieredFeeBase: 19,
  tieredFeePercentAboveMid: 2,
  gatewayFeePercent: 2,
  gatewayFeePaidBy: 'consumer',
  currency: 'INR',
  payoutHoldMinutes: 120,
};

export const PAYOUT_HOLD_MINUTES_MIN = 30;
// Business safety cap: payout dispute hold can be configured up to 24 hours,
// but the effective clamped value should be displayed anywhere SuperAdmin edits it.
export const PAYOUT_HOLD_MINUTES_MAX = 24 * 60;

export function normalizePayoutHoldMinutes(value) {
  const minutes = Number(value ?? DEFAULT_PRICING_SETTINGS.payoutHoldMinutes);
  if (!Number.isFinite(minutes)) return DEFAULT_PRICING_SETTINGS.payoutHoldMinutes;
  return Math.max(PAYOUT_HOLD_MINUTES_MIN, Math.min(PAYOUT_HOLD_MINUTES_MAX, Math.round(minutes)));
}

export function formatPayoutHoldDuration(minutesValue) {
  const minutes = normalizePayoutHoldMinutes(minutesValue);
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export function normalizePricingSettings(settings = {}) {
  const mode = ['tiered', 'flat', 'percent'].includes(settings.platformFeeMode)
    ? settings.platformFeeMode
    : DEFAULT_PRICING_SETTINGS.platformFeeMode;

  return {
    ...DEFAULT_PRICING_SETTINGS,
    ...settings,
    platformFeeMode: mode,
    platformFeeFlat: Math.max(0, Number(settings.platformFeeFlat ?? DEFAULT_PRICING_SETTINGS.platformFeeFlat)),
    platformFeePercent: Math.max(0, Math.min(100, Number(settings.platformFeePercent ?? DEFAULT_PRICING_SETTINGS.platformFeePercent))),
    tieredFeeLowMax: Math.max(1, Number(settings.tieredFeeLowMax ?? DEFAULT_PRICING_SETTINGS.tieredFeeLowMax)),
    tieredFeeLow: Math.max(0, Number(settings.tieredFeeLow ?? DEFAULT_PRICING_SETTINGS.tieredFeeLow)),
    tieredFeeMidMax: Math.max(1, Number(settings.tieredFeeMidMax ?? DEFAULT_PRICING_SETTINGS.tieredFeeMidMax)),
    tieredFeeMid: Math.max(0, Number(settings.tieredFeeMid ?? DEFAULT_PRICING_SETTINGS.tieredFeeMid)),
    tieredFeeBase: Math.max(0, Number(settings.tieredFeeBase ?? DEFAULT_PRICING_SETTINGS.tieredFeeBase)),
    tieredFeePercentAboveMid: Math.max(0, Math.min(100, Number(settings.tieredFeePercentAboveMid ?? DEFAULT_PRICING_SETTINGS.tieredFeePercentAboveMid))),
    gatewayFeePercent: Math.max(0, Math.min(100, Number(settings.gatewayFeePercent ?? DEFAULT_PRICING_SETTINGS.gatewayFeePercent))),
    gatewayFeePaidBy: settings.gatewayFeePaidBy === 'platform' ? 'platform' : 'consumer',
    currency: settings.currency || DEFAULT_PRICING_SETTINGS.currency,
    payoutHoldMinutes: normalizePayoutHoldMinutes(settings.payoutHoldMinutes),
  };
}
