export function isDevBypassEnabled(env = process.env) {
  return env.REACT_APP_ENABLE_DEV_BYPASS === 'true' && env.REACT_APP_DEPLOY_ENV !== 'production';
}

export function getDevBypassUser(role, env = process.env) {
  if (!isDevBypassEnabled(env)) {
    throw new Error('Dev bypass is disabled');
  }

  const users = {
    consumer: {
      uid: 'dev-consumer-1',
      role: 'consumer',
      name: 'Dev Consumer',
      displayName: 'Dev Consumer',
      email: 'dev-consumer@gigtos.local',
      city: 'Bangalore',
      phone: '9000000001',
      address: 'Indiranagar, Bangalore',
      lat: 12.9784,
      lng: 77.6408,
    },
    worker: {
      uid: 'dev-worker-1',
      role: 'worker',
      name: 'Dev Worker',
      displayName: 'Dev Worker',
      email: 'dev-worker@gigtos.local',
      city: 'Bangalore',
      area: 'Indiranagar',
      serviceTypes: ['Home Helper', 'Electrician'],
      gigType: 'Home Helper',
      approvalStatus: 'approved',
      socioScore: 500,
      lat: 12.979,
      lng: 77.641,
    },
    superadmin: {
      uid: 'dev-superadmin-1',
      role: 'superadmin',
      name: 'Dev Superadmin',
      displayName: 'Dev Superadmin',
      email: 'dev-superadmin@gigtos.local',
    },
    field_operator: {
      uid: 'dev-field-operator-1',
      role: 'field_operator',
      name: 'Dev Field Operator',
      displayName: 'Dev Field Operator',
      email: 'dev-field@gigtos.local',
      city: 'Bangalore',
    },
  };

  if (!users[role]) throw new Error(`Unknown dev bypass role: ${role}`);
  return users[role];
}

export function getDevBypassRoleFromSearch(search = '') {
  const params = new URLSearchParams(search || getCurrentRouteSearch());
  return params.get('devAuth') || params.get('devRole') || '';
}

export function getDevBypassUserFromSearch(search = '', env = process.env) {
  const role = getDevBypassRoleFromSearch(search);
  if (!role) return null;
  return getDevBypassUser(role, env);
}

export function getCurrentRouteSearch() {
  if (typeof window === 'undefined') return '';
  if (window.location.search) return window.location.search;
  const hash = window.location.hash || '';
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return '';
  return hash.slice(queryStart);
}
