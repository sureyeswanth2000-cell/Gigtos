const tls = require('tls');

const target = process.env.GIGTOS_SMOKE_URL || process.env.REACT_APP_PUBLIC_URL || '';
const basePath = '/Gigtos';
const routePaths = ['/', '/auth', '/jobs', '/service', '/privacy', '/worker/dashboard', '/admin/super'];
const requiredCspHosts = [
  'https://*.sentry.io',
  'https://*.ingest.sentry.io',
  'https://*.ingest.de.sentry.io',
];

function normalizeBase(url) {
  return url.replace(/\/$/, '');
}

function resolveSmokeBase(rawTarget) {
  const parsed = new URL(rawTarget);
  const normalized = normalizeBase(rawTarget);
  const path = parsed.pathname.replace(/\/$/, '');
  if (path && path !== '') return normalized;
  if (parsed.hostname.endsWith('github.io')) return `${normalized}${basePath}`;
  return normalized;
}

function routeUrl(base, route) {
  return `${normalizeBase(base)}/${route === '/' ? '' : `#${route}`}`;
}

async function checkHttp(url) {
  const startedAt = Date.now();
  const response = await fetch(url, { redirect: 'follow' });
  const body = await response.text();
  return {
    name: `HTTP ${url}`,
    passed: response.status >= 200 && response.status < 400,
    detail: `${response.status} ${response.headers.get('content-type') || ''} ${Date.now() - startedAt}ms`,
    body,
  };
}

async function checkSpaFallback(base) {
  const result = await checkHttp(`${normalizeBase(base)}/auth`);
  const hasFallbackRedirect = /pathSegmentsToKeep|l\.replace/.test(result.body);
  return {
    name: `GitHub Pages SPA fallback ${normalizeBase(base)}/auth`,
    passed: result.body.includes('<div id="root">') || hasFallbackRedirect,
    detail: `${result.detail}; fallback=${hasFallbackRedirect}`,
  };
}

async function checkBundleForMaps(homeBody, base) {
  const matches = [...homeBody.matchAll(/static\/js\/main\.[^"]+\.js/g)];
  const bundlePath = matches[0]?.[0];
  if (!bundlePath) {
    return {
      name: 'Maps/navigation integration visible in app bundle',
      passed: false,
      detail: 'main bundle not found',
    };
  }

  const bundleUrl = `${normalizeBase(base)}/${bundlePath}`;
  const bundle = await checkHttp(bundleUrl);
  const hasMapLinkPattern = /google\.com\/maps|maps\/dir|maps\/search/i.test(bundle.body);
  return {
    name: 'Maps/navigation integration visible in app bundle',
    passed: bundle.passed && hasMapLinkPattern,
    detail: `${bundle.detail}; maps=${hasMapLinkPattern}`,
  };
}

function checkCspAllowsSentryIngest(homeBody) {
  const cspMatch = homeBody.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i);
  const csp = cspMatch?.[1] || '';
  const connectSrc = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('connect-src')) || '';
  const missing = requiredCspHosts.filter((host) => !connectSrc.includes(host));
  return {
    name: 'CSP allows Sentry ingest',
    passed: missing.length === 0,
    detail: missing.length ? `missing=${missing.join(',')}` : 'connect-src includes Sentry ingest hosts',
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

  const smokeBase = resolveSmokeBase(target);

  for (const route of routePaths) {
    const result = await checkHttp(routeUrl(smokeBase, route));
    const isSpa = result.body.includes('<div id="root">') || result.body.includes('/static/js/');
    checks.push({ ...result, passed: result.passed && isSpa, detail: `${result.detail}; spa=${isSpa}` });
  }

  const home = await checkHttp(smokeBase);
  checks.push(await checkSpaFallback(smokeBase));
  checks.push(checkCspAllowsSentryIngest(home.body));
  checks.push(await checkBundleForMaps(home.body, smokeBase));
  const manifest = await checkHttp(`${normalizeBase(smokeBase)}/manifest.json`);
  checks.push({
    ...manifest,
    name: 'PWA manifest',
    passed: manifest.passed && manifest.body.includes('"name"') && manifest.body.includes('/icon.svg'),
    detail: `${manifest.detail}; hasIcon=${manifest.body.includes('/icon.svg')}`,
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
