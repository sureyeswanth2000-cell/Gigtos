const bypassEnabled = process.env.REACT_APP_ENABLE_DEV_BYPASS === 'true';
const productionGuardRequested =
  process.argv.includes('--production') ||
  process.env.GIGTOS_PRODUCTION_DEPLOY === 'true' ||
  process.env.REACT_APP_DEPLOY_ENV === 'production';

if (bypassEnabled && productionGuardRequested) {
  console.error(
    'Production deploy build blocked: REACT_APP_ENABLE_DEV_BYPASS=true. Disable dev bypass before production deploy.'
  );
  process.exit(1);
}

if (bypassEnabled) {
  console.warn(
    'Warning: REACT_APP_ENABLE_DEV_BYPASS=true. This is allowed for local build only; production deploy uses build:prod.'
  );
}
