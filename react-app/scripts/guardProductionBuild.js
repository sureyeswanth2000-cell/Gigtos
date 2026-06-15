const bypassEnabled = process.env.REACT_APP_ENABLE_DEV_BYPASS === 'true';
const defaultAppCheckEnterpriseSiteKey = '6LfJzvQsAAAAAO7eO16Wm4hWii7iIIOML_Q-Lnom';
const appCheckEnterpriseSiteKey =
  process.env.REACT_APP_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY ||
  defaultAppCheckEnterpriseSiteKey;
const appCheckSiteKey = process.env.REACT_APP_APPCHECK_RECAPTCHA_SITE_KEY;
const appCheckDebugToken = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
const hasAppCheckSiteKey = Boolean(appCheckEnterpriseSiteKey || appCheckSiteKey);
const appCheckRequired =
  process.env.GIGTOS_REQUIRE_APPCHECK === 'true' ||
  process.env.REACT_APP_REQUIRE_APPCHECK === 'true';
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

if (appCheckDebugToken && productionGuardRequested) {
  console.error(
    'Production deploy build blocked: REACT_APP_APPCHECK_DEBUG_TOKEN is set. App Check debug tokens are for local/dev only.'
  );
  process.exit(1);
}

if (appCheckRequired && productionGuardRequested && !hasAppCheckSiteKey) {
  console.error(
    'Production deploy build blocked: App Check is required but no App Check site key env var is set.'
  );
  process.exit(1);
}

if (productionGuardRequested && !hasAppCheckSiteKey) {
  console.warn(
    'Warning: App Check site key is missing. App Check will not attach tokens until a site key env var is configured.'
  );
}

if (bypassEnabled) {
  console.warn(
    'Warning: REACT_APP_ENABLE_DEV_BYPASS=true. This is allowed for local build only; production deploy uses build:prod.'
  );
}
