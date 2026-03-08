/**
 * PRICING UTILITIES
 * Calculates final prices with platform fees and payment charges
 */

/**
 * Calculate final price with markup and payment charges
 * @param {number} baseAmount - Mason's submitted base amount
 * @returns {object} Breakdown of pricing
 */
export function calculateFinalPrice(baseAmount) {
  const base = Number(baseAmount);
  
  if (isNaN(base) || base <= 0) {
    throw new Error('Invalid base amount');
  }

  // Step 1: Add 15% platform markup
  const platformFeePercent = 15;
  const platformFee = base * (platformFeePercent / 100);
  const amountAfterMarkup = base + platformFee;

  // Step 2: Add 2% payment processing charges on total
  const paymentChargePercent = 2;
  const paymentCharge = amountAfterMarkup * (paymentChargePercent / 100);
  const finalTotal = amountAfterMarkup + paymentCharge;

  return {
    baseAmount: Math.round(base * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    platformFeePercent,
    amountAfterMarkup: Math.round(amountAfterMarkup * 100) / 100,
    paymentCharge: Math.round(paymentCharge * 100) / 100,
    paymentChargePercent,
    finalTotal: Math.round(finalTotal * 100) / 100,
  };
}

/**
 * Format price breakdown for display
 * @param {number} baseAmount - Base amount
 * @returns {string} Formatted breakdown string
 */
export function formatPriceBreakdown(baseAmount) {
  const breakdown = calculateFinalPrice(baseAmount);
  return `Base: ₹${breakdown.baseAmount} + Platform Fee (${breakdown.platformFeePercent}%): ₹${breakdown.platformFee} + Payment Charges (${breakdown.paymentChargePercent}%): ₹${breakdown.paymentCharge} = Total: ₹${breakdown.finalTotal}`;
}
