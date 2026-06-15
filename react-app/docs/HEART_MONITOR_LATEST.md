# Heart Monitor Latest

- Run ID: 2026-06-15T10-37-09-411Z
- Time: 2026-06-15T10:37:54.499Z
- Status: PASS
- Scope: local base smoke plus built route/asset checks, dev-auth UI interactions, and optional non-payment live/staging checks when GIGTOS_SMOKE_URL is set. Razorpay/payment checks and production cleanup are excluded.

## Steps

### 1. Booking smoke: consumer -> worker -> completion photo -> rating -> GigScore event

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 1651 ms

```text
> gigto-react@0.1.0 smoke:booking
> react-scripts test src/__tests__/basicBookingSmoke.test.js --watchAll=false
PASS src/__tests__/basicBookingSmoke.test.js
  basic booking smoke loop
    √ runs consumer booking to worker completion photo to consumer rating and score event (6 ms)
    √ keeps dev bypass disabled unless explicitly enabled (18 ms)
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.788 s, estimated 1 s
Ran all test suites matching /src\\__tests__\\basicBookingSmoke.test.js/i.
```

### 2. Marketplace smoke: MVP pricing + Smart Queue seeded scenarios

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 1643 ms

```text
> gigto-react@0.1.0 smoke:marketplace
> react-scripts test src/__tests__/marketplacePricingSmartQueueSmoke.test.js --watchAll=false
PASS src/__tests__/marketplacePricingSmartQueueSmoke.test.js
  MVP marketplace seeded smoke: pricing + Smart Queue
    √ covers low, normal, high, peak, stale, below-min, above-cap, and manual override pricing (31 ms)
    √ ranks only safe, available, non-expired workers and gives favorite boost below safety rules (2 ms)
    √ uses no-worker recovery when no same-area or nearby worker is available (1 ms)
    √ sends repeated safe skips/no-response into pending review, never automatic penalty (1 ms)
    √ routes travel timeout/no-show evidence into human review instead of silent completion
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        0.821 s, estimated 1 s
Ran all test suites matching /src\\__tests__\\marketplacePricingSmartQueueSmoke.test.js/i.
```

### 3. Local dev bypass guard: bypass may run only outside production deploy

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 49 ms

```text
Warning: REACT_APP_ENABLE_DEV_BYPASS=true. This is allowed for local build only; production deploy uses build:prod.
```

### 4. Production deploy guard: bypass must block deploy build

- Result: PASS
- Expected: failure
- Exit code: 1
- Duration: 47 ms

```text
Production deploy build blocked: REACT_APP_ENABLE_DEV_BYPASS=true. Disable dev bypass before production deploy.
```

### 5. Production build without dev bypass

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 24778 ms

```text
File sizes after gzip:
  391.95 kB (+119 B)  build\static\js\main.e53b4086.js
  128.17 kB           build\static\js\389.65760ce4.chunk.js
  46.35 kB            build\static\js\239.c5533e99.chunk.js
  42.9 kB             build\static\js\455.10703399.chunk.js
  25.17 kB            build\static\css\main.921ff6e6.css
  9.63 kB             build\static\js\977.2a7ec8ae.chunk.js
  6.69 kB             build\static\js\508.f2613355.chunk.js
The project was built assuming it is hosted at /.
You can control this with the homepage field in your package.json.
The build folder is ready to be deployed.
You may serve it with a static server:
  npm install -g serve
  serve -s build
Find out more about deployment here:
  https://cra.link/deployment
(node:10516) [DEP0176] DeprecationWarning: fs.F_OK is deprecated, use fs.constants.F_OK instead
(Use `node --trace-deprecation ...` to show where the warning was created)
```

### 6. Playwright browser Heart Monitor: render key routes and capture screenshots

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 8902 ms

```text
> gigto-react@0.1.0 smoke:browser-heart
> node scripts/runPlaywrightHeartMonitor.js
PASS Browser / - rootChildren=5; text=6932; pageErrors=0; fatalConsole=0; monitorWarnings=0; 6419ms
PASS Browser /auth - rootChildren=2; text=590; pageErrors=0; fatalConsole=0; monitorWarnings=0; 181ms
PASS Browser /service - rootChildren=2; text=590; pageErrors=0; fatalConsole=0; monitorWarnings=0; 411ms
PASS Browser /privacy - rootChildren=5; text=2737; pageErrors=0; fatalConsole=0; monitorWarnings=0; 272ms
PASS Browser /worker/dashboard - rootChildren=2; text=590; pageErrors=0; fatalConsole=0; monitorWarnings=0; 329ms
PASS Browser /admin/super - rootChildren=2; text=590; pageErrors=0; fatalConsole=0; monitorWarnings=0; 335ms
```

### 7. AI/Ops external setup audit: Sentry, App Check, Jira, Vector Search, and runtime

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 350 ms

```text
  - JIRA_HANDOFF_MODE=firebase
  - JIRA_BASE_URL=missing
  - JIRA_EMAIL=missing
  - JIRA_API_TOKEN=missing
## Vertex Vector Search
- Status: optional_not_configured
- Next action: Optional for MVP. Firestore RAG stays active until these Vertex Vector Search values are provided.
- Evidence:
  - VERTEX_VECTOR_SEARCH_INDEX_ID=missing
  - VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT=missing
  - VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID=missing
## Full AI agent runtime
- Status: safe_dry_run
- Next action: Keep dry_run for MVP. Enable Cloud Run/LangGraph only after separate service accounts and human approval are ready.
- Evidence:
  - AI_AGENT_RUNTIME_MODE=dry_run
  - AI_AGENT_RUNTIME_URL=missing
  - AI_AGENT_RUNTIME_SERVICE_ACCOUNT=missing
```

### 8. Launch readiness audit: app blockers, VAPID, and manual QA

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 324 ms

```text
  - src/utils/productionConsoleGuard.js suppresses console.log/info/debug in production only
  - console.warn/error remain available for meaningful browser diagnostics
## Worker Web Push VAPID key
- Status: needs_external_value
- Next action: Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates -> Generate key pair, then set REACT_APP_FIREBASE_VAPID_KEY in react-app/.env.production and redeploy hosting.
- Evidence:
  - REACT_APP_FIREBASE_VAPID_KEY=missing
## Real-account manual E2E QA
- Status: needs_manual_run
- Next action: Run docs/LAUNCH_MANUAL_QA_RUNBOOK.md with real Firebase test accounts after VAPID is configured; automated dev smoke already passes.
- Evidence:
  - LAUNCH_MANUAL_QA_RUNBOOK.md=present
  - TEST_LOGINS.md=present
  - consumer full flow
  - worker approval/open-to-work/offer flow
  - field operator verification/dispute flow
  - superadmin pricing/worker approval/health flow
  - mason and region lead are optional legacy checks only if launch-enabled
```

### 9. Built app route smoke: key URLs and static assets return OK

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 445 ms

```text
PASS Route /Gigtos/profile - 200 text/html; charset=utf-8
PASS Route /Gigtos/privacy - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/dashboard - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/open-work - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/future-work - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/profile - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/support - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/map - 200 text/html; charset=utf-8
PASS Route /Gigtos/worker/history - 200 text/html; charset=utf-8
PASS Route /Gigtos/operator - 200 text/html; charset=utf-8
PASS Route /Gigtos/admin/bookings - 200 text/html; charset=utf-8
PASS Route /Gigtos/admin/super - 200 text/html; charset=utf-8
PASS CSP allows Sentry ingest - connect-src includes Sentry ingest hosts
PASS Asset https://checkout.razorpay.com/v1/checkout.js - 200 text/javascript
PASS Asset /static/js/main.e53b4086.js - 200 application/javascript; charset=utf-8
PASS Asset /static/css/main.921ff6e6.css - 200 text/css; charset=utf-8
PASS Static /manifest.json - 200 application/json; charset=utf-8
PASS Static /icon.svg - 200 image/svg+xml
```

### 10. Dev-auth UI smoke: consumer service page and worker dashboard interactions

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 3910 ms

```text
      at Object.<anonymous> (src/__tests__/devAuthUiSmoke.test.js:109:5)
      at TestScheduler.scheduleTests (node_modules/@jest/core/build/TestScheduler.js:333:13)
      at runJest (node_modules/@jest/core/build/runJest.js:404:19)
      at _run10000 (node_modules/@jest/core/build/cli/index.js:320:7)
      at runCLI (node_modules/@jest/core/build/cli/index.js:173:3)
PASS src/__tests__/devAuthUiSmoke.test.js
  dev-auth UI smoke
    √ opens the protected service booking screen as a dev consumer and updates smart match (544 ms)
    √ opens the public service catalog with launch and recruitable services (125 ms)
    √ opens the public worker landing page and routes to worker signup (119 ms)
    √ opens worker signup verification fields (159 ms)
    √ opens the protected worker dashboard as a dev worker and reaches start-work proof modal (225 ms)
    √ opens the protected field operator console as a dev field operator (94 ms)
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Snapshots:   0 total
Time:        2.965 s, estimated 4 s
Ran all test suites matching /src\\__tests__\\devAuthUiSmoke.test.js/i.
```

### 11. Launch E2E smoke: public surfaces, protected redirects, privacy, PWA

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 2437 ms

```text
- Page/console errors: 0
- Ignored monitoring warnings: 2
## Steps
### 1. PASS Consumer service catalog renders launch services
- Duration: 1137 ms
- Detail: ok
### 2. PASS Protected booking route redirects to auth in production build
- Duration: 132 ms
- Detail: ok
### 3. PASS Protected worker dashboard redirects to auth in production build
- Duration: 39 ms
- Detail: ok
### 4. PASS Privacy and PWA public launch surfaces render
- Duration: 240 ms
- Detail: privacy + manifest ok
## Monitoring Warnings
- Loading the script 'https://cdn.razorpay.com/static/cx/razorpay-risk-detection/bundle.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.g
- Loading the script 'https://cdn.razorpay.com/static/cx/razorpay-risk-detection/bundle.js' violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://www.g
```

### 12. Live/staging smoke scaffold: SSL, URL, route, and maps checks when GIGTOS_SMOKE_URL is set

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 551 ms

```text
PASS SSL certificate gigto.in - authorized=true; daysRemaining=77
PASS HTTP https://gigto.in/ - 200 text/html; charset=utf-8 93ms; spa=true
PASS HTTP https://gigto.in/#/auth - 200 text/html; charset=utf-8 18ms; spa=true
PASS HTTP https://gigto.in/#/jobs - 200 text/html; charset=utf-8 17ms; spa=true
PASS HTTP https://gigto.in/#/service - 200 text/html; charset=utf-8 17ms; spa=true
PASS HTTP https://gigto.in/#/privacy - 200 text/html; charset=utf-8 16ms; spa=true
PASS HTTP https://gigto.in/#/worker/dashboard - 200 text/html; charset=utf-8 15ms; spa=true
PASS HTTP https://gigto.in/#/admin/super - 200 text/html; charset=utf-8 17ms; spa=true
PASS GitHub Pages SPA fallback https://gigto.in/auth - 200 text/html; charset=utf-8 139ms; fallback=false
PASS CSP allows Sentry ingest - connect-src includes Sentry ingest hosts
PASS Maps/navigation integration visible in app bundle - 200 text/javascript; charset=utf-8 69ms; maps=true
PASS PWA manifest - 200 application/json 16ms; hasIcon=true
```

## Next Action

- Add real credentials for staging/live checks, then add Razorpay sandbox separately when payment work resumes.
