const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('@playwright/test');

const appRoot = path.resolve(__dirname, '..');
const buildRoot = path.join(appRoot, 'build');
const resultsDir = path.join(appRoot, 'test-results', 'heart-monitor');
const configuredTarget = process.env.GIGTOS_SMOKE_URL || process.env.REACT_APP_PUBLIC_URL || '';
const basePath = '/Gigtos';
const routes = ['/', '/auth', '/service', '/privacy', '/worker/dashboard', '/admin/super'];

function normalizeBase(url) {
  return url.replace(/\/$/, '');
}

function resolveConfiguredBase(rawTarget) {
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
  if (!fs.existsSync(path.join(buildRoot, 'index.html'))) {
    throw new Error('Build output missing. Run npm run build:prod before browser Heart Monitor.');
  }

  const server = http.createServer((req, res) => {
    const rawPathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const pathname = rawPathname.startsWith(basePath) ? rawPathname.slice(basePath.length) || '/' : rawPathname;
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const requestedPath = path.resolve(buildRoot, `.${safePath}`);
    const insideBuild = requestedPath.startsWith(buildRoot);
    const filePath = insideBuild && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
      ? requestedPath
      : path.join(buildRoot, 'index.html');

    res.writeHead(200, { 'content-type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}${basePath}` });
    });
  });
}

function screenshotName(route) {
  const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-');
  return path.join(resultsDir, `${slug}.png`);
}

async function checkRoute(page, baseUrl, route) {
  const url = routeUrl(baseUrl, route);
  const pageErrors = [];
  const consoleErrors = [];
  const httpWarnings = [];

  const onPageError = (error) => pageErrors.push(error.message);
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon|Failed to load resource/i.test(text)) return;
    consoleErrors.push(text);
  };
  const onResponse = (response) => {
    const responseUrl = response.url();
    if (response.status() < 400) return;
    if (/sentry\.io|firebaseappcheck|razorpay|recaptcha/i.test(responseUrl)) {
      httpWarnings.push(`${response.status()} ${responseUrl}`.slice(0, 220));
    }
  };

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('response', onResponse);

  const startedAt = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return root && root.children.length > 0 && document.body.innerText.trim().length > 20;
  }, { timeout: 10000 }).catch(() => null);

  const health = await page.evaluate(() => {
    const root = document.querySelector('#root');
    const bodyText = document.body?.innerText || '';
    const buttons = document.querySelectorAll('button, a, input, select, textarea').length;
    return {
      hasRoot: Boolean(root),
      rootChildren: root?.children?.length || 0,
      textLength: bodyText.trim().length,
      buttons,
      title: document.title || '',
    };
  });

  await page.screenshot({ path: screenshotName(route), fullPage: true });
  page.off('pageerror', onPageError);
  page.off('console', onConsole);
  page.off('response', onResponse);

  const fatalConsole = consoleErrors.filter((text) => (
    /Minified React error|ReferenceError|TypeError|SyntaxError|Uncaught/i.test(text)
  ));
  const passed = health.hasRoot
    && health.rootChildren > 0
    && health.textLength > 20
    && pageErrors.length === 0
    && fatalConsole.length === 0;

  return {
    route,
    url,
    passed,
    durationMs: Date.now() - startedAt,
    health,
    pageErrors,
    consoleErrors,
    httpWarnings,
    fatalConsole,
  };
}

async function run() {
  fs.mkdirSync(resultsDir, { recursive: true });
  const local = configuredTarget ? null : await serveBuild();
  const baseUrl = configuredTarget
    ? resolveConfiguredBase(configuredTarget)
    : local.baseUrl;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const checks = [];

  try {
    for (const route of routes) {
      checks.push(await checkRoute(page, baseUrl, route));
    }
  } finally {
    await browser.close();
    if (local) {
      await new Promise((resolve) => local.server.close(resolve));
    }
  }

  const report = [
    '# Playwright Heart Monitor',
    '',
    `- Time: ${new Date().toISOString()}`,
    `- Target: ${baseUrl}`,
    `- Status: ${checks.every((check) => check.passed) ? 'PASS' : 'FAIL'}`,
    '',
    ...checks.flatMap((check) => [
      `## ${check.passed ? 'PASS' : 'FAIL'} ${check.route}`,
      '',
      `- URL: ${check.url}`,
      `- Duration: ${check.durationMs} ms`,
      `- Root children: ${check.health.rootChildren}`,
      `- Text length: ${check.health.textLength}`,
      `- Controls/links: ${check.health.buttons}`,
      `- Page errors: ${check.pageErrors.length}`,
      `- Console errors captured: ${check.consoleErrors.length}`,
      `- Monitoring/third-party HTTP warnings: ${check.httpWarnings.length}`,
      ...(check.httpWarnings.length ? check.httpWarnings.slice(0, 5).map(item => `  - ${item}`) : []),
      '',
    ]),
  ].join('\n');

  fs.writeFileSync(path.join(resultsDir, 'latest.md'), report);

  for (const check of checks) {
    const detail = `rootChildren=${check.health.rootChildren}; text=${check.health.textLength}; pageErrors=${check.pageErrors.length}; fatalConsole=${check.fatalConsole.length}; monitorWarnings=${check.httpWarnings.length}; ${check.durationMs}ms`;
    console.log(`${check.passed ? 'PASS' : 'FAIL'} Browser ${check.route} - ${detail}`);
    if (!check.passed) {
      for (const error of [...check.pageErrors, ...check.fatalConsole].slice(0, 5)) {
        console.log(`  ${error}`);
      }
    }
  }

  process.exit(checks.every((check) => check.passed) ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
