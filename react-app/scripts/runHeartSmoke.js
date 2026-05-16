const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const docsDir = path.join(appRoot, 'docs');
const reportPath = path.join(docsDir, 'HEART_MONITOR_LATEST.md');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const nodeBin = process.execPath;
const npmExecPath = process.env.npm_execpath;

function npmArgs(...args) {
  return npmExecPath ? [npmExecPath, ...args] : args;
}

function npmCommand() {
  return npmExecPath ? nodeBin : process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function runStep({ name, command, args, env = {}, expectFailure = false }) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: appRoot,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    shell: false,
  });
  const durationMs = Date.now() - startedAt;
  const passed = expectFailure ? result.status !== 0 : result.status === 0;
  return {
    name,
    passed,
    expected: expectFailure ? 'failure' : 'success',
    exitCode: result.status,
    durationMs,
    output: `${result.error ? result.error.message : ''}\n${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

function tail(value = '', maxLines = 18) {
  const lines = value.split(/\r?\n/).filter(Boolean);
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
}

const steps = [
  runStep({
    name: 'Booking smoke: consumer -> worker -> completion photo -> rating -> SocioScore event',
    command: npmCommand(),
    args: npmArgs('run', 'smoke:booking'),
  }),
  runStep({
    name: 'Local dev bypass guard: bypass may run only outside production deploy',
    command: nodeBin,
    args: ['scripts/guardProductionBuild.js'],
    env: { REACT_APP_ENABLE_DEV_BYPASS: 'true' },
  }),
  runStep({
    name: 'Production deploy guard: bypass must block deploy build',
    command: nodeBin,
    args: ['scripts/guardProductionBuild.js', '--production'],
    env: { REACT_APP_ENABLE_DEV_BYPASS: 'true' },
    expectFailure: true,
  }),
  runStep({
    name: 'Production build without dev bypass',
    command: npmCommand(),
    args: npmArgs('run', 'build:prod'),
    env: { REACT_APP_ENABLE_DEV_BYPASS: '' },
  }),
  runStep({
    name: 'Built app route smoke: key URLs and static assets return OK',
    command: npmCommand(),
    args: npmArgs('run', 'smoke:routes'),
  }),
  runStep({
    name: 'Dev-auth UI smoke: consumer service page and worker dashboard interactions',
    command: npmCommand(),
    args: npmArgs('run', 'smoke:dev-ui'),
  }),
  runStep({
    name: 'Live/staging smoke scaffold: SSL, URL, route, and maps checks when GIGTOS_SMOKE_URL is set',
    command: npmCommand(),
    args: npmArgs('run', 'smoke:live'),
  }),
];

const passed = steps.every((step) => step.passed);
const now = new Date().toISOString();
const report = [
  '# Heart Monitor Latest',
  '',
  `- Run ID: ${runId}`,
  `- Time: ${now}`,
  `- Status: ${passed ? 'PASS' : 'FAIL'}`,
  `- Scope: local base smoke plus built route/asset checks, dev-auth UI interactions, and optional non-payment live/staging checks when GIGTOS_SMOKE_URL is set. Razorpay/payment checks and production cleanup are excluded.`,
  '',
  '## Steps',
  '',
  ...steps.flatMap((step, index) => [
    `### ${index + 1}. ${step.name}`,
    '',
    `- Result: ${step.passed ? 'PASS' : 'FAIL'}`,
    `- Expected: ${step.expected}`,
    `- Exit code: ${step.exitCode}`,
    `- Duration: ${step.durationMs} ms`,
    '',
    '```text',
    tail(step.output) || '(no output)',
    '```',
    '',
  ]),
  '## Next Action',
  '',
  passed
    ? '- Add real credentials for staging/live checks, then add Razorpay sandbox separately when payment work resumes.'
    : '- Fix the first failed step above before making product changes.',
  '',
].join('\n');

fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(reportPath, report);

console.log(report);
process.exit(passed ? 0 : 1);
