const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const checks = [
  {
    file: 'firebase.rules',
    pattern: /allow\s+(read|write|create|update|delete|list|get|read,\s*write|create,\s*update)[^;]*:\s*if\s+true\s*;/g,
    message: 'Firestore rules must not allow unconditional public access.',
  },
  {
    file: 'storage.rules',
    pattern: /allow\s+(read|write|create|update|delete|list|get|read,\s*write|create,\s*update)[^;]*:\s*if\s+true\s*;/g,
    message: 'Storage rules must not allow unconditional public access.',
  },
  {
    file: 'functions/index.js',
    pattern: /exports\.\w+\s*=\s*functions\.https\.onCall\s*\(/g,
    message: 'Callable Functions must use appCheckOnCall so App Check stays enforced.',
  },
  {
    file: 'react-app/src',
    pattern: /REACT_APP_(GEMINI|RAZORPAY|TWILIO|GMAIL|SERVICE|PRIVATE|SECRET|PASSWORD|TOKEN)/g,
    message: 'Frontend environment variables must not expose private service secrets.',
  },
];

function listFiles(target) {
  const fullPath = path.join(root, target);
  if (!fs.existsSync(fullPath)) return [];
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) return [fullPath];
  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === 'build') return [];
    const nextTarget = path.join(target, entry.name);
    return listFiles(nextTarget);
  });
}

const failures = [];
for (const check of checks) {
  for (const filePath of listFiles(check.file)) {
    const relative = path.relative(root, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.matchAll(check.pattern);
    for (const match of matches) {
      const line = content.slice(0, match.index).split(/\r?\n/).length;
      failures.push(`${relative}:${line} ${check.message}`);
    }
  }
}

if (failures.length) {
  console.error('Security pattern scan failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Security pattern scan passed.');
