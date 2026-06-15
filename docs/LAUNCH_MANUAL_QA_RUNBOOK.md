# Gigtos Launch Manual QA Runbook

Last updated: 2026-06-14

Use this runbook after `npm run smoke:heart` passes. Manual QA must use real Firebase test accounts, but account emails, phone numbers, passwords, OTPs, UIDs, and private tokens must stay outside the repo.

## Before You Start

- Confirm live site: `https://gigto.in`
- Confirm automated gate: `npm run smoke:heart`
- Confirm launch readiness report: `react-app/docs/LAUNCH_READINESS_LATEST.md`
- Confirm account list template: `TEST_LOGINS.md`
- Keep payment/Razorpay out of MVP QA unless payment work is explicitly resumed.
- Keep screenshots private if they show phone, address, bank, identity, or exact location.

## Evidence To Capture

For each role, record:

- Date/time
- Browser/device
- Account role only, not account credentials
- Steps passed/failed
- Screenshot or short screen recording when safe
- Firestore document IDs only when needed for debugging
- Bug severity: blocker, high, medium, low

## Consumer Flow

Pass criteria: a new or existing consumer can browse services, prepare a booking, view quote/pricing copy, update profile, and see booking history without fake data or crashes.

- [ ] Sign in as consumer.
- [ ] Open `/services`.
- [ ] Confirm launch services appear: Kitchen Help, Bathroom Cleaning, Full House Cleaning, Home Helper.
- [ ] Open `/service?type=Kitchen%20Help`.
- [ ] Enter issue details and location.
- [ ] Confirm backend/deterministic quote appears.
- [ ] Confirm consumer sees clear price and launch copy.
- [ ] Confirm worker receivable copy says worker receives full amount during MVP.
- [ ] Attempt booking creation.
- [ ] Confirm booking appears in `/my-bookings`.
- [ ] Open `/profile`.
- [ ] Save name, phone, city, area, state, postal code.
- [ ] Upload profile photo.
- [ ] Confirm profile reload keeps saved fields.
- [ ] Confirm no private admin/worker data is visible.

## Worker Flow

Pass criteria: a verified worker can view dashboard, configure Open-to-Work readiness, see Smart Queue states, update safe profile fields, and access support/history without crashes.

- [ ] Sign in as approved worker.
- [ ] Open `/worker/dashboard`.
- [ ] Confirm worker name, area, GigScore, wallet/free-access section, and Smart Queue area render.
- [ ] Confirm push alert state is clear:
  - If VAPID is missing, UI must say setup is waiting and Smart Queue still works in-app.
  - If VAPID is configured, browser can register notifications.
- [ ] Click price-rule check in Open-to-Work setup.
- [ ] Confirm worker sees allowed/suggested price guidance.
- [ ] Open to work if local price rules allow it.
- [ ] Confirm session remaining time/heartbeat appears.
- [ ] Open `/worker/profile`.
- [ ] Confirm language selector appears.
- [ ] Confirm payout bank form is present.
- [ ] Confirm worker can update only safe profile fields.
- [ ] Confirm worker cannot approve self, change GigScore directly, or change approval status from client.
- [ ] Open `/worker/history` and `/worker/support`.

## Pending Worker Review Flow

Pass criteria: pending worker cannot access full worker operations until approval, and SuperAdmin/field-operator can review safely.

- [ ] Sign in as pending worker.
- [ ] Confirm protected worker actions are blocked or show pending state.
- [ ] Sign in as SuperAdmin or field operator.
- [ ] Locate pending worker review.
- [ ] Review profile photo, previous work proof, service type, area, and price.
- [ ] Approve or reject with reason.
- [ ] Confirm audit/admin alert is created.
- [ ] Confirm worker record status updates correctly.

## Field Operator Flow

Pass criteria: field operator can inspect local trust queues without SuperAdmin-only power.

- [ ] Sign in as field operator.
- [ ] Open `/operator`.
- [ ] Confirm worker verification queue renders.
- [ ] Confirm dispute queue renders.
- [ ] Confirm quality notes/support sections render if available.
- [ ] Confirm SuperAdmin-only actions are blocked or absent.

## SuperAdmin Flow

Pass criteria: SuperAdmin can act as launch control tower with MFA-sensitive actions protected.

- [ ] Sign in as SuperAdmin.
- [ ] Open `/admin/super`.
- [ ] Confirm AI/Ops Health panel renders.
- [ ] Confirm Sentry/App Check/Jira/Firebase handoff statuses are readable.
- [ ] Confirm worker verification review works.
- [ ] Seed or edit MVP price rules for one city/area/service.
- [ ] Confirm demand-pricing config shows min/average/high/peak/cap fields.
- [ ] Confirm Area Intelligence panel renders.
- [ ] Confirm GigScore review queue renders.
- [ ] Confirm sensitive action requires MFA/recent auth where enforced.
- [ ] Confirm audit log or admin alert is created for sensitive changes.

## Optional Legacy Role Checks

Only run these if launch scope includes them.

- [ ] Mason route `/mason/dashboard` renders and does not expose unrelated data.
- [ ] Region Lead route `/admin/region-lead` renders and does not expose unrelated data.

## VAPID / Push Notification Check

Run after `REACT_APP_FIREBASE_VAPID_KEY` is configured and hosting is redeployed.

- [ ] Sign in as approved worker in a real browser.
- [ ] Open `/worker/dashboard`.
- [ ] Allow browser notifications.
- [ ] Confirm `registerWorkerPushToken` succeeds.
- [ ] Create or simulate a Smart Queue offer for that worker.
- [ ] Confirm foreground offer appears in app.
- [ ] Put browser in background.
- [ ] Confirm background notification appears.
- [ ] Click notification and confirm it opens worker dashboard/offer.

## Fail Conditions

Any of these blocks launch:

- Consumer cannot create or view booking.
- Worker cannot open dashboard after approval.
- SuperAdmin cannot approve/reject worker.
- Firestore permission error on normal allowed action.
- Unauthorized user can read/write another user's booking/chat/profile.
- Production build exposes dev bypass.
- Profile photo upload fails for normal image under 10 MB.
- Smart Queue offer can be accepted by the wrong worker.
- Any page crashes with a fatal React/JavaScript error.

## Current External Blockers

- Firebase Web Push VAPID public key is still required for real worker push notification delivery.
- Real-account manual QA needs private Firebase test accounts.
