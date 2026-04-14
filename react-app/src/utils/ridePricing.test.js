import { calculateRidePrice } from './ridePricing';

describe('calculateRidePrice', () => {
  it('calculates price for bike ride', () => {
    expect(calculateRidePrice({ driverType: 'bike', distanceKm: 5, durationMin: 15 })).toBe(20 + 5*7 + 15*1);
  });
  it('calculates price for auto ride', () => {
    expect(calculateRidePrice({ driverType: 'auto', distanceKm: 10, durationMin: 30 })).toBe(30 + 10*10 + 30*1.5);
  });
  it('calculates price for car ride', () => {
    expect(calculateRidePrice({ driverType: 'car', distanceKm: 8, durationMin: 20 })).toBe(50 + 8*15 + 20*2);
  });
  it('defaults to bike rates if unknown type', () => {
    expect(calculateRidePrice({ driverType: 'unknown', distanceKm: 2, durationMin: 5 })).toBe(20 + 2*7 + 5*1);
  });
});
