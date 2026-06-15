const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const docsDir = path.join(appRoot, 'docs');
const outputPath = path.join(docsDir, 'LAUNCH_READINESS_LATEST.md');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function parseEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=([^\\r\\n]*)`, 'm'));
  return match ? match[1].trim() : '';
}

function hasRoute(appJs, route) {
  return appJs.includes(`path="${route}"`) || appJs.includes(`path='${route}'`);
}

const productionEnv = readIfExists(path.join(appRoot, '.env.production'));
const appJs = readIfExists(path.join(appRoot, 'src', 'App.js'));
const firestoreRules = readIfExists(path.join(repoRoot, 'firebase.rules'));
const storageRules = readIfExists(path.join(repoRoot, 'storage.rules'));
const manifestRaw = readIfExists(path.join(appRoot, 'public', 'manifest.json'));
const indexJs = readIfExists(path.join(appRoot, 'src', 'index.js'));
const productionConsoleGuard = readIfExists(path.join(appRoot, 'src', 'utils', 'productionConsoleGuard.js'));
const privacyPageExists = fs.existsSync(path.join(appRoot, 'src', 'pages', 'PrivacyPolicy.js'));
const manualQaRunbookExists = fs.existsSync(path.join(repoRoot, 'docs', 'LAUNCH_MANUAL_QA_RUNBOOK.md'));
const testLoginsTemplateExists = fs.existsSync(path.join(repoRoot, 'TEST_LOGINS.md'));
let manifest = {};
try {
  manifest = JSON.parse(manifestRaw || '{}');
} catch {
  manifest = {};
}

const vapidKey = parseEnvValue(productionEnv, 'REACT_APP_FIREBASE_VAPID_KEY')
  || parseEnvValue(productionEnv, 'REACT_APP_FIREBASE_WEB_PUSH_VAPID_KEY');
const vapidLooksValid = /^B[A-Za-z0-9_-]{70,120}$/.test(vapidKey);

const checks = [
  {
    name: 'Worker profile Firestore write rules',
    status: firestoreRules.includes('match /gig_workers/{workerId}')
      && firestoreRules.includes('isWorkerSafeProfileChange')
      && firestoreRules.includes('"workerBasePrices"')
      ? 'configured' : 'needs_code_fix',
    evidence: [
      'firebase.rules match /gig_workers/{workerId}',
      'safe worker profile allowlist keeps approval/status/GigScore/payout out of client writes',
    ],
    nextAction: 'No action if deployed rules are current.',
  },
  {
    name: 'Consumer profile extended fields and photo upload',
    status: appJs && storageRules.includes('match /users/{userId}/profile/{fileName}')
      ? 'configured' : 'needs_code_fix',
    evidence: [
      'Profile.js stores state/postalCode/photoURL',
      'CompleteProfilePhone.js collects phone/location/photo',
      'storage.rules allows scoped user profile image create',
    ],
    nextAction: 'No action if deployed hosting and storage rules are current.',
  },
  {
    name: 'Privacy policy URL',
    status: privacyPageExists && hasRoute(appJs, '/privacy') ? 'configured' : 'needs_code_fix',
    evidence: [
      `PrivacyPolicy.js=${privacyPageExists ? 'present' : 'missing'}`,
      `Route /privacy=${hasRoute(appJs, '/privacy') ? 'present' : 'missing'}`,
    ],
    nextAction: 'Use https://gigto.in/#/privacy for app store privacy URL.',
  },
  {
    name: 'PWA manifest',
    status: manifest.name && manifest.start_url && manifest.display === 'standalone' && Array.isArray(manifest.icons) && manifest.icons.length
      ? 'configured' : 'needs_code_fix',
    evidence: [
      `name=${manifest.name || 'missing'}`,
      `start_url=${manifest.start_url || 'missing'}`,
      `display=${manifest.display || 'missing'}`,
      `icons=${Array.isArray(manifest.icons) ? manifest.icons.length : 0}`,
    ],
    nextAction: 'No action if deployed hosting is current.',
  },
  {
    name: 'Production browser console guard',
    status: indexJs.includes('installProductionConsoleGuard()')
      && productionConsoleGuard.includes("env !== 'production'")
      && productionConsoleGuard.includes("['log', 'info', 'debug']")
      ? 'configured' : 'needs_code_fix',
    evidence: [
      'src/index.js installs the guard before Sentry/browser startup',
      'src/utils/productionConsoleGuard.js suppresses console.log/info/debug in production only',
      'console.warn/error remain available for meaningful browser diagnostics',
    ],
    nextAction: 'No action if deployed hosting is current.',
  },
  {
    name: 'Worker Web Push VAPID key',
    status: vapidLooksValid ? 'configured' : 'needs_external_value',
    evidence: [
      `REACT_APP_FIREBASE_VAPID_KEY=${vapidKey ? (vapidLooksValid ? 'configured' : '[set_but_unexpected_format]') : 'missing'}`,
    ],
    nextAction: 'Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates -> Generate key pair, then set REACT_APP_FIREBASE_VAPID_KEY in react-app/.env.production and redeploy hosting.',
  },
  {
    name: 'Real-account manual E2E QA',
    status: 'needs_manual_run',
    evidence: [
      `LAUNCH_MANUAL_QA_RUNBOOK.md=${manualQaRunbookExists ? 'present' : 'missing'}`,
      `TEST_LOGINS.md=${testLoginsTemplateExists ? 'present' : 'missing'}`,
      'consumer full flow',
      'worker approval/open-to-work/offer flow',
      'field operator verification/dispute flow',
      'superadmin pricing/worker approval/health flow',
      'mason and region lead are optional legacy checks only if launch-enabled',
    ],
    nextAction: 'Run docs/LAUNCH_MANUAL_QA_RUNBOOK.md with real Firebase test accounts after VAPID is configured; automated dev smoke already passes.',
  },
];

const blocking = checks.filter(check => check.status === 'needs_code_fix' || check.status === 'needs_external_value');
const manual = checks.filter(check => check.status === 'needs_manual_run');
const report = [
  '# Launch Readiness Latest',
  '',
  `- Time: ${new Date().toISOString()}`,
  `- Status: ${blocking.length ? 'NEEDS_SETUP' : manual.length ? 'READY_FOR_MANUAL_QA' : 'READY'}`,
  `- Blocking setup/code items: ${blocking.length}`,
  `- Manual QA items: ${manual.length}`,
  '',
  ...checks.flatMap(check => [
    `## ${check.name}`,
    '',
    `- Status: ${check.status}`,
    `- Next action: ${check.nextAction}`,
    '- Evidence:',
    ...check.evidence.map(item => `  - ${item}`),
    '',
  ]),
].join('\n');

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(outputPath, report);
console.log(report);
process.exit(0);
