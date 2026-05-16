const http = require('http');
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.join(appRoot, 'build');
const port = Number(process.env.PORT || 4174);
const origin = `http://127.0.0.1:${port}`;
const basePath = '/Gigtos';

const routes = [
  '/',
  '/auth',
  '/services',
  '/jobs',
  '/service',
  '/my-bookings',
  '/profile',
  '/worker/dashboard',
  '/worker/open-work',
  '/worker/future-work',
  '/worker/profile',
  '/worker/support',
  '/worker/map',
  '/worker/history',
  '/operator',
  '/admin/bookings',
  '/admin/super',
];

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeFilePath(requestPath) {
  const relativePath = requestPath.startsWith(basePath)
    ? requestPath.slice(basePath.length)
    : requestPath;
  const cleanPath = decodeURIComponent(relativePath.split('?')[0] || '/');
  const candidate = path.resolve(buildDir, cleanPath.replace(/^\/+/, ''));
  return candidate.startsWith(buildDir) ? candidate : null;
}

function createServer() {
  return http.createServer((req, res) => {
    if (!fs.existsSync(buildDir)) {
      send(res, 500, 'Build folder missing. Run npm run build first.', {
        'content-type': 'text/plain; charset=utf-8',
      });
      return;
    }

    let filePath = safeFilePath(req.url || '/');
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(buildDir, 'index.html');
    }

    const ext = path.extname(filePath);
    send(res, 200, fs.readFileSync(filePath), {
      'content-type': contentTypes[ext] || 'application/octet-stream',
    });
  });
}

async function get(url) {
  const response = await fetch(url);
  const body = await response.text();
  return {
    url,
    status: response.status,
    contentType: response.headers.get('content-type') || '',
    body,
  };
}

function extractAssetPaths(html) {
  const matches = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)];
  return matches.map((match) => match[1]);
}

async function run() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  try {
    const checks = [];
    for (const route of routes) {
      const url = `${origin}${basePath}${route === '/' ? '' : route}`;
      const result = await get(url);
      const passed =
        result.status === 200 &&
        result.contentType.includes('text/html') &&
        result.body.includes('<div id="root">');
      checks.push({
        name: `Route ${basePath}${route}`,
        passed,
        detail: `${result.status} ${result.contentType}`,
      });
    }

    const home = await get(`${origin}${basePath}`);
    const assets = extractAssetPaths(home.body);
    for (const assetPath of assets) {
      const assetUrl = assetPath.startsWith('http') ? assetPath : `${origin}${assetPath}`;
      const result = await get(assetUrl);
      checks.push({
        name: `Asset ${assetPath}`,
        passed: result.status === 200,
        detail: `${result.status} ${result.contentType}`,
      });
    }

    const passed = checks.every((check) => check.passed);
    for (const check of checks) {
      console.log(`${check.passed ? 'PASS' : 'FAIL'} ${check.name} - ${check.detail}`);
    }
    process.exitCode = passed ? 0 : 1;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
