/**
 * PRICING UTILITIES
 * Gigtos v1 uses a no-worker-commission model.
 * Consumers pay a booking platform fee while workers keep the worker price.
 */

export function calculateConsumerPlatformFee(baseAmount) {
  const base = Number(baseAmount);

  if (isNaN(base) || base <= 0) {
    throw new Error('Invalid base amount');
  }

  if (base <= 500) return 19;
  if (base <= 1000) return 29;
  return Math.round((19 + base * 0.02) * 100) / 100;
}

/**
 * Calculate final consumer price.
 * @param {number} baseAmount - Worker's submitted amount
 * @returns {object} Breakdown of pricing
 */
export function calculateFinalPrice(baseAmount) {
  const base = Number(baseAmount);

  if (isNaN(base) || base <= 0) {
    throw new Error('Invalid base amount');
  }

  const platformFee = calculateConsumerPlatformFee(base);
  const platformFeePercent = base > 1000 ? 2 : 0;
  const amountAfterMarkup = base + platformFee;
  const paymentChargePercent = 0;
  const paymentCharge = 0;
  const finalTotal = amountAfterMarkup;

  return {
    baseAmount: Math.round(base * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    platformFeePercent,
    amountAfterMarkup: Math.round(amountAfterMarkup * 100) / 100,
    paymentCharge: Math.round(paymentCharge * 100) / 100,
    paymentChargePercent,
    finalTotal: Math.round(finalTotal * 100) / 100,
    workerReceives: Math.round(base * 100) / 100,
  };
}

/**
 * Format price breakdown for display
 * @param {number} baseAmount - Worker amount
 * @returns {string} Formatted breakdown string
 */
export function formatPriceBreakdown(baseAmount) {
  const breakdown = calculateFinalPrice(baseAmount);
  return `Worker price: ₹${breakdown.baseAmount} + Gigtos booking fee: ₹${breakdown.platformFee} = Total: ₹${breakdown.finalTotal}`;
}
