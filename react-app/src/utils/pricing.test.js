import {
  calculateConsumerPlatformFee,
  calculateFinalPrice,
  formatPriceBreakdown,
} from './pricing';

describe('calculateConsumerPlatformFee', () => {
  test('uses INR 19 for bookings up to INR 500', () => {
    expect(calculateConsumerPlatformFee(400)).toBe(19);
    expect(calculateConsumerPlatformFee(500)).toBe(19);
  });

  test('uses INR 29 for bookings from INR 501 to INR 1000', () => {
    expect(calculateConsumerPlatformFee(501)).toBe(29);
    expect(calculateConsumerPlatformFee(800)).toBe(29);
    expect(calculateConsumerPlatformFee(1000)).toBe(29);
  });

  test('uses INR 19 plus 2 percent above INR 1000', () => {
    expect(calculateConsumerPlatformFee(1200)).toBe(43);
    expect(calculateConsumerPlatformFee(2500)).toBe(69);
  });
});

describe('calculateFinalPrice', () => {
  test('calculates no-commission pricing for base amount 400', () => {
    const result = calculateFinalPrice(400);

    expect(result.baseAmount).toBe(400);
    expect(result.platformFee).toBe(19);
    expect(result.platformFeePercent).toBe(0);
    expect(result.paymentCharge).toBe(0);
    expect(result.finalTotal).toBe(419);
    expect(result.workerReceives).toBe(400);
  });

  test('calculates no-commission pricing for base amount 800', () => {
    const result = calculateFinalPrice(800);

    expect(result.baseAmount).toBe(800);
    expect(result.platformFee).toBe(29);
    expect(result.amountAfterMarkup).toBe(829);
    expect(result.finalTotal).toBe(829);
    expect(result.workerReceives).toBe(800);
  });

  test('calculates no-commission pricing for base amount 1200', () => {
    const result = calculateFinalPrice(1200);

    expect(result.baseAmount).toBe(1200);
    expect(result.platformFee).toBe(43);
    expect(result.platformFeePercent).toBe(2);
    expect(result.finalTotal).toBe(1243);
    expect(result.workerReceives).toBe(1200);
  });

  test('throws error for invalid base amount', () => {
    expect(() => calculateFinalPrice(0)).toThrow('Invalid base amount');
    expect(() => calculateFinalPrice(-100)).toThrow('Invalid base amount');
    expect(() => calculateFinalPrice('invalid')).toThrow('Invalid base amount');
  });

  test('accepts string numbers and converts them', () => {
    const result = calculateFinalPrice('1000');
    expect(result.finalTotal).toBe(1029);
  });
});

describe('formatPriceBreakdown', () => {
  test('formats breakdown string correctly', () => {
    const formatted = formatPriceBreakdown(1000);
    expect(formatted).toContain('Worker price: ₹1000');
    expect(formatted).toContain('Gigtos booking fee: ₹29');
    expect(formatted).toContain('Total: ₹1029');
  });
});
