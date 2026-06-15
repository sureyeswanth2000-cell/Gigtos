const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'node_modules', 'react-scripts', 'config', 'webpackDevServer.config.js');

if (!fs.existsSync(target)) {
  console.warn('[patchReactScriptsDevServer] react-scripts dev server config not found; skipping.');
  process.exit(0);
}

let source = fs.readFileSync(target, 'utf8');
let changed = false;

if (source.includes('    https: getHttpsConfig(),')) {
  source = source.replace(
    '    https: getHttpsConfig(),',
    "    server: getHttpsConfig() ? { type: 'https', options: getHttpsConfig() } : 'http',"
  );
  changed = true;
}

const before = `    // \`proxy\` is run between \`before\` and \`after\` \`webpack-dev-server\` hooks
    proxy,
    onBeforeSetupMiddleware(devServer) {
      // Keep \`evalSourceMapMiddleware\`
      // middlewares before \`redirectServedPath\` otherwise will not have any effect
      // This lets us fetch source contents from webpack for the error overlay
      devServer.app.use(evalSourceMapMiddleware(devServer));

      if (fs.existsSync(paths.proxySetup)) {
        // This registers user provided middleware for proxy reasons
        require(paths.proxySetup)(devServer.app);
      }
    },
    onAfterSetupMiddleware(devServer) {
      // Redirect to \`PUBLIC_URL\` or \`homepage\` from \`package.json\` if url not match
      devServer.app.use(redirectServedPath(paths.publicUrlOrPath));

      // This service worker file is effectively a 'no-op' that will reset any
      // previous service worker registered for the same host:port combination.
      // We do this in development to avoid hitting the production cache if
      // it used the same host and port.
      // https://github.com/facebook/create-react-app/issues/2272#issuecomment-302832432
      devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));
    },`;

const after = `    // \`proxy\` is run between \`before\` and \`after\` \`webpack-dev-server\` hooks
    proxy,
    setupMiddlewares: (middlewares, devServer) => {
      if (!devServer) {
        throw new Error('webpack-dev-server is not defined');
      }

      // Keep \`evalSourceMapMiddleware\`
      // middlewares before \`redirectServedPath\` otherwise will not have any effect
      // This lets us fetch source contents from webpack for the error overlay
      devServer.app.use(evalSourceMapMiddleware(devServer));

      if (fs.existsSync(paths.proxySetup)) {
        // This registers user provided middleware for proxy reasons
        require(paths.proxySetup)(devServer.app);
      }

      // Redirect to \`PUBLIC_URL\` or \`homepage\` from \`package.json\` if url not match
      devServer.app.use(redirectServedPath(paths.publicUrlOrPath));

      // This service worker file is effectively a 'no-op' that will reset any
      // previous service worker registered for the same host:port combination.
      // We do this in development to avoid hitting the production cache if
      // it used the same host and port.
      // https://github.com/facebook/create-react-app/issues/2272#issuecomment-302832432
      devServer.app.use(noopServiceWorkerMiddleware(paths.publicUrlOrPath));

      return middlewares;
    },`;

if (source.includes(before)) {
  source = source.replace(before, after);
  changed = true;
} else if (!source.includes('setupMiddlewares: (middlewares, devServer) => {')) {
  console.warn('[patchReactScriptsDevServer] expected middleware hooks not found; leaving config unchanged.');
  process.exit(0);
}

if (changed) {
  fs.writeFileSync(target, source);
  console.log('[patchReactScriptsDevServer] patched react-scripts for webpack-dev-server v5.');
} else {
  console.log('[patchReactScriptsDevServer] webpack dev server config already patched.');
}
