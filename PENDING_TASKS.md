# Pending Tasks

Date: 2026-03-08

These are the deferred items (steps 1-4) requested to be kept pending.

1. Profile extended fields and photo upload
- Add `postalCode`, `city`, `state`, and profile photo upload support.
- Primary files: `react-app/src/pages/CompleteProfilePhone.js`, `react-app/src/pages/Profile.js`.

2. Full payment/settlement pipeline UI
- Implement end-to-end client payment flow and settlement views.
- Ensure frontend reflects full financial lifecycle, not status-only representation.

3. Worker schema completion
- Add and use `certifications`, `bankDetails`, and `totalEarnings` in worker lifecycle.
- Primary collections/files: `gig_workers`, worker onboarding/management flows.

4. Worker-specific assignment flow
- Implement explicit `workerId` assignment and worker acceptance flow per booking.
- Ensure booking lifecycle supports mason-to-worker handoff.
