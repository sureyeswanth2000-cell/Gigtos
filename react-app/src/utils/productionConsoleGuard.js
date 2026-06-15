const SUPPRESSED_PRODUCTION_METHODS = ['log', 'info', 'debug'];
const GUARD_FLAG = '__GIGTOS_PRODUCTION_CONSOLE_GUARD__';

export function installProductionConsoleGuard({
  env = process.env.NODE_ENV,
  consoleRef = typeof console !== 'undefined' ? console : null,
  globalRef = typeof window !== 'undefined' ? window : globalThis,
} = {}) {
  if (env !== 'production' || !consoleRef) return false;
  if (globalRef?.[GUARD_FLAG]) return true;

  SUPPRESSED_PRODUCTION_METHODS.forEach((method) => {
    if (typeof consoleRef[method] === 'function') {
      // eslint-disable-next-line no-param-reassign
      consoleRef[method] = () => {};
    }
  });

  if (globalRef) {
    // eslint-disable-next-line no-param-reassign
    globalRef[GUARD_FLAG] = true;
  }
  return true;
}

export { SUPPRESSED_PRODUCTION_METHODS };
