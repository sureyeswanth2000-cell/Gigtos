# Gigtos App Guidelines And Build Path

Date: 2026-05-20

This document is the working north star for Gigtos. Follow it when modifying the current app, planning the rebuild, or adding new features. Update it when product rules change.

## Product Principle

Gigtos must become a premium, simple, trustworthy Indian local-services marketplace. Booking reliability comes first, marketplace intelligence second, and fancy features third.

Every feature should protect:

- consumer safety
- worker dignity
- trust in GigScore
- marketplace liquidity
- clear pricing
- long-term Gigtos reputation

## Core App Guidelines

1. Keep MVP narrow.
   Start with maid services, house cleaning, kitchen cleaning, bathroom cleaning, electrician, plumber, and emergency help. Do not expose inactive services as "coming soon" in consumer booking flows. Show only active services or a truthful occupied/unavailable state.

2. Make login easy.
   Consumers should enter with Google, phone, or email. If a new consumer tries to log in, create the account safely and ask only for missing details when needed for booking.

3. Build worker supply before advanced consumer features.
   Worker onboarding must capture service type, service areas, price, photo/profile, phone, previous platform proof, availability, quality checklist, and payout setup later.

4. Treat booking as the heart of the app.
   The main flow should be: search service, choose location/time, show available workers, show price/GigScore/distance/tier, consumer chooses or auto-selects, worker accepts, payment/confirmation, completion photo, consumer feedback.

5. Keep GigScore pure.
   GigScore cannot be bought. It should move slowly and fairly, separate pending/finalized score, show recovery paths, use review for risk, and remain tied to behavior, quality, payment discipline, and trust.

6. Use AI to reduce friction.
   Basic Gito AI helps everyone with ordinary questions. Premium Gito AI Concierge gives Gold+ or trial/supporter users memory, photo scan, worker comparison, recurring planning, and emergency booking preparation. AI should prepare and recommend; sensitive final actions need rule checks and confirmation/human approval where required.

7. Track patterns before using heavy AI.
   Track safe events and produce daily summaries for user patterns, area demand, price drop-off, no-worker availability, recurring behavior, cancellation risk, and fraud/risk. AI should read privacy-safe summaries, not raw private user data.

8. Make payments safe before making them complex.
   Use Razorpay for consumer online payment when ready. Early cash fallback can exist with wallet/platform-fee debt tracking. Worker payouts need audit, hold/release, retry, reconciliation, and safe NEFT/IMPS/provider flow.

9. Build superadmin as the control tower.
   Superadmin needs user/worker map, demand/supply by area, approvals, GigScore review, platform-fee settings, free-access extension, payout hold/release, complaints, emergency/SOS, AI incidents, and app health.

10. Make trust visible.
    Consumers should see verified worker signals, clear pricing, support path, bad-service recovery, payment safety, and emergency help. Workers should see no commission, no forced targets, fair score recovery, payout clarity, and protection from fake complaints.

11. Keep UI premium but simple.
    Search belongs near the top. Use clear service cards, fewer choices, readable light/dark mode, mobile-first layout, and no confusing dashboard clutter.

12. Avoid dark patterns.
    Use ethical conversion psychology only: truthful contrast, reinforcement, loss-aversion warnings before risky actions, and recovery paths. Do not use fake urgency, fake scarcity, confusing cancellation rules, hidden fees, or shame-based scoring.

## Recommended Build Path

### Phase 0 - Stabilize Current Shell

- Keep current React/PWA working.
- Preserve useful existing logic only after review.
- Keep dev bypass for local smoke tests only.
- Keep TODO, policies, rules, and docs aligned.
- Do not add production-risky systems before auth/booking works reliably.

### Phase 1 - Access And Identity

- Complete easy login/new-consumer auto-create flow.
- Add missing profile details only when needed.
- Add worker signup/onboarding path.
- Add previous-platform proof capture for UC/Pivot/similar experienced workers.
- Add superadmin review for worker proof and launch free access.

### Phase 2 - Service Catalog And Availability

- Show only active bookable services.
- Support high-demand MVP services first.
- Add area/city selection and worker service-area logic.
- If no workers are available, show occupied/unavailable recovery actions: notify me, book later, expand radius, recurring booking, emergency premium, or standby help.

### Phase 3 - Matching And Booking

- Show nearby eligible workers sorted by location, availability, GigScore/tier, price fit, response speed, and bad-match history.
- Support consumer choose and auto-select best worker.
- Worker must accept unless they enabled a safe auto-accept mode.
- Remove worker from consumer UI if not accepted within the configured window or if assigned elsewhere.
- Add booking states, cancellation rules, and completion flow.

### Phase 4 - Completion, Feedback, And GigScore

- Require completion photo from worker where service type needs proof.
- Collect consumer feedback after completion.
- Show GigScore speedometer, daily movement, pending/finalized status, and recovery path.
- Keep low ratings/disputes pending until review.
- Keep score movement slow and explainable.

### Phase 5 - Basic AI And Pattern Tracking

- Add Basic Gito AI for everyone: FAQ, booking help, cancellation/payment explanation, service selection, and no-worker guidance.
- Add safe event tracking and daily summaries.
- Do not let AI read raw private user data.
- Track whether AI suggestions lead to booking, completion, repeat booking, or complaint.

### Phase 6 - Superadmin Control Tower

- Add area-wise worker/consumer/demand map.
- Add worker approval/review queues.
- Add GigScore review queue and editable settings.
- Add free-access extension filters.
- Add no-worker demand and worker recruiting insights.
- Add app health and incident visibility.

### Phase 7 - Payments And Payouts

- Add Razorpay order/payment verification.
- Add cash fallback rules only if needed.
- Add worker wallet/platform-fee debt tracking.
- Add payout setup and masked bank display.
- Add payout holds, retries, reconciliation, and audit logs.

### Phase 8 - Premium AI Concierge

- First month can unlock premium AI trial.
- After trial, unlock Premium Gito AI for Gold+ users or approved supporter/promo access.
- Add memory for preferred time, favorite worker, home type, language, recurring needs, past issues, and budget.
- Add photo scan with confidence levels.
- Add emergency booking assistant that prepares booking first and asks confirmation.
- Later, allow saved emergency auto-book only with strict max price/radius/service/payment/audit rules.

### Phase 9 - Rebuild Architecture

- Decide whether to keep CRA temporarily or move to a cleaner modern frontend stack.
- Define database schema first, then implement UI around stable contracts.
- Use Data Connect/PostgreSQL for permanent business truth.
- Use Firestore only for short-lived state like live location, temporary job tokens, rate limits, live booking state, and notifications.
- Move analytics and dashboards to summary/snapshot tables.

## Build Order Recommendation

The practical sequence is:

1. Auth/new consumer flow
2. Worker onboarding
3. Active service catalog
4. Location/area selection
5. Available worker matching
6. Booking flow
7. Completion photo and feedback
8. GigScore display and review
9. Basic AI support
10. Pattern tracking summaries
11. Superadmin review/control
12. Payments
13. Premium AI Concierge
14. Full architecture rebuild/migration

## Decision Rule

When a feature feels exciting but the booking path is still weak, delay the feature. Gigtos wins only if consumers can reliably book real workers and workers feel fairly treated.
