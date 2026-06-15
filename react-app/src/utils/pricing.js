import { DEFAULT_PRICING_SETTINGS, normalizePricingSettings } from '../config/pricingSettings';

/**
 * PRICING UTILITIES
 * Gigtos v1 uses a no-worker-commission model.
 * Consumers pay a booking platform fee and payment gateway fee while workers keep the worker price.
 *
 * LEGACY OVERLAP NOTE:
 * This helper still supports the older online-payment/booking-fee model. MVP Jobs v1
 * should use a backend demand-pricing contract instead, where consumer price equals
 * worker receivable and platform/payment fees are 0 until payment automation returns.
 * Keep this file for existing screens/tests; do not build new MVP auto-pricing on it.
 */

function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

export function calculateConsumerPlatformFee(baseAmount, settings = DEFAULT_PRICING_SETTINGS) {
  const base = Number(baseAmount);
  const pricingSettings = normalizePricingSettings(settings);

  if (isNaN(base) || base <= 0) {
    throw new Error('Invalid base amount');
  }

  if (pricingSettings.platformFeeMode === 'flat') {
    return roundMoney(pricingSettings.platformFeeFlat);
  }

  if (pricingSettings.platformFeeMode === 'percent') {
    return roundMoney(base * (pricingSettings.platformFeePercent / 100));
  }

  const lowMax = Math.min(pricingSettings.tieredFeeLowMax, pricingSettings.tieredFeeMidMax);
  const midMax = Math.max(pricingSettings.tieredFeeLowMax, pricingSettings.tieredFeeMidMax);
  if (base <= lowMax) return roundMoney(pricingSettings.tieredFeeLow);
  if (base <= midMax) return roundMoney(pricingSettings.tieredFeeMid);
  return roundMoney(pricingSettings.tieredFeeBase + base * (pricingSettings.tieredFeePercentAboveMid / 100));
}

/**
 * Calculate final consumer price.
 * @param {number} baseAmount - Worker's submitted amount
 * @param {object} settings - Superadmin controlled pricing settings
 * @returns {object} Breakdown of pricing
 */
export function calculateFinalPrice(baseAmount, settings = DEFAULT_PRICING_SETTINGS) {
  const base = Number(baseAmount);
  const pricingSettings = normalizePricingSettings(settings);

  if (isNaN(base) || base <= 0) {
    throw new Error('Invalid base amount');
  }

  const platformFee = calculateConsumerPlatformFee(base, pricingSettings);
  const platformFeePercent = pricingSettings.platformFeeMode === 'percent'
    ? pricingSettings.platformFeePercent
    : base > pricingSettings.tieredFeeMidMax && pricingSettings.platformFeeMode === 'tiered'
      ? pricingSettings.tieredFeePercentAboveMid
      : 0;
  const amountAfterMarkup = base + platformFee;
  const paymentChargePercent = pricingSettings.gatewayFeePercent;
  const paymentCharge = pricingSettings.gatewayFeePaidBy === 'consumer'
    ? amountAfterMarkup * (paymentChargePercent / 100)
    : 0;
  const finalTotal = amountAfterMarkup + paymentCharge;

  return {
    baseAmount: roundMoney(base),
    platformFee: roundMoney(platformFee),
    platformFeePercent,
    amountAfterMarkup: roundMoney(amountAfterMarkup),
    paymentCharge: roundMoney(paymentCharge),
    paymentChargePercent,
    finalTotal: roundMoney(finalTotal),
    workerReceives: roundMoney(base),
    pricingSettings,
  };
}

/**
 * Format price breakdown for display
 * @param {number} baseAmount - Worker amount
 * @param {object} settings - Superadmin controlled pricing settings
 * @returns {string} Formatted breakdown string
 */
export function formatPriceBreakdown(baseAmount, settings = DEFAULT_PRICING_SETTINGS) {
  const breakdown = calculateFinalPrice(baseAmount, settings);
  return `Worker price: ₹${breakdown.baseAmount} + Gigtos booking fee: ₹${breakdown.platformFee} + payment gateway fee: ₹${breakdown.paymentCharge} = Total: ₹${breakdown.finalTotal}`;
}
