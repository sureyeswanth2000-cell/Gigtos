const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const docsDir = path.join(appRoot, 'docs');
const heartReportPath = path.join(appRoot, 'test-results', 'heart-monitor', 'latest.md');
const outputPath = path.join(docsDir, 'AI_OPS_EXTERNAL_SETUP_LATEST.md');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function parseEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=([^\\r\\n]*)`, 'm'));
  return match ? match[1].trim() : '';
}

function mask(value) {
  if (!value) return '';
  if (value.length <= 16) return '[set]';
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

const reactProductionEnv = readIfExists(path.join(appRoot, '.env.production'));
const functionsEnv = readIfExists(path.join(repoRoot, 'functions', '.env'));
const heartReport = readIfExists(heartReportPath);

const sentryWarnings = (heartReport.match(/403 https:\/\/[^ \n]*sentry\.io[^\n]*/gi) || []);
const appCheckWarnings = (heartReport.match(/403 https:\/\/content-firebaseappcheck\.googleapis\.com[^\n]*/gi) || []);
const recaptchaWarnings = (heartReport.match(/recaptcha[^\n]*(?:403|ERR_ABORTED|blocked)/gi) || []);

const frontendSentryDsn = parseEnvValue(reactProductionEnv, 'REACT_APP_SENTRY_DSN');
const frontendAppCheckEnterpriseKey = parseEnvValue(reactProductionEnv, 'REACT_APP_APPCHECK_RECAPTCHA_ENTERPRISE_SITE_KEY');
const frontendAppCheckClassicKey = parseEnvValue(reactProductionEnv, 'REACT_APP_APPCHECK_RECAPTCHA_SITE_KEY');
const appCheckDomainVerified = parseEnvValue(reactProductionEnv, 'APPCHECK_DOMAIN_VERIFIED') === 'true';
const backendSentryDsn = parseEnvValue(functionsEnv, 'SENTRY_DSN') || parseEnvValue(functionsEnv, 'FUNCTIONS_SENTRY_DSN');
const sentryAuthToken = parseEnvValue(functionsEnv, 'SENTRY_AUTH_TOKEN');
const sentryOrg = parseEnvValue(functionsEnv, 'SENTRY_ORG');
const sentryProjects = parseEnvValue(functionsEnv, 'SENTRY_PROJECTS');
const jiraBaseUrl = parseEnvValue(functionsEnv, 'JIRA_BASE_URL');
const jiraEmail = parseEnvValue(functionsEnv, 'JIRA_EMAIL');
const jiraToken = parseEnvValue(functionsEnv, 'JIRA_API_TOKEN');
const jiraHandoffMode = (parseEnvValue(functionsEnv, 'JIRA_HANDOFF_MODE') || 'firebase').toLowerCase();
const jiraExternalConfigured = Boolean(jiraBaseUrl && jiraEmail && jiraToken);
const jiraFirebaseHandoffMode = ['firebase', 'firestore', 'internal'].includes(jiraHandoffMode);
const vectorIndexId = parseEnvValue(functionsEnv, 'VERTEX_VECTOR_SEARCH_INDEX_ID');
const vectorEndpoint = parseEnvValue(functionsEnv, 'VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT');
const vectorDeployedIndex = parseEnvValue(functionsEnv, 'VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID');
const agentRuntimeMode = parseEnvValue(functionsEnv, 'AI_AGENT_RUNTIME_MODE') || 'dry_run';
const agentRuntimeUrl = parseEnvValue(functionsEnv, 'AI_AGENT_RUNTIME_URL');
const agentRuntimeServiceAccount = parseEnvValue(functionsEnv, 'AI_AGENT_RUNTIME_SERVICE_ACCOUNT');

const checks = [
  {
    name: 'Frontend Sentry DSN accepts browser events',
    status: sentryWarnings.length ? 'needs_external_fix' : (frontendSentryDsn ? 'configured_no_403_seen' : 'not_configured'),
    evidence: sentryWarnings.slice(0, 3),
    nextAction: sentryWarnings.length
      ? 'In Sentry, verify the frontend project Client Key/DSN is enabled and allowed for gigto.in, then update react-app/.env.production.'
      : 'No Sentry ingest 403 was seen in the latest browser monitor.',
  },
  {
    name: 'Firebase App Check accepts gigto.in domain',
    status: appCheckWarnings.length || recaptchaWarnings.length
      ? (appCheckDomainVerified ? 'configured_domain_verified_headless_warning' : 'needs_external_fix')
      : (frontendAppCheckEnterpriseKey || frontendAppCheckClassicKey || appCheckDomainVerified ? 'configured_no_403_seen' : 'not_configured'),
    evidence: [...appCheckWarnings, ...recaptchaWarnings].slice(0, 3),
    nextAction: appCheckWarnings.length || recaptchaWarnings.length
      ? (appCheckDomainVerified
        ? 'gigto.in is verified in reCAPTCHA Enterprise allowed domains; Playwright/headless may still show App Check 403. Confirm with a real logged-in browser before treating this as user-impacting.'
        : 'In Firebase App Check / reCAPTCHA Enterprise, allow gigto.in and confirm the site key belongs to app 1:190454381677:web:458b1638c984ababcdd364.')
      : 'No App Check 403 was seen in the latest browser monitor.',
  },
  {
    name: 'Backend Sentry issue ingest',
    status: backendSentryDsn && sentryAuthToken && sentryOrg && sentryProjects ? 'configured' : 'needs_external_values',
    evidence: [
      `SENTRY_DSN=${backendSentryDsn ? mask(backendSentryDsn) : 'missing'}`,
      `SENTRY_AUTH_TOKEN=${sentryAuthToken ? '[set]' : 'missing'}`,
      `SENTRY_ORG=${sentryOrg || 'missing'}`,
      `SENTRY_PROJECTS=${sentryProjects || 'missing'}`,
    ],
    nextAction: 'Provide backend Sentry DSN plus issue-read token/org/project slugs if production issue ingest should create Jira/RAG handoffs.',
  },
  {
    name: 'Jira handoff creation',
    status: jiraExternalConfigured
      ? 'configured_external_jira'
      : (jiraFirebaseHandoffMode ? 'configured_firebase_handoff' : 'needs_external_values'),
    evidence: [
      `JIRA_HANDOFF_MODE=${jiraHandoffMode}`,
      `JIRA_BASE_URL=${jiraBaseUrl || 'missing'}`,
      `JIRA_EMAIL=${jiraEmail || 'missing'}`,
      `JIRA_API_TOKEN=${jiraToken ? '[set]' : 'missing'}`,
    ],
    nextAction: jiraExternalConfigured
      ? 'External Atlassian Jira issue creation is configured.'
      : (jiraFirebaseHandoffMode
        ? 'Using Firestore jira_issue_handoffs as MVP issue tracking. Atlassian Jira can be connected later if needed.'
        : 'Provide Jira base URL, email, API token, project key, and issue type for automatic ticket creation.'),
  },
  {
    name: 'Vertex Vector Search',
    status: vectorIndexId && vectorEndpoint && vectorDeployedIndex ? 'configured' : 'optional_not_configured',
    evidence: [
      `VERTEX_VECTOR_SEARCH_INDEX_ID=${vectorIndexId || 'missing'}`,
      `VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT=${vectorEndpoint || 'missing'}`,
      `VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID=${vectorDeployedIndex || 'missing'}`,
    ],
    nextAction: 'Optional for MVP. Firestore RAG stays active until these Vertex Vector Search values are provided.',
  },
  {
    name: 'Full AI agent runtime',
    status: agentRuntimeMode !== 'dry_run' && agentRuntimeUrl && agentRuntimeServiceAccount ? 'configured_requires_human_approval' : 'safe_dry_run',
    evidence: [
      `AI_AGENT_RUNTIME_MODE=${agentRuntimeMode}`,
      `AI_AGENT_RUNTIME_URL=${agentRuntimeUrl || 'missing'}`,
      `AI_AGENT_RUNTIME_SERVICE_ACCOUNT=${agentRuntimeServiceAccount || 'missing'}`,
    ],
    nextAction: 'Keep dry_run for MVP. Enable Cloud Run/LangGraph only after separate service accounts and human approval are ready.',
  },
];

const blocking = checks.filter(check => check.status === 'needs_external_fix' || check.status === 'needs_external_values');
const report = [
  '# AI/Ops External Setup Latest',
  '',
  `- Time: ${new Date().toISOString()}`,
  `- Status: ${blocking.length ? 'NEEDS_EXTERNAL_SETUP' : 'OK_OR_OPTIONAL_ONLY'}`,
  `- Blocking external items: ${blocking.length}`,
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
