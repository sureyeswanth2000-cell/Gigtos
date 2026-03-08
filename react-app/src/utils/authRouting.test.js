import { getAdminRedirectPath, isRegionSuspended } from './authRouting';

describe('getAdminRedirectPath', () => {
  it('routes superadmin to super dashboard', () => {
    expect(getAdminRedirectPath({ role: 'superadmin' })).toBe('/admin/super');
  });

  it('routes region lead to region dashboard', () => {
    expect(getAdminRedirectPath({ role: 'regionLead' })).toBe('/admin/region-lead');
  });

  it('routes mason/admin roles to bookings dashboard', () => {
    expect(getAdminRedirectPath({ role: 'mason' })).toBe('/admin/bookings');
    expect(getAdminRedirectPath({ role: 'admin' })).toBe('/admin/bookings');
  });

  it('falls back to bookings for unknown role', () => {
    expect(getAdminRedirectPath({ role: 'something-else' })).toBe('/admin/bookings');
  });

  it('falls back to bookings when admin data is missing', () => {
    expect(getAdminRedirectPath(undefined)).toBe('/admin/bookings');
  });
});

describe('isRegionSuspended', () => {
  it('returns true only when regionStatus is suspended', () => {
    expect(isRegionSuspended({ regionStatus: 'suspended' })).toBe(true);
    expect(isRegionSuspended({ regionStatus: 'active' })).toBe(false);
    expect(isRegionSuspended({})).toBe(false);
    expect(isRegionSuspended(undefined)).toBe(false);
  });
});
