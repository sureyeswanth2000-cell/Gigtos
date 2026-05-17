# Heart Monitor Latest

- Run ID: 2026-05-17T15-17-18-176Z
- Time: 2026-05-17T15:17:53.238Z
- Status: PASS
- Scope: local base smoke plus built route/asset checks, dev-auth UI interactions, and optional non-payment live/staging checks when GIGTOS_SMOKE_URL is set. Razorpay/payment checks and production cleanup are excluded.

## Steps

### 1. Booking smoke: consumer -> worker -> completion photo -> rating -> SocioScore event

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 4344 ms

```text
> gigto-react@0.1.0 smoke:booking
> react-scripts test src/__tests__/basicBookingSmoke.test.js --watchAll=false
PASS src/__tests__/basicBookingSmoke.test.js
  basic booking smoke loop
    √ runs consumer booking to worker completion photo to consumer rating and score event (4 ms)
    √ keeps dev bypass disabled unless explicitly enabled (12 ms)
Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.91 s, estimated 1 s
Ran all test suites matching /src\\__tests__\\basicBookingSmoke.test.js/i.
```

### 2. Local dev bypass guard: bypass may run only outside production deploy

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 798 ms

```text
Warning: REACT_APP_ENABLE_DEV_BYPASS=true. This is allowed for local build only; production deploy uses build:prod.
```

### 3. Production deploy guard: bypass must block deploy build

- Result: PASS
- Expected: failure
- Exit code: 1
- Duration: 760 ms

```text
Production deploy build blocked: REACT_APP_ENABLE_DEV_BYPASS=true. Disable dev bypass before production deploy.
```

### 4. Production build without dev bypass

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 21545 ms

```text
> gigto-react@0.1.0 build:prod
> node scripts/guardProductionBuild.js --production && react-scripts build
Creating an optimized production build...
Compiled successfully.
File sizes after gzip:
  293.55 kB  build\static\js\main.5018bdcf.js
The project was built assuming it is hosted at /Gigtos/.
You can control this with the homepage field in your package.json.
The build folder is ready to be deployed.
Find out more about deployment here:
  https://cra.link/deployment
(node:12536) [DEP0176] DeprecationWarning: fs.F_OK is deprecated, use fs.constants.F_OK instead
(Use `node --trace-deprecation ...` to show where the warning was created)
```

### 5. Built app route smoke: key URLs and static assets return OK

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 1468 ms

```text
PASS Route /Gigtos/auth - 200 text/html; charset=utf-8
PASS Route /Gigtos/services - 200 text/html; charset=utf-8
PASS Route /Gigtos/jobs - 200 text/html; charset=utf-8
PASS Route /Gigtos/service - 200 text/html; charset=utf-8
PASS Route /Gigtos/my-bookings - 200 text/html; charset=utf-8
PASS Route /Gigtos/profile - 200 text/html; charset=utf-8
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
PASS Asset /Gigtos/static/js/main.5018bdcf.js - 200 application/javascript; charset=utf-8
PASS Asset /Gigtos/static/css/main.04384b49.css - 200 text/css; charset=utf-8
```

### 6. Dev-auth UI smoke: consumer service page and worker dashboard interactions

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 4801 ms

```text
      at render (node_modules/@testing-library/react/dist/pure.js:247:10)
      at renderApp (src/__tests__/devAuthUiSmoke.test.js:56:16)
      at Object.<anonymous> (src/__tests__/devAuthUiSmoke.test.js:76:5)
      at TestScheduler.scheduleTests (node_modules/@jest/core/build/TestScheduler.js:333:13)
      at runJest (node_modules/@jest/core/build/runJest.js:404:19)
      at _run10000 (node_modules/@jest/core/build/cli/index.js:320:7)
      at runCLI (node_modules/@jest/core/build/cli/index.js:173:3)
PASS src/__tests__/devAuthUiSmoke.test.js
  dev-auth UI smoke
    √ opens the protected service booking screen as a dev consumer and updates smart match (230 ms)
    √ opens the public service catalog with launch and recruitable services (68 ms)
    √ opens the protected worker dashboard as a dev worker and reaches completion-photo modal (84 ms)
    √ opens the protected field operator console as a dev field operator (78 ms)
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        1.653 s, estimated 4 s
Ran all test suites matching /src\\__tests__\\devAuthUiSmoke.test.js/i.
```

### 7. Live/staging smoke scaffold: SSL, URL, route, and maps checks when GIGTOS_SMOKE_URL is set

- Result: PASS
- Expected: success
- Exit code: 0
- Duration: 1346 ms

```text
> gigto-react@0.1.0 smoke:live
> node scripts/runLiveSmoke.js
SKIP live smoke: set GIGTOS_SMOKE_URL to run staging/live URL checks.
```

## Next Action

- Add real credentials for staging/live checks, then add Razorpay sandbox separately when payment work resumes.
