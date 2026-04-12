export function getAdminRedirectPath(adminData) {
  const role = adminData?.role || 'unknown';

  if (role === 'superadmin') return '/admin/super';
  if (role === 'regionLead' || role === 'region-lead') return '/admin/region-lead';
  if (role === 'mason') return '/mason/dashboard';
  return '/admin/bookings';
}

export function isRegionSuspended(adminData) {
  return adminData?.regionStatus === 'suspended';
}
