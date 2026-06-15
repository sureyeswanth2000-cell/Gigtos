import {
  inferCityAndArea,
  isQuoteExpired,
  toMvpServiceId,
} from './mvpQuoteClient';

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('../firebase', () => ({
  functionsInstance: {},
}));

describe('MVP quote client helpers', () => {
  it('maps launch catalog services to backend MVP service IDs', () => {
    expect(toMvpServiceId({ id: 'bathroom-cleaning' })).toBe('bathroom_cleaning');
    expect(toMvpServiceId({ id: 'kitchen-help' })).toBe('kitchen_help');
    expect(toMvpServiceId({ id: 'full-house-cleaning' })).toBe('full_house_basic_cleaning');
  });

  it('infers stable city, area, and areaId from profile/address context', () => {
    expect(inferCityAndArea({
      address: 'Indiranagar, Bangalore',
      profileCity: '',
      profileArea: '',
    })).toEqual({
      city: 'Bangalore',
      areaName: 'Indiranagar',
      areaId: 'bangalore_indiranagar',
    });

    expect(inferCityAndArea({
      address: 'Flat 1, Kukatpally, Hyderabad',
      profileCity: 'Hyderabad',
      profileArea: 'Kukatpally',
    }).areaId).toBe('hyderabad_kukatpally');
  });

  it('detects stale locked quotes before booking submit', () => {
    expect(isQuoteExpired({ priceLockedUntil: '2026-05-27T10:00:00.000Z' }, new Date('2026-05-27T10:01:00Z'))).toBe(true);
    expect(isQuoteExpired({ priceLockedUntil: '2026-05-27T10:10:00.000Z' }, new Date('2026-05-27T10:01:00Z'))).toBe(false);
  });
});
