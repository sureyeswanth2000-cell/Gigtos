# Pending Tasks

Date: 2026-03-08

Updated backlog after latest implementation pass.

1. Profile extended fields and photo upload
- Add `postalCode`, `city`, `state`, and profile photo upload support.
- Primary files: `react-app/src/pages/CompleteProfilePhone.js`, `react-app/src/pages/Profile.js`.

2. Full payment/settlement pipeline UI
- Implement end-to-end client payment flow and settlement views.
- Ensure frontend reflects full financial lifecycle, not status-only representation.

3. Calendar scheduling (worker-level)
- Add calendar board for worker availability and booking slots.
- Prevent overlaps and support drag/drop rescheduling for future jobs.

4. SLA escalation delivery hardening
- Add optional SMS/WhatsApp escalation hooks for delayed booking alerts.
- Keep in-app `admin_alerts` as baseline and add delivery retries/observability.

5. Full manual UAT with real accounts
- Validate all role flows (User, Mason, Worker, RegionLead, SuperAdmin).
- Capture strict step-by-step PASS/FAIL execution logs.

6. Premium UI Polish: Phase 2 (Public & Functional Pages)
- [ ] Global Layout: Refactor Header, App.js, and tokens.css for consistent premium glassmorphism.
- [ ] Landing Page: Redesign Home.js/Home.css hero and service display.
- [ ] Functional Flows: Overhaul Service.js (Booking), MyBookings.js, and Profile.js.
- [ ] Management: Premium cards for Workers.js and AdminBookings.js.

## Completed In This Cycle
- Worker schema fields wired (`certifications`, `bankDetails`, `totalEarnings`).
- Worker auto-pick assignment with mason override before start.
- Quote presets with editable add-on values.
- Search + filter enhancements for user and admin roles.
- Multi-day work day-count tracking.
- 24h delay SLA backend checks and region lead in-app alerts.
