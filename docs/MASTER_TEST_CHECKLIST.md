# Master Test Checklist for Gigtos QA & Bug Hunting

This checklist unifies all testing requirements, known UI gaps, and product-defined scopes for the Gigtos marketplace. Use this document as the primary testing guide for bug hunters and QA testers.

## 1. Authentication & Role Routing
- [ ] **First-Time Consumer Login:** Validate safe auto-create when a new consumer signs in with Google/phone/email. Ensure they are asked for missing details (phone, name, location, consent) *before* booking.
- [ ] **Role Redirection:**
  - `superadmin` -> `/admin/super`
  - `regionLead` -> `/admin/region-lead`
  - Others -> `/admin/bookings`
- [ ] **SuperAdmin Filters:** Validate that SuperAdmin can see both legacy `admin` and `mason` roles in assignment/visibility filters.
- [ ] **Worker Identity & Privacy:** Verify worker Aadhaar/identity data is never exposed in normal app views. Masked displays only.

## 2. Worker Onboarding & Quality
- [ ] **Worker Funnel:** Validate 10-minute first onboarding checklist (service type, area, price, photo, availability, previous proof).
- [ ] **Worker Supply Rule (MVP):** Ensure only experienced workers with verified proof (UC/Pivot/etc.) can bypass waitlists or gain immediate approval.
- [ ] **Free Access Promotion:** Verify verified workers receive an initial 1-month free access.
- [ ] **Service Checklists:** Ensure before/after work pictures are prompted and enforced for specific services.
- [ ] **Guild UI:** Ensure guild codes and team scoring displays correctly if a worker joins a guild.

## 3. Booking Flow & Payment (MVP Scope)
- [ ] **Simple Booking:** Test `Book Now`, `Book Later`, and `Notify Me` buttons.
- [ ] **Worker Assignment:** Accepted bookings must auto-assign to top eligible worker, with manual override available for Mason/Admin.
- [ ] **Multi-day Bookings:** Test booking creation with `estimatedDays` and verify `completedWorkDays` vs `remainingWorkDays`.
- [ ] **Address Visibility:** Confirm exact address is hidden until booking is accepted AND worker starts travel/work.
- [ ] **Occupied State:** Verify honest "All nearby workers are occupied" UI rather than fake availability.
- [ ] **Direct Payment / COD:** Verify UI says "Pay worker directly after work" (No Razorpay/In-app payment for MVP).
- [ ] **SLA Delay Alerting:** Verify bookings delayed > 24h trigger region lead notifications (`statusUpdatedAt` tracking).

## 4. UI Issues & Broken Links (Bug Hunt Targets)
- [ ] **JobCard.jsx:** Verify navigation works even if `job.id` is missing or handle it gracefully.
- [ ] **JobList.jsx:** Verify safe navigation using job name (prevent crashes on malformed data).
- [ ] **LiveServiceTracker.js:** Map links must handle missing `session.lastLat` or `session.lastLng` without breaking.
- [ ] **Disabled UI Gracefulness:** "Coming Soon" alerts in `Admin.js`, `specialJobs.js`, and `WorkerRegistration.jsx` must be clear and non-blocking.
- [ ] **Null/Undefined Fallbacks:** Ensure `LocationContext.js` and `aiAssistant.js` fail safely if location data is denied or missing.
- [ ] **Design Tokens:** Verify UI conforms to the strict tokens (Indigo #764BA2, Emerald #057A31) and 8pt spacing system.

## 5. GigScore Mechanics
- [ ] **Base Scores:** Consumers start at `0`. Workers start at `450` and move to `500` upon basic profile completion.
- [ ] **Decay & Floor:** Verify inactivity decay never pushes score below `450`.
- [ ] **Score Display:** The dashboard must show a speedometer with finalized score, tier, and yesterday-to-today change. No full history in MVP.
- [ ] **Positive Events:** Test +8 (5-star job), +3 (consumer booking completion), +30 bonus (3 straight 5-star jobs).
- [ ] **Negative Events:** Test -50 (worker dispute fault/no show), -35 (risky cancellation). Verify these stay "pending" for review.
- [ ] **Anti-Farming Limits:** Ensure repeat consumer-worker pair ratings hit the monthly positive point limit.
- [ ] **Tiers:** Copper (<450), Bronze (450-599), Silver (600-749), Gold (750-899), Diamond (900+).
- [ ] **Diamond Pricing:** Diamond workers can optionally enable a +10% trusted-service price increase.

## 6. Security, Policy & Data Connect
- [ ] **Client Secrets:** Ensure NO secrets (payment, Gemini, SMS, Firebase service accounts) are in frontend config.
- [x] **Admin AI & Callables:** Sensitive AI orchestrations are backend callables behind App Check/custom-claim or admin-role gates; superadmin AI actions write audits.
- [ ] **Firestore Rules:** Validate `gigscore_events` and sensitive worker data are backend-written and read-only to appropriate actors.
- [ ] **Data Connect Schema:** Check SQL migrations and Data Connect mappings for `gig_score`, `gig_score_tier`, and `gigscore_events`.

## 7. Accessibility
- [ ] **Keyboard Nav:** Complete keyboard navigation for all interactive controls.
- [ ] **Focus Rings:** Visible focus ring on all links/buttons/fields.
- [ ] **Error States:** Form errors must be text-based, not color-only.

---

## 8. Missing Features to Implement & Test (From Project Audit & TODO.md)
*These features are identified as missing or incomplete across the `FEATURE_GAP_REPORT.md` and `TODO.md`. They must be implemented and then tested.*

### 8.1 Profile & UI Gaps
- [ ] **Missing Profile Fields:** `postalCode`, `city`, `state`, and profile photo upload are not fully implemented.
- [ ] **GigScore Settings UI:** Build full superadmin editable GigScore settings UI (thresholds, score deltas, tip caps, Elite/Diamond controls).
- [ ] **Copper Monitoring UI:** Add Copper monitoring panel in superadmin (count of Copper users, alert thresholds, recovery actions).
- [ ] **1-Star Attack Review UI:** Consumer repeated 1-star attack review UI to freeze score increases and hold rating impact as pending.
- [ ] **Area Intelligence Dashboard:** Superadmin area intelligence dashboard for demand/supply analytics.

### 8.2 Payment & Monetization
- [ ] **Full Payment/Settlement Pipeline:** Not implemented end-to-end in frontend (Razorpay checkout, order flow, webhook idempotency).
- [ ] **Platform Fee Display:** Always show consumer platform fee line item even when it is `INR 0`.
- [ ] **Subscription Collection:** Worker subscription collection automation (manual UPI collection currently).
- [ ] **Bargain/Offer Feature:** Booking-time-only bargain/offer feature for consumers to ask for a small price reduction before confirmation.

### 8.3 Booking & Workflow
- [ ] **Smart Queue & Auto-Booking:** Full Smart Queue engine, future auto-booking, multi-booking, and autonomous recurring booking (disabled for MVP).
- [ ] **Preferred Worker List:** Guard preferred worker/off-platform leakage, and add weekly/multi-day booking intents.
- [ ] **Emergency Work Assignment:** Emergency/4-hour work assignment and standby help workflows.
- [ ] **Photo/Document Review Queue:** Add photo/document review queue for worker certificates, previous platform ID, work proof, and dispute evidence.
- [ ] **Double-Blind Reviews:** Implement double-blind review behavior where neither party sees the review until both submit.

### 8.4 AI & Orchestration
- [x] **AI Orchestration MVP Framework:** Backend AI gateway, Vertex-first routing, Gemini fallback, Sentry/Jira/RAG handoffs, ops alerts, usage telemetry, model-routing policy, and agent contracts are documented/implemented for MVP.
- [x] **AI Agent Runtime Readiness:** Daily/manual backend dry-run cycle writes `ai_agent_runtime_cycles`, checks model/RAG/freshness/vector readiness, prepares release packets, and stops at human approval. Full Cloud Run/LangGraph action execution still requires external service accounts and remains locked.
- [x] **AI Usage Limits & Controls:** AI support token/cost policy, support-type limits, and action-safety rules are documented in `docs/CONSUMER_AI_MANUAL.md`; gateway telemetry records first measurement baseline.
- [x] **Heart Monitor:** Playwright-based `npm run smoke:browser-heart` checks key route rendering, React root health, fatal browser errors, and screenshots; `npm run smoke:heart` includes it after the production build.
- [x] **AI Image Comparison:** Backend AI photo quality review now creates `ai_photo_quality_reviews` with Vertex multimodal attempt or metadata fallback, always pending human review.
- [x] **Consumer AI Manual:** Consumer AI purpose, data limits, action limits, usage policy, and examples are documented in `docs/CONSUMER_AI_MANUAL.md`.

### 8.5 Business & Operations
- [ ] **Community Support Program:** Discuss and design Gigtos Community Support Program for launch funding.
- [ ] **Field Operator SOP:** Field operator SOP, workflow, and incentive model.
- [ ] **Unit Economics Dashboard:** Dashboards tracking platform debt, unit economics, and SLA rules.
- [ ] **Website SEO:** Service/category landing metadata, city/locality pages, sitemap, and organic tracking.
