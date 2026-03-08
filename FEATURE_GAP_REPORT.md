# Feature Gap Report

Date: 2026-03-08
Source of truth compared: `COMPLETE_FEATURES_GUIDE.md` vs current code in `react-app/src` and Firebase files.

## Execution Status (Requested Steps)
1. Profile extended fields and photo upload: PENDING (moved to `PENDING_TASKS.md`)
2. Full payment/settlement pipeline UI: PENDING (moved to `PENDING_TASKS.md`)
3. Worker missing schema fields (`certifications`, `bankDetails`, `totalEarnings`): PENDING (moved to `PENDING_TASKS.md`)
4. Worker-specific job assignment flow (`workerId` linkage): PENDING (moved to `PENDING_TASKS.md`)
5. Automated test coverage expansion: COMPLETED
6. QA validation run: COMPLETED

## What Was Verified Working
- Admin role-aware app routing is now implemented in `react-app/src/App.js`.
- Region lead dashboard route exists: `/admin/region-lead` in `react-app/src/App.js`.
- Region lead header links are present in `react-app/src/components/Header.js`.
- Booking flow states and user actions (accept quote, cancel quoted/accepted, confirm completion, rebook, dispute) are implemented in `react-app/src/pages/MyBookings.js`.
- Scheduled booking UI and payload fields are implemented in `react-app/src/pages/Service.js`.
- Admin bookings has log/dispute actions and activity log UI in `react-app/src/pages/AdminBookings.js`.

## Bugs Found During Audit
1. Region lead/admin login redirect bug (fixed)
- Problem: `react-app/src/pages/Auth.js` redirected all admins to `/admin/bookings`.
- Fix applied: role-based redirect:
  - `superadmin` -> `/admin/super`
  - `regionLead` -> `/admin/region-lead`
  - others -> `/admin/bookings`

## Missing or Partial Features (Compared to Guide)
1. Profile completion fields are incomplete [PENDING]
- Guide claims: name, address, postal code, city, state, photo.
- Actual:
  - `react-app/src/pages/CompleteProfilePhone.js` collects only `name` and `address`.
  - `react-app/src/pages/Profile.js` manages only `name`, `email`, `phone`, `address`.
- Missing: `postalCode`, `city`, `state`, profile photo upload.

2. Guide terminology is outdated in multiple places [PARTIALLY UPDATED]
- Guide still references child admin role as `admin` in places, while implementation uses `mason` terminology in active flows.
- Guide states region lead dashboard under `/admin/bookings`, but actual route is `/admin/region-lead`.

3. Full payment/settlement pipeline is not implemented end-to-end in frontend [PENDING]
- Guide describes full financial distribution and wallet-style outcomes.
- Current UI mainly tracks statuses and displays derived numbers; no complete client payment flow is visible in pages audited.

## Guide Claims Updated
1. Region lead login redirect path updated
- Updated guide from `/admin/bookings` to `/admin/region-lead`.

2. Region lead dashboard location updated
- Updated guide section to reflect dedicated `RegionLeadDashboard.js` page and route.

3. Role naming consistency updated
- Updated guide references from old child-admin naming to mason terminology where applicable.

4. SuperAdmin compatibility bug fixed
- Updated `react-app/src/pages/SuperAdmin.js` filters to include both legacy `admin` and `mason` roles for assignment/visibility.

## Test Results Run
1. Build test
- Command: `npm run build`
- Result: success (compiled successfully)

2. Jest test suite
- Command: `npm test -- --watchAll=false --passWithNoTests`
- Result: success (2 suites, 15 tests passed)

3. Static diagnostics
- No editor errors reported for modified files during this session.

4. QA verification pass (code + command validation)
- Pricing workflow checks: PASS (`react-app/src/pages/AdminBookings.js`, `react-app/src/pages/MyBookings.js`, `react-app/src/utils/pricing.js`)
- Admin redirect rules checks: PASS (`react-app/src/pages/Auth.js`, `react-app/src/utils/authRouting.js`)
- Worker activation and role routing checks: PASS by code-path verification

## Notes
- This audit validates code presence and build integrity.
- Browser-side full E2E manual execution with real test accounts is still recommended before production launch.

## Role-by-Role QA Checklist (Run: 2026-03-08)

### User (Consumer)
- Auth (phone/password login): PASS (code path verified in `react-app/src/pages/Auth.js`)
- Service booking creation (pending/scheduled): PASS (UI + payload verified in `react-app/src/pages/Service.js`)
- My Bookings actions (edit/cancel/accept quote/confirm/rebook/dispute): PASS (verified in `react-app/src/pages/MyBookings.js`)
- Chat access by booking: PASS (verified in `react-app/src/pages/Chat.js`)
- Profile completeness fields (postalCode/city/state/photo): FAIL (not implemented)

### Mason/Admin
- Admin login redirect to bookings dashboard: PASS (`react-app/src/pages/Auth.js`)
- Booking management actions (quote/assign/start/finish/dispute handling): PASS (`react-app/src/pages/AdminBookings.js`)
- Workers visibility and ownership behavior: PASS by code review (`react-app/src/pages/Workers.js`, `firebase.rules`)
- Worker create/toggle workflow: PASS (`react-app/src/pages/Workers.js`)

### Region Lead
- Login redirect to dedicated region lead dashboard: PASS (`react-app/src/pages/Auth.js` -> `/admin/region-lead`)
- App-level redirect handling for region lead sessions: PASS (`react-app/src/App.js`)
- Header nav entry for region lead: PASS (`react-app/src/components/Header.js`)
- Region dashboard page/route wiring: PASS (`react-app/src/pages/RegionLeadDashboard.js`, `react-app/src/App.js`)

### SuperAdmin
- Superadmin redirect to `/admin/super`: PASS (`react-app/src/pages/Auth.js`, `react-app/src/App.js`)
- Admin/mason assignment visibility compatibility: PASS (fixed in `react-app/src/pages/SuperAdmin.js`)
- Region lead assignment/unassignment UI logic: PASS (`react-app/src/pages/SuperAdmin.js`)

### Platform/Build
- React build smoke test: PASS (`npm run build` compiled successfully)
- Static diagnostics (editor problems): PASS (no errors reported)

## Bug Re-check Summary
1. Region lead redirect bug: FIXED and re-verified.
2. Role naming mismatch (admin vs mason) in SuperAdmin filters: FIXED and re-verified.
3. Remaining known functional gaps:
- Profile extended fields/photo upload.
- Full payment and settlement pipeline end-to-end UI.
