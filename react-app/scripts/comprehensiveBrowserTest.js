const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROUTES = [
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
  '/admin/super'
];

const BASE_URL = 'http://127.0.0.1:4173/Gigtos';
const REPORT_PATH = path.join(__dirname, '..', '..', 'docs', 'BROWSER_TEST_ERRORS.md');

function shouldIgnoreConsoleError(text) {
  return (
    text.includes('favicon.ico') ||
    text.includes('ERR_CONNECTION_REFUSED') ||
    text.includes('ERR_QUIC_PROTOCOL_ERROR') ||
    text.includes('the server responded with a status of 401') ||
    text.includes('Could not reach Cloud Firestore backend') ||
    text.includes('report-only Content Security Policy directive: "frame-ancestors')
  );
}

async function run() {
  console.log('Starting comprehensive browser UI test crawler...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    // Simulate mobile as well? For now, desktop is fine.
  });

  const page = await context.newPage();
  const errors = [];

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (shouldIgnoreConsoleError(text)) return;
      errors.push({ type: 'CONSOLE_ERROR', url: page.url(), message: text });
      console.log(`[CONSOLE ERROR] on ${page.url()}: ${text}`);
    }
  });

  // Listen for uncaught exceptions / React crashes
  page.on('pageerror', error => {
    errors.push({ type: 'PAGE_ERROR', url: page.url(), message: error.message, stack: error.stack });
    console.log(`[PAGE ERROR] on ${page.url()}: ${error.message}`);
  });

  // Intercept requests to simulate null data in certain Firebase calls if needed.
  // We can just rely on the existing empty states for now.
  await page.route('**/*', (route) => {
    route.continue();
  });

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route}`;
    console.log(`Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Try to click some primary buttons to trigger interactions
      const buttons = await page.$$('button');
      if (buttons.length > 0) {
        // Just click the first visible button if it's not disabled
        try {
          // Avoid clicking destructive things, just hover or click safe things.
          // For safety in this test, we just wait for render.
          await page.waitForTimeout(1500);
        } catch (e) { }
      } else {
        await page.waitForTimeout(1500);
      }

    } catch (e) {
      errors.push({ type: 'NAVIGATION_ERROR', url, message: e.message });
      console.log(`[NAVIGATION ERROR] failed to load ${url}: ${e.message}`);
    }
  }

  await browser.close();

  // Generate Report
  const now = new Date().toISOString();
  let report = `# Browser Test Errors Report\n\n- **Run Time:** ${now}\n- **Total Errors Found:** ${errors.length}\n\n`;

  if (errors.length === 0) {
    report += `✅ All tested routes rendered without throwing uncaught page errors or React console errors.\n`;
  } else {
    report += `## Detailed Errors\n\n`;
    errors.forEach((e, idx) => {
      report += `### ${idx + 1}. [${e.type}] on \`${e.url}\`\n`;
      report += `\`\`\`text\n${e.message}\n\`\`\`\n`;
      if (e.stack) {
        report += `**Stack Trace:**\n\`\`\`text\n${e.stack}\n\`\`\`\n`;
      }
      report += `\n---\n`;
    });
  }

  fs.writeFileSync(REPORT_PATH, report);
  console.log(`\nTest complete. Wrote results to ${REPORT_PATH}`);
}

run().catch(console.error);
