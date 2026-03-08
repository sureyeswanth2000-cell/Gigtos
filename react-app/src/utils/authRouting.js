export function getAdminRedirectPath(adminData) {
  const role = adminData?.role || 'unknown';

  if (role === 'superadmin') return '/admin/super';
  if (role === 'regionLead') return '/admin/region-lead';
  return '/admin/bookings';
}

export function isRegionSuspended(adminData) {
  return adminData?.regionStatus === 'suspended';
}
