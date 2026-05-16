const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const basePath = '/Gigtos';
const buildDir = path.resolve(__dirname, '..', 'build');

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

const server = http.createServer((req, res) => {
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

server.listen(port, '127.0.0.1', () => {
  console.log(`Static smoke server listening on http://127.0.0.1:${port}${basePath}`);
});
