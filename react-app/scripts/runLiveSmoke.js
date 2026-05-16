const tls = require('tls');

const target = process.env.GIGTOS_SMOKE_URL || process.env.REACT_APP_PUBLIC_URL || '';
const basePath = '/Gigtos';
const routePaths = ['/', '/auth', '/jobs', '/service', '/worker/dashboard', '/admin/super'];

function normalizeBase(url) {
  return url.replace(/\/$/, '');
}

function routeUrl(base, route) {
  return `${normalizeBase(base)}${route === '/' ? '' : route}`;
}

async function checkHttp(url) {
  const startedAt = Date.now();
  const response = await fetch(url, { redirect: 'manual' });
  const body = await response.text();
  return {
    name: `HTTP ${url}`,
    passed: response.status >= 200 && response.status < 400,
    detail: `${response.status} ${response.headers.get('content-type') || ''} ${Date.now() - startedAt}ms`,
    body,
  };
}

function checkTls(hostname, port = 443) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      const daysRemaining = validTo ? Math.floor((validTo.getTime() - Date.now()) / 86400000) : 0;
      const passed = socket.authorized && daysRemaining >= 14;
      socket.end();
      resolve({
        name: `SSL certificate ${hostname}`,
        passed,
        detail: `authorized=${socket.authorized}; daysRemaining=${daysRemaining}`,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ name: `SSL certificate ${hostname}`, passed: false, detail: 'timeout' });
    });
    socket.on('error', (error) => {
      resolve({ name: `SSL certificate ${hostname}`, passed: false, detail: error.message });
    });
  });
}

async function run() {
  if (!target) {
    console.log('SKIP live smoke: set GIGTOS_SMOKE_URL to run staging/live URL checks.');
    process.exit(0);
  }

  const targetUrl = new URL(target);
  const checks = [];
  checks.push(await checkTls(targetUrl.hostname, Number(targetUrl.port || 443)));

  const smokeBase = targetUrl.pathname.endsWith(basePath)
    ? normalizeBase(target)
    : `${normalizeBase(target)}${basePath}`;

  for (const route of routePaths) {
    const result = await checkHttp(routeUrl(smokeBase, route));
    const isSpa = result.body.includes('<div id="root">') || result.body.includes('/static/js/');
    checks.push({ ...result, passed: result.passed && isSpa, detail: `${result.detail}; spa=${isSpa}` });
  }

  const home = await checkHttp(smokeBase);
  const hasMapLinkPattern = /google\.com\/maps|maps\/dir|maps\/search/i.test(home.body);
  checks.push({
    name: 'Maps/navigation integration visible in app bundle',
    passed: hasMapLinkPattern || /Google Maps|Navigate|Directions/i.test(home.body),
    detail: hasMapLinkPattern ? 'maps link pattern found' : 'maps wording fallback checked',
  });

  for (const check of checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name} - ${check.detail}`);
  }

  process.exit(checks.every((check) => check.passed) ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
