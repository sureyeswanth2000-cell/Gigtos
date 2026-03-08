/**
 * PRICING UTILITY TESTS
 * Tests for pricing calculations with platform fees and payment charges
 */

import { calculateFinalPrice, formatPriceBreakdown } from './pricing';

describe('calculateFinalPrice', () => {
  test('calculates correct pricing for base amount 1000', () => {
    const result = calculateFinalPrice(1000);
    
    expect(result.baseAmount).toBe(1000);
    expect(result.platformFee).toBe(150); // 15% of 1000
    expect(result.platformFeePercent).toBe(15);
    expect(result.amountAfterMarkup).toBe(1150); // 1000 + 150
    expect(result.paymentCharge).toBe(23); // 2% of 1150
    expect(result.paymentChargePercent).toBe(2);
    expect(result.finalTotal).toBe(1173); // 1150 + 23
  });

  test('calculates correct pricing for base amount 500', () => {
    const result = calculateFinalPrice(500);
    
    expect(result.baseAmount).toBe(500);
    expect(result.platformFee).toBe(75); // 15% of 500
    expect(result.amountAfterMarkup).toBe(575); // 500 + 75
    expect(result.paymentCharge).toBe(11.5); // 2% of 575
    expect(result.finalTotal).toBe(586.5); // 575 + 11.5
  });

  test('handles decimal base amounts correctly', () => {
    const result = calculateFinalPrice(99.99);
    
    expect(result.baseAmount).toBe(99.99);
    expect(result.platformFee).toBe(15); // 15% rounded
    expect(result.amountAfterMarkup).toBe(114.99);
    expect(result.paymentCharge).toBe(2.3); // 2% rounded
    expect(result.finalTotal).toBe(117.29);
  });

  test('throws error for invalid base amount (zero)', () => {
    expect(() => calculateFinalPrice(0)).toThrow('Invalid base amount');
  });

  test('throws error for invalid base amount (negative)', () => {
    expect(() => calculateFinalPrice(-100)).toThrow('Invalid base amount');
  });

  test('throws error for invalid base amount (NaN)', () => {
    expect(() => calculateFinalPrice('invalid')).toThrow('Invalid base amount');
  });

  test('accepts string numbers and converts them', () => {
    const result = calculateFinalPrice('1000');
    expect(result.finalTotal).toBe(1173);
  });
});

describe('formatPriceBreakdown', () => {
  test('formats breakdown string correctly', () => {
    const formatted = formatPriceBreakdown(1000);
    expect(formatted).toContain('Base: ₹1000');
    expect(formatted).toContain('Platform Fee (15%): ₹150');
    expect(formatted).toContain('Payment Charges (2%): ₹23');
    expect(formatted).toContain('Total: ₹1173');
  });

  test('formats breakdown for different amount', () => {
    const formatted = formatPriceBreakdown(500);
    expect(formatted).toContain('Base: ₹500');
    expect(formatted).toContain('Total: ₹586.5');
  });
});
