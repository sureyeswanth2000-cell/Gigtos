const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('@playwright/test');

const appRoot = path.resolve(__dirname, '..');
const repoDocsDir = path.resolve(appRoot, '..', 'docs');
const buildRoot = path.join(appRoot, 'build');
const reportPath = path.join(repoDocsDir, 'E2E_BOOKING_FLOW_RESULTS.md');
const basePath = '/Gigtos';
const configuredTarget = process.env.GIGTOS_SMOKE_URL || '';
const runDevAuthRoleFlows = process.env.GIGTOS_E2E_DEV_AUTH === 'true';

function normalizeBase(url) {
  return url.replace(/\/$/, '');
}

function resolveConfiguredBase(rawTarget) {
  const parsed = new URL(rawTarget);
  const normalized = normalizeBase(rawTarget);
  const pathPart = parsed.pathname.replace(/\/$/, '');
  if (pathPart) return normalized;
  if (parsed.hostname.endsWith('github.io')) return `${normalized}${basePath}`;
  return normalized;
}

function routeUrl(baseUrl, route, query = '') {
  const cleanRoute = route === '/' ? '/' : route.replace(/^#?\/?/, '/');
  return `${normalizeBase(baseUrl)}/${cleanRoute === '/' ? '' : `#${cleanRoute}${query}`}`;
}

function devAuthRouteUrl(baseUrl, role, route, hashQuery = '') {
  const cleanRoute = route === '/' ? '/' : route.replace(/^#?\/?/, '/');
  return `${normalizeBase(baseUrl)}/?devAuth=${encodeURIComponent(role)}#${cleanRoute}${hashQuery}`;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function serveBuild() {
  const indexPath = path.join(buildRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('Build output missing. Run npm run build:prod before smoke:e2e.');
  }

  const server = http.createServer((req, res) => {
    const rawPathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const pathname = rawPathname.startsWith(basePath) ? rawPathname.slice(basePath.length) || '/' : rawPathname;
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const requestedPath = path.resolve(buildRoot, `.${safePath}`);
    const insideBuild = requestedPath.startsWith(buildRoot);
    const filePath = insideBuild && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
      ? requestedPath
      : indexPath;

    res.writeHead(200, { 'content-type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}${basePath}` });
    });
  });
}

async function expectText(page, pattern, label) {
  const locator = page.getByText(pattern).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  return label;
}

async function expectHeading(page, pattern, label) {
  const locator = page.getByRole('heading', { name: pattern }).first();
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  return label;
}

async function runStep({ name, page, fn }) {
  const startedAt = Date.now();
  try {
    const detail = await fn(page);
    return { name, passed: true, durationMs: Date.now() - startedAt, detail: detail || 'ok' };
  } catch (error) {
    return { name, passed: false, durationMs: Date.now() - startedAt, detail: error.message || String(error) };
  }
}

async function run() {
  const local = configuredTarget ? null : await serveBuild();
  const baseUrl = configuredTarget ? resolveConfiguredBase(configuredTarget) : local.baseUrl;
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const warnings = [];
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });

  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon|Failed to load resource|firebaseappcheck|recaptcha|sentry/i.test(text)) {
      warnings.push(text.slice(0, 220));
      return;
    }
    errors.push(text);
  });

  const steps = [];
  try {
    steps.push(await runStep({
      name: 'Consumer service catalog renders launch services',
      page,
      fn: async () => {
        await page.goto(devAuthRouteUrl(baseUrl, 'consumer', '/services'), { waitUntil: 'domcontentloaded' });
        await expectHeading(page, /Services/i, 'services heading');
        await expectText(page, /Kitchen Help/i, 'Kitchen Help visible');
        await expectText(page, /Suggested fair range/i, 'pricing range visible');
      },
    }));

    if (runDevAuthRoleFlows) {
      steps.push(await runStep({
        name: 'Consumer can lock a service quote',
        page,
        fn: async () => {
          await page.goto(devAuthRouteUrl(baseUrl, 'consumer', '/service', '?type=Kitchen%20Help'), { waitUntil: 'domcontentloaded' });
          await expectHeading(page, /Book Kitchen Help|Book Home Helper/i, 'booking heading');
          const issueBox = page.getByPlaceholder(/Describe your issue/i).first();
          if (await issueBox.count()) {
            await issueBox.fill('Need urgent kitchen help for utensils and basic cleaning.');
          }
          await page.getByRole('button', { name: /Review and book/i }).first().click();
          await expectText(page, /Locked price:/i, 'locked quote');
          await expectText(page, /Worker receives full amount:/i, 'worker receivable copy');
        },
      }));

      steps.push(await runStep({
        name: 'Worker dashboard renders Smart Queue and start-work proof',
        page,
        fn: async () => {
          await page.goto(devAuthRouteUrl(baseUrl, 'worker', '/worker/dashboard'), { waitUntil: 'domcontentloaded' });
          await expectText(page, /Dev Worker/i, 'worker identity');
          await page.getByLabel(/Worker wallet/i).first().waitFor({ state: 'visible', timeout: 10000 });
          await expectText(page, /Smart Queue/i, 'smart queue');
          await page.getByRole('button', { name: /Check price rules/i }).first().waitFor({ state: 'visible', timeout: 10000 });
          await page.getByText(/Start Work/i).first().click();
          await expectText(page, /Start Work Proof/i, 'start work proof modal');
        },
      }));

      steps.push(await runStep({
        name: 'Worker profile renders language and payout controls',
        page,
        fn: async () => {
          await page.goto(devAuthRouteUrl(baseUrl, 'worker', '/worker/profile'), { waitUntil: 'domcontentloaded' });
          await expectHeading(page, /My Profile/i, 'worker profile heading');
          await expectText(page, /App Language/i, 'language selector');
          await expectText(page, /Payout Bank Account/i, 'payout bank account');
        },
      }));

      steps.push(await runStep({
        name: 'Field operator console renders verification and disputes',
        page,
        fn: async () => {
          await page.goto(devAuthRouteUrl(baseUrl, 'field_operator', '/operator'), { waitUntil: 'domcontentloaded' });
          await expectHeading(page, /Local trust control tower/i, 'field operator heading');
          await expectText(page, /Worker Verification Queue/i, 'verification queue');
          await page.getByRole('button', { name: /Disputes/i }).first().click();
          await expectText(page, /Dispute Queue/i, 'dispute queue');
        },
      }));

      steps.push(await runStep({
        name: 'SuperAdmin console renders protected control tower',
        page,
        fn: async () => {
          await page.goto(devAuthRouteUrl(baseUrl, 'superadmin', '/admin/super'), { waitUntil: 'domcontentloaded' });
          await expectText(page, /SuperAdmin|AI\/Ops Health|Worker Verify|Pricing/i, 'superadmin content');
        },
      }));
    } else {
      steps.push(await runStep({
        name: 'Protected booking route redirects to auth in production build',
        page,
        fn: async () => {
          await page.goto(routeUrl(baseUrl, '/service', '?type=Kitchen%20Help'), { waitUntil: 'domcontentloaded' });
          await expectText(page, /Sign In|Welcome Back|Login|Continue/i, 'auth redirect visible');
        },
      }));

      steps.push(await runStep({
        name: 'Protected worker dashboard redirects to auth in production build',
        page,
        fn: async () => {
          await page.goto(routeUrl(baseUrl, '/worker/dashboard'), { waitUntil: 'domcontentloaded' });
          await expectText(page, /Sign In|Welcome Back|Login|Continue/i, 'worker auth redirect visible');
        },
      }));
    }

    steps.push(await runStep({
      name: 'Privacy and PWA public launch surfaces render',
      page,
      fn: async () => {
        await page.goto(routeUrl(baseUrl, '/privacy'), { waitUntil: 'domcontentloaded' });
        await expectHeading(page, /Privacy Policy/i, 'privacy page');
        const manifestResponse = await page.request.get(`${normalizeBase(baseUrl)}/manifest.json`);
        if (!manifestResponse.ok()) throw new Error(`manifest returned ${manifestResponse.status()}`);
        const manifest = await manifestResponse.json();
        if (manifest.name !== 'Gigtos - Verified Home Services') {
          throw new Error(`unexpected manifest name: ${manifest.name}`);
        }
        return 'privacy + manifest ok';
      },
    }));
  } finally {
    await browser.close();
    if (local) {
      await new Promise(resolve => local.server.close(resolve));
    }
  }

  const passed = steps.every(step => step.passed) && errors.length === 0;
  const now = new Date().toISOString();
  const report = [
    '# E2E Booking Flow Execution Results',
    '',
    `- Time: ${now}`,
    `- Target: ${baseUrl}`,
    `- Status: ${passed ? 'PASS' : 'FAIL'}`,
    `- Dev-auth role flows: ${runDevAuthRoleFlows ? 'enabled' : 'disabled for production build'}`,
    `- Page/console errors: ${errors.length}`,
    `- Ignored monitoring warnings: ${warnings.length}`,
    '',
    '## Steps',
    '',
    ...steps.flatMap((step, index) => [
      `### ${index + 1}. ${step.passed ? 'PASS' : 'FAIL'} ${step.name}`,
      '',
      `- Duration: ${step.durationMs} ms`,
      `- Detail: ${step.detail}`,
      '',
    ]),
    ...(errors.length ? [
      '## Errors',
      '',
      ...errors.slice(0, 10).map(error => `- ${error}`),
      '',
    ] : []),
    ...(warnings.length ? [
      '## Monitoring Warnings',
      '',
      ...warnings.slice(0, 10).map(warning => `- ${warning}`),
      '',
    ] : []),
  ].join('\n');

  fs.mkdirSync(repoDocsDir, { recursive: true });
  fs.writeFileSync(reportPath, report);

  console.log(report);
  process.exit(passed ? 0 : 1);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
