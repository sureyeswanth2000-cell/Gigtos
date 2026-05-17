# TODO

Date: 2026-05-16

This is the current planning backlog for Gigtos. The target is no longer a simple website only. Gigtos should become a website + PWA/app-first Indian home-services marketplace where workers keep their job earnings, consumers get trustworthy service, and SocioScore becomes the main reputation engine.

## Current Product Direction

- Gigtos roles for the new workflow: consumer, worker, field operator, and superadmin.
- Remove new planning dependency on region lead, mason, and generic admin flows. Existing code may still contain those roles, but the forward product model should be field operator + superadmin.
- Superadmin is the owner control layer. Field operator handles local verification, worker checks, dispute support, and field quality.
- Field operator is future-phase because funds are limited now. Do not block MVP on field operator operations.
- Worker monetization is not commission-based. Workers keep job earnings.
- Gigtos revenue should come from consumer booking fees and worker subscription after free/trial access.
- Main strategic weapon: SocioScore + tiers + guilds + ethical psychology loops.
- The app structure needs a fresh rebuild plan. Existing code can be mined for useful ideas, but the forward product should be redesigned around the new roles, SocioScore, payments, field operations, and mobile-first UX.
- First target cities: Bangalore and Hyderabad.
- [x] MVP launch must control scope tightly.

## Today's Focus - SocioScore, Tier, Guild

- [x] Treat SocioScore as today's main product design priority.
- [x] Build SocioScore as a score ledger first, not only a field on worker/user profile.
- [x] Closely monitor Copper consumers and Copper workers because they are the highest-risk/highest-recovery segment.
- [x] Add superadmin dashboard controls to modify Copper thresholds, recovery discounts, restrictions, score-drop sensitivity, monitoring frequency, and alert rules from the frontend.
- [x] Build score UI as a speedometer on the home/dashboard first screen.
- [x] Show the user's current tier around the speedometer circle.
- [x] If the worker is in a guild, show guild tier around/near the speedometer too.
- [x] If the worker is individual, show individual tier only.
- [x] Show daily score reasons for every person: why score went up, why score dropped, pending points, finalized points, and recovery advice.
- [ ] Show improvement guidance beside every score change, for example "Improve: avoid late cancellation for 3 jobs to recover Silver" or "Upload proof photos to protect your score."
- [x] Add a daily score digest card: "Today: +15 for 5-star job, -0 penalties, +3 proof upload. 72 points to Gold."
- [ ] Add a score history page with filters: today, week, month, booking, rating, cancellation, dispute, guild ripple, manual adjustment.

## Pricing And Monetization

- [x] Remove old active commission-style pricing from app/functions and worker-facing docs. Gigtos should not take worker commission from each job.
- [ ] Later architecture cleanup: rename old migration/Data Connect `commissions` artifacts into settlement/platform-fee ledger language during the database redesign.
- [x] Implement booking-based consumer platform fee tiers:
  - Booking amount `<= INR 500`: platform fee `INR 19`.
  - Booking amount `INR 501-1000`: platform fee should be a slightly higher flat fee; recommended v1 `INR 29`, configurable by superadmin.
  - Booking amount `> INR 1000`: platform fee `INR 19 + 2%` of booking amount.
- [x] Add tests for fee examples: `INR 400 -> INR 19`, `INR 800 -> INR 29`, `INR 1200 -> INR 43`, with rounding rules documented.
- [x] Add worker subscription plan: `INR 1000/month` after the free access period, configurable by superadmin.
- [x] First 30 days launch plan: provide Gigtos free access/platform usage; founder will manually manage platform/payment costs where needed.
- [x] Add one-year free worker access for verified workers who provide an existing valid platform ID/card from UC, Pivot, or similar trusted service platforms.
- [x] Do not force UC/Pivot workers to leave their existing app. Gigtos should support freedom: workers can use UC/Pivot and Gigtos in parallel, with no pressure, no exclusivity, and no targets.
- [x] Add subscription fairness/refund logic:
  - if a subscribed worker does not get proper work/leads from Gigtos, provide partial subscription refund or credit based on clear rules
  - if worker receives verified 1-star ratings 3 times, has repeated quality issues, or has low SocioScore, do not refund subscription because Gigtos is inviting experts and must protect consumers
  - refund/credit decision should be explainable and logged
  - superadmin can override with reason
- [x] Allow superadmin to extend free access in future by campaign, city, platform source, tier, or invite batch.
- [x] Store external platform ID proof safely: platform name, masked ID/card display, verification status, reviewed by, reviewed at, free-access-until, and audit log.
- [x] Consumer price display must be truthful and all-inclusive. Worker/admin settlement views should show worker earnings, consumer booking fee, gateway fee, taxes if any, and payout status clearly.

## SocioScore Core Model

- [x] Use max score `1000`.
- [x] Worker starts at `500`.
- [x] Consumer starts at `0`.
- [ ] Add a humane SocioScore floor rule: once a consumer/worker has reached an active marketplace score, inactivity decay or normal penalties must never push the displayed finalized score below `450`; if risk is serious, use booking restrictions, review, and recovery missions instead of showing a demoralizing sub-450 score.
- [ ] Revisit Copper tier wording after the 450 floor: Copper should become a monitored/recovery state at the floor or for reviewed high-risk behavior, not a public shame score that hurts returning inactive users.
- [ ] Store every score change in `score_events`:
  - actorId
  - actorRole
  - bookingId
  - guildId if applicable
  - reasonCode
  - reasonText
  - oldScore
  - delta
  - newScore
  - status: pending, finalized, reversed
  - createdAt
  - finalizedAt
  - reviewedBy if manually changed
  - fraudReviewState
- [ ] Score shown to users should separate:
  - Current finalized score
  - Pending score
  - Today's movement
  - This week's movement
  - Score at risk
  - Recovery path

## SocioScore Point Rules - V1 Suggestion

- [ ] Worker score changes:
  - 5-star completed job: `+15`
  - 4-star completed job: `+8`
  - 3-star completed job: `0`
  - 2-star verified issue: `-30`
  - 1-star verified issue: `-60`
  - Worker cancellation under 2 hours: `-100`
  - Worker no-show: `-150`
  - Late arrival without update: `-20`
  - Proof/photo uploaded correctly: `+3`
  - Job completed on time: `+5`
  - Consumer tip after completion: worker `+5`, consumer `+20`
  - Phoenix Bonus: 5 straight 5-star jobs gives `+100` one-time recovery/boost bonus.
- [ ] Consumer score changes:
  - 5-star rating after completed job: `+10`
  - 4-star rating after completed job: `+5`
  - Helpful review with useful detail/photo: `+5`
  - Tip after completed job: `+20`
  - Cancellation under 2 hours: `-50`
  - Fake complaint proven: `-100`
  - Repeated no-show/support abuse: temporary booking restriction plus score penalty after review.
- [ ] Daily app open should be tiny or later removed. If used, cap it at `+1/day` and never let it dominate real service behavior.
- [ ] Inactivity decay after 10 days:
  - Worker: `-5`
  - Consumer: `-2`
  - Calculate lazily on app open or score read to save cost.
- [ ] Same consumer-worker pair should give score points only 2-3 times per month to prevent fake repeated jobs.
- [ ] 1-star and 2-star effects should remain pending until evidence, dispute window, and fraud checks finish.

## Psychology Loops

- [ ] Reinforcement loop:
  - Show after every job: "+15 added. 72 points to Gold."
  - Show small wins immediately, but mark them pending when fraud/dispute checks are still open.
- [ ] Loss aversion loop:
  - Before risky action: "Cancelling now may reduce your score by 100 and delay Gold access."
  - Always show exact score impact, exact reason, and confirmation.
- [ ] Recovery loop:
  - Never make workers feel finished.
  - Show: "Complete 3 clean jobs to recover Silver."
  - Show recovery targets after penalties, disputes, inactivity, or tier drop.
- [ ] Avoid dark patterns:
  - No fake urgency.
  - No fake scarcity.
  - No forced streaks.
  - No vague punishment.
  - No hidden score formula changes without admin audit.

## Worker Tier System

- [ ] Tier should be based on finalized SocioScore, not pending points.
- [ ] Recommended worker tiers:
  - Copper: `<450`
  - Bronze: `450-599`
  - Silver: `600-749`
  - Gold: `750-899`
  - Diamond: `900+`
  - Elite: manual, invite/approval only.
- [ ] Diamond is the minimum eligibility gate for Elite.
- [ ] Worker must be individual Diamond before becoming eligible for Elite.
- [ ] Diamond score alone does not grant Elite. It only unlocks Elite review.
- [ ] Elite requires:
  - Individual Diamond score
  - Strong recent clean-job history
  - Verified identity and previous platform/work proof
  - Field operator quality check
  - Superadmin approval
  - Privacy/safety training
  - No serious unresolved disputes
- [ ] Elite is future dispute-sensitive. Serious dispute should pause Elite eligibility until reviewed.
- [ ] Tier benefits should focus on trust and access:
  - Copper: recovery prompts, training, Phoenix Bonus visible.
  - Bronze: standard marketplace access.
  - Silver: better ranking and more visible trust.
  - Gold: priority leads and stronger badge.
  - Diamond: top placement, premium jobs, no platform fee on eligible jobs, subscription discount/free months.
  - Elite: luxury/private jobs, NDA jobs, high-price jobs, insurance/support benefits.

## Consumer Tier Benefits

- [ ] Consumer Diamond tier should remove consumer platform fee on eligible bookings, subject to abuse and campaign limits.
- [ ] Consumer Diamond tier does not automatically get a 10% discount. Diamond consumer benefit is platform-fee-free service only, unless a separate campaign is explicitly enabled.
- [ ] 10% discount should be tied to Copper situations only:
  - Copper consumer may receive a 10% recovery/activation discount when eligible.
  - Copper worker or Copper guild may show 10% lower intro/recovery price to regain bookings.
  - Silver, Gold, Diamond, and Elite should not get automatic 10% discount only because of tier.
- [ ] Consumer discount must be funded by platform/campaign budget or explicitly approved Copper recovery pricing; it must not silently reduce worker payout.
- [ ] Consumer Diamond benefit should not reduce worker payout unexpectedly.
- [ ] Diamond consumer + individual Diamond worker should be same normal worker price: no worker price increment, no consumer discount, and no consumer platform fee.
- [ ] Consumer tier UI should show:
  - Current tier
  - Platform-fee-free bookings used/remaining if capped
  - Discount eligibility
  - Score reasons and recovery path
  - Fair-use warnings for cancellations/fake complaints

## Copper Monitoring And Controls

- [x] Add Copper Monitoring panel in superadmin:
  - Copper consumers count
  - Copper workers count
  - Copper guilds count
  - new Copper entries today/week
  - recovered Copper users today/week
  - repeated cancellation/no-show/fake complaint counts
  - active restrictions
  - recovery missions completed
- [x] Superadmin should be able to configure:
  - Copper score threshold
  - Copper discount percent, default `10%`
  - Copper discount max amount
  - number of recovery jobs required
  - restriction rules for repeated no-show/fake complaint
  - alert threshold for risky Copper behavior
  - whether Copper discount is active by city/service
- [x] Copper monitoring should never become permanent punishment. Every Copper user/worker must see recovery path and exact next steps.

## Guild System

- [x] Add shared guild scoring helper for 3-6 worker guilds, first-5-job protection, weighted averages, guild tier, and guild pricing/recommendation rules.
- [ ] Guild size should be 3 to 6 workers per group.
- [ ] Guilds are city/service-area based.
- [ ] Guild tier should be displayed when a worker belongs to a guild.
- [ ] Individual tier and guild tier are separate. Do not hide individual tier.
- [ ] Guild score should use finalized score events only.
- [ ] Guild score should be calculated from member scores with rules:
  - Active established members count in the average.
  - New/apprentice workers can have a protected onboarding period where they do not reduce guild tier immediately.
  - Recommended protected period: first 5 completed jobs or first 30 days, whichever comes first.
  - If a consumer or worker brings/adds a new person, that new person's score should not affect the inviter/group score for the first 5 completed jobs.
  - After protected period, Copper/Silver members affect guild average normally.
  - This lets experienced workers bring new workers without immediately destroying group status, but prevents permanent sheltering.
- [ ] Suggested guild score formula:
  - `guildScore = weighted average of active finalized member scores + guildBehaviorBonus - guildRiskPenalty`
  - Established member weight: `1.0`
  - Protected new member weight: `0.0` for tier average, but visible as apprentice.
  - Recently activated new member weight: `0.5` for next 30 days.
  - Full member after probation: `1.0`.
- [ ] Guild ripple points:
  - Worker who completes the job gets 100% of their individual points.
  - Other guild members get a small support ripple only from positive finalized events.
  - Recommended v1 ripple: 10% of positive job points split to each member, capped per day.
  - Negative events should not automatically punish every member unless it is a guild-level pattern.
- [ ] Guild tier thresholds can mirror worker tiers:
  - Copper guild: `<450`
  - Bronze guild: `450-599`
  - Silver guild: `600-749`
  - Gold guild: `750-899`
  - Diamond guild: `900+`
- [ ] Guild tier pricing/recommendation rules:
  - Diamond guild: guild workers can charge 10% higher by default, and the platform should recommend them first when quality/location/availability match.
  - Individual Diamond worker outside a guild gets no platform fee benefit, but not an automatic 10% price increase.
  - Diamond consumer booking an individual Diamond worker should pay the same worker price with no increment and no discount; only the consumer platform fee is removed.
  - Gold guild: same normal price, but better ranking and trust badge.
  - Copper guild: 10% lower intro/recovery price to help regain bookings.
  - Silver guild and new guilds: no price change.
  - New/apprentice member's first 5 jobs do not affect guild tier or group pricing.
- [ ] Guild Diamond recommendation must still respect distance, availability, service fit, and recent complaints. Do not recommend a Diamond guild first when it is far away or mismatched.
- [ ] Diamond guild should get a 7-day shield before downgrade, but only for ordinary score movement. Fraud/safety issues can pause the shield.
- [ ] Guild anti-abuse checks:
  - Same consumer repeatedly booking guild members.
  - Same device/payment patterns.
  - Sudden rating clusters.
  - One guild creating fake work loops.
  - New members rotating in/out to avoid score impact.
- [ ] Guild should create positive peer pressure, not unfair punishment. Keep individual accountability clear.

## Group Join, Exit, And Ownership

- [ ] Any consumer or worker can leave a group/guild anytime, subject only to active booking/dispute safety checks.
- [ ] Workers can join a guild using a guild/group code.
- [ ] Consumers can join consumer groups using a group code if consumer groups are enabled later.
- [ ] When a user enters a group code, show a preview before join request:
  - Group name
  - Group owner
  - Current members
  - Member tiers
  - Group/guild tier
  - Service area/city
  - Group rules
- [ ] Joining a group should require owner approval.
- [ ] Group owner should see pending join requests with requester profile, tier, score, service type, city, and recent risk flags.
- [ ] New joined person's score should not affect group/guild score or group/guild tier for first 5 completed jobs.
- [ ] After 5 completed jobs, include the member in group/guild average and tier calculation.
- [ ] If a member exits before completing 5 jobs, do not backfill their protected score into group average.
- [ ] Owner can remove a member only with a reason; removal should be logged and visible to superadmin/field operator for abuse review.
- [ ] Prevent group-code abuse with expiry, regenerate option, join request rate limits, and audit logs.

## Speedometer UI

- [x] Home/dashboard first screen should show score as a speedometer.
- [x] Center: current SocioScore number.
- [x] Main dial color:
  - Copper: red/orange
  - Bronze: brown/amber
  - Silver: silver/gray
  - Gold: gold
  - Diamond: blue/white premium
  - Elite: black/gold premium
- [x] Around the circle: individual tier ring.
- [x] Secondary ring: guild tier if worker is in a guild.
- [x] Under dial:
  - Today's score movement
  - Points to next tier
  - Pending points
  - Score at risk
  - Recovery mission
- [ ] Consumer home should also show score, but simpler: trust score, benefits, clean booking behavior, and fair-use warnings.

## Local Language Support

- [x] Add localization/i18n foundation before rewriting too much UI.
- [x] Supported languages for v1:
  - English
  - Hindi
  - Telugu
  - Tamil
  - Kannada
- [x] Add translation keys for score reasons and recovery guidance; expand to full UI copy during rewrite:
  - booking flow
  - score reasons
  - score improvement guidance
  - warnings before score loss
  - payment and payout states
  - dispute/support flow
  - worker verification
  - group/guild join and exit
- [x] Score reason text must be local-language ready. Store reason codes in data, translate display text in UI.
- [ ] Keep legal/payment language simple and clear in every language; do not machine-translate sensitive policy text without review.

## Worker Trust, Verification, And Field Operator Flow

- [ ] Field operator workflow is future-phase. MVP should use superadmin/manual review plus AI/photo evidence first.
- [ ] Add worker verification roadmap: phone, Aadhaar or approved third-party identity verification, police/background verification where legally valid, certification upload, service-skill proof, and field-operator review.
- [x] Keep sensitive identity data out of normal Firestore documents; store only masked display fields and safe verification status in app-readable profiles.
- [x] Add audit logs for worker verification create/update/reject/reveal actions.
- [ ] Add superadmin-only sensitive verification review with reason capture and MFA/second approval before production scale.
- [ ] Add photo/document review queue for worker certificates, previous platform ID, work proof, and dispute evidence.
- [ ] Implement double-blind review behavior: consumer and worker do not see each other's review until both submit or the review window closes.
- [ ] Add unsafe/fake worker reporting path with temporary suspension, appeal, field-operator review, and superadmin audit trail.

## Acquisition Strategy For UC/Pivot Workers

- [x] Landing promise: "No job commission. Keep your earnings. Build your Gigtos SocioScore. First year free with verified UC/Pivot/similar ID."
- [x] Worker freedom promise: "Use Gigtos along with your existing platform. No pressure, no exclusivity, no targets."
- [x] Worker onboarding funnel: exact first 10 minutes after worker installs app — added reusable checklist model and worker signup preview UI.
- [ ] Worker onboarding:
  - Upload existing platform ID/card.
  - Choose city and services.
  - Field operator verifies.
  - Worker starts at score `500`.
  - Explain first 5 jobs, Phoenix Bonus, Diamond path, and Elite eligibility.
- [x] First 10-minute worker onboarding should include — captured in `workerOnboarding` checklist; actual upload/storage and payout setup remain under verification/payment implementation TODOs:
  - choose language
  - enter phone/login
  - choose worker type/services
  - choose service area and 10 km radius base
  - upload previous platform ID/card if available
  - add profile photo
  - add starting price for first services
  - show suggested price range
  - explain no commission and free/subscription period
  - explain SocioScore speedometer
  - explain first 5 jobs protection/Phoenix path
  - ask bank setup now or later
  - show first action: "Turn on available" or "Finish verification"
- [ ] Verified experienced worker badge:
  - Use only after proof review.
  - Consumer-facing copy should say "verified previous platform experience" rather than naming a competitor in a risky way if legal review is not done.
- [ ] Subscription conversion should happen only after value is proven:
  - Free access countdown.
  - Earnings summary.
  - Score growth summary.
  - Leads received.
  - Tier benefits unlocked.

## Competitor Response Planning

- [ ] Prepare for likely competitor responses after launch:
  - lower commission or temporary worker incentives
  - consumer coupons/discounting
  - faster complaint/refund promises
  - worker retention calls and exclusivity pressure
  - legal/trademark complaints if copy names competitors carelessly
  - ads targeting Gigtos keywords
  - negative marketplace narratives about trust/safety
- [ ] Gigtos defense should be:
  - no worker commission
  - clear subscription/free-access value
  - portable SocioScore reputation
  - transparent score reasons
  - fast field-operator support
  - local-language worker support
  - fair payout timing
  - verified previous platform experience badge without misleading claims
- [ ] Do not attack competitors directly in product copy. Sell worker freedom, transparent scoring, and better local support.

## Data And Architecture

- [ ] Extend Data Connect/PostgreSQL plan for:
  - score_events
  - score_daily_summaries
  - worker_tier_history
  - consumer_tier_history
  - guilds
  - guild_members
  - guild_score_events
  - guild_tier_history
  - elite_applications
  - worker_subscriptions
  - external_platform_verifications
  - field_operator_reviews
- [ ] Use Pub/Sub for live work tracking events: booking accepted, worker started travel, worker arrived, work started, work completed, consumer confirmed, issue raised, and replacement/standby events.
- [ ] Use Pub/Sub for worker location tracking events with privacy-safe payloads, consent, rate limits, short retention, and current-location fanout to active booking consumers only.
- [ ] Keep raw live worker location short-lived in Firestore/realtime store; store only safe summaries for permanent history and analytics.
- [x] Add frontend/backend contract scaffolds for live tracking event payloads: booking accepted, worker travel, arrival, work start/completion, consumer confirmation, issue, replacement, and guild standby.
- [ ] Protect live tracking with App Check, authenticated role checks, booking ownership checks, topic-level IAM, and abuse monitoring.
- [ ] Keep Firestore only for short-lived state where appropriate: live location, temporary job tokens, rate-limit windows, live chat if still needed.
- [ ] Add feature flags and kill switches for SocioScore, guilds, Elite, subscriptions, payments, rewards, AI assistant, notifications, and worker payouts.
- [ ] Add analytics events:
  - `score_changed`
  - `score_digest_viewed`
  - `tier_changed`
  - `guild_joined`
  - `guild_tier_changed`
  - `elite_review_started`
  - `worker_subscription_started`
  - `external_platform_verified`
  - `score_at_risk_warning_shown`
  - `recovery_mission_completed`

## Payment Collection And Worker Payouts

- [ ] Collect money from consumers through Razorpay checkout/order flow.
- [ ] Keep consumer payment, booking state, score state, and payout state separate but linked by booking ID.
- [ ] Recommended payout model for v1:
  - collect consumer payment online
  - hold worker payable until job completion and dispute window rules pass
  - create payout candidate after completion
  - start payout preparation and reconciliation at 3:00 AM
  - execute eligible bank payouts after the 3:00 AM checks complete
  - target normal completion by 7:00-8:00 AM, but do not wait until 7:00 AM to start the payout pipeline
- [ ] Use IMPS for small/urgent payouts where instant 24x7 credit matters.
- [ ] Use NEFT for normal scheduled morning payouts where cost/limits are better and timing is acceptable.
- [ ] Add payout states:
  - pending_completion
  - payout_candidate
  - queued_for_reconciliation
  - ready_for_payout
  - payout_processing
  - paid
  - failed
  - reversed
  - held_for_dispute
- [ ] Add payout safety checks before 7-8 AM execution:
  - payment captured
  - no open dispute
  - worker bank account verified
  - no duplicate payout for booking
  - final worker amount calculated
  - platform fee/tax/gateway fee reconciled
  - idempotency key generated
  - sufficient RazorpayX/account balance
- [ ] Store payout reference ID, mode, UTR, status, failure reason, retry count, and reconciliation notes.
- [ ] Add manual superadmin hold/release for suspicious payouts.
- [ ] Add field-operator dispute hold path before payout release.
- [ ] Add payout failure retry job:
  - detect failed payout
  - classify failure reason
  - notify worker
  - ask worker to correct bank details if needed
  - retry after validation
  - escalate repeated failure to superadmin/support
- [ ] Support cash fallback for early MVP:
  - worker can collect cash from consumer only where enabled
  - worker then owes platform fee to Gigtos
  - track pending platform fee due
  - restrict future online/cash bookings if dues cross threshold
  - show clear receipt/payment status to consumer

## Heart Monitor - End-To-End App Health

- [x] Build local base Heart Monitor command (`npm run smoke:heart`) with PASS/FAIL report, booking smoke, build guard, production build, built route/assets, and dev-auth UI checks.
- [x] Add non-payment live/staging smoke command (`npm run smoke:live`) for SSL, route, URL, and maps checks when `GIGTOS_SMOKE_URL` is configured.
- [ ] Build a Playwright-based "Heart Monitor" script that checks whether the heart of the app is alive.
- [ ] Run the Heart Monitor:
  - hourly in test/staging
  - before every deploy
  - immediately after every preview deploy
  - immediately after every production deploy
  - manually from superadmin/engineering console when needed
- [ ] Heart Monitor must check:
  - production/staging URL opens
  - SSL/HTTPS certificate is valid
  - key pages return correct HTTP status
  - login/dev bypass works in non-production
  - consumer can create a booking
  - available workers appear within 10 km and/or service area
  - worker auto-select works
  - manual worker selection works
  - map loads without blank state
  - route/tracking UI renders
  - worker can start travel
  - live tracking state updates from worker to consumer
  - Razorpay test payment starts
  - Razorpay test payment success/failure is handled
  - webhook/mock webhook updates payment status
  - booking can move to completion
  - payout candidate is created
  - SocioScore event is created
  - score reason appears in UI
  - Copper monitoring dashboard loads
  - superadmin dashboard requires MFA/recent re-auth for sensitive actions
  - no serious console errors
  - no failed critical network requests
- [ ] Heart Monitor output must include:
  - PASS/FAIL
  - run ID
  - environment
  - URL
  - app version/commit
  - booking ID
  - payment ID
  - payout candidate ID
  - score event ID
  - screenshots
  - video trace
  - browser console logs
  - network logs
  - failed selector/action
  - likely owner
  - recommended next action
- [ ] Heart Monitor failures should create sanitized AI-readable incident summaries, not raw private data.

## AI Orchestration And AI CICD

- [ ] Build AI orchestration around cost-aware model selection. Use the cheapest model that is reliable for the step, and escalate only when needed.
- [ ] Suggested AI roles:
  - Gemini Flash: low-cost log reader, batch summarizer, duplicate incident detector, first-pass root cause.
  - Gemini Pro or stronger Google model through Vertex AI: deeper Google/Firebase/infra reasoning when Flash confidence is low.
  - Claude Sonnet: architecture brain, hard reasoning, tradeoff analysis, risky incident planning.
  - Copilot/Codex: coding agent to prepare patches.
  - QA AI: runs tests, browser checks, screenshot comparison, and smoke validation.
  - Release Manager AI: prepares release note, risk summary, rollback plan, and human approval packet.
  - Rest/Fallback AI: backup summarizer/checker if primary AI fails or confidence is low.
- [ ] AI cost controls:
  - start with deterministic rules before AI
  - summarize logs before sending to stronger models
  - batch repeated errors
  - skip duplicate incidents within a cooldown window
  - cap prompt size
  - store embeddings/RAG summaries instead of resending full docs
  - use high-cost models only for high-severity or low-confidence issues
  - track cost per incident and per model
- [ ] AI CICD flow:
  - Heart Monitor or logs detect failure
  - deterministic classifier assigns severity
  - Gemini Flash summarizes sanitized logs
  - RAG retrieves app rules, TODO, schema, runbooks, old fixes, smoke history
  - Claude/Sonnet brain reviews only when needed
  - Codex/Copilot prepares patch in branch/preview
  - QA AI runs tests and browser smoke
  - Release Manager AI writes risk summary and rollback plan
  - human approves production deploy
  - production deploy runs Heart Monitor again
- [ ] Do not allow fully automatic production deploy for payment, payout, superadmin, SOS, score/tier, or security changes. Human approval is required for production.
- [ ] AI can automate 100% up to preview deploy and evidence package creation.
- [ ] Human approval must be required for:
  - production deploy
  - payout rule change
  - score formula change
  - superadmin/security change
  - worker suspension automation
  - refund/payout execution automation
  - SOS escalation rule change
- [ ] AI should save incident learnings back into RAG memory:
  - what failed
  - root cause
  - affected module
  - fix summary
  - tests added
  - deploy result
  - rollback note
  - future prevention

## Vertex AI RAG Memory

- [ ] Build RAG system with Vertex AI so AI does not hallucinate app rules.
- [ ] RAG should include:
  - TODO
  - app feature specs
  - service catalog
  - pricing rules
  - SocioScore rules
  - tier/guild rules
  - payout rules
  - SOS rules
  - Firebase rules
  - Data Connect schema
  - smoke test history
  - old incident summaries
  - deploy logs
  - known fixes
  - terms/policies/runbooks
- [ ] RAG must store sanitized summaries, not raw private user data.
- [ ] RAG answer format should require:
  - evidence/source IDs
  - confidence
  - likely cause
  - affected files/modules
  - recommended fix
  - test plan
  - rollback plan
- [ ] If RAG has no evidence, AI must say unknown and escalate, not invent.

## Privacy-Safe Logging For AI

- [ ] AI should never read raw user private data.
- [ ] Logs sent to AI may contain:
  - correlation ID
  - booking ID
  - payment ID
  - payout ID
  - user role
  - route/page
  - city/service category
  - status code
  - error code
  - timestamp
  - sanitized stack/function name
- [ ] Logs sent to AI must not contain:
  - full name
  - full phone
  - Aadhaar
  - bank account number
  - UPI ID
  - exact address
  - exact GPS
  - raw chat/support text
  - payment secrets
  - tokens
  - private uploaded documents
- [ ] Add redaction middleware before logs reach AI/RAG.
- [ ] Add log sampling and retention rules to control cost and privacy risk.

## Superadmin MFA And Network Security

- [ ] Superadmin dashboard must require MFA before production use.
- [ ] Require recent re-auth for sensitive actions:
  - payout hold/release
  - score manual adjustment
  - tier override
  - worker suspension
  - field operator role assignment
  - production deploy approval
  - secret/config change
- [ ] Add App Check for web/app clients.
- [ ] Add Play Integrity later for Android app.
- [ ] Enforce server-side validation for booking, payment, payout, score, guild, and SOS updates.
- [ ] No secrets in frontend.
- [ ] HTTPS only, strict CORS, webhook signature verification, idempotency keys, rate limits, and audit logs.
- [ ] Protect against network bypass/fake clients by requiring trusted app checks where possible and verifying every privileged action on backend.

## Worker Bank Onboarding

- [ ] Collect worker bank details with minimum friction but maximum safety.
- [ ] Prefer provider token/fund account creation instead of storing raw bank details.
- [ ] Worker flow:
  - enter account holder name
  - bank account number
  - IFSC
  - confirm details
  - run validation/penny-drop if available
  - show masked saved account
  - allow update with re-verification
- [ ] Store only masked bank display in app-readable data.
- [ ] Full bank data or provider token must be protected and audited.
- [ ] Add worker payout setup checklist before worker can receive online payouts.

## Digital Wallet And Cash Platform-Fee Debt

- [x] Add shared digital wallet ledger helper for worker cash collections where the worker owes Gigtos platform fees.
- [x] When worker takes cash from consumer, record a negative wallet entry for the platform fee due.
- [x] Show debt restriction rule in wallet helper: if worker wallet balance crosses `-INR 100`, limit worker to one job per day.
- [ ] Discuss SocioScore impact before automation: proposed rule is `-5` per day while wallet debt remains below `-INR 100`.
- [x] Add backend contract scaffold for worker wallet due ledger entries when cash collection creates platform-fee debt.
- [x] Add worker wallet UI showing balance, cash-collected platform-fee dues, repayment action, job restriction state, and clear recovery steps.
- [ ] Add superadmin wallet view for debt, overrides, repayment proof, and abuse monitoring.
- [ ] Payment/payout implementation is excluded for now; Razorpay and bank transfer wiring remain in the payment backlog.

## SOS Safety System

- [ ] Add SOS alert for workers, especially women workers.
- [ ] SOS button should be easy to reach during active job/travel.
- [ ] On SOS:
  - capture current location
  - create SOS incident
  - alert nearby trusted workers/guild members
  - alert field operator
  - alert superadmin for severe cases
  - provide call/SMS/WhatsApp fallback later
- [ ] Nearby helper who reaches/responds properly can receive SocioScore reward after verification.
- [ ] False SOS should be reviewed carefully; do not auto-punish without context.
- [ ] Add SOS policy, audit, and abuse protection.
- [ ] Create AI-generated training video for SOS button usage, focused on helping women workers understand when to use SOS, what happens after tapping it, and how nearby trusted helpers/operator/superadmin are alerted.

## Service Launch Focus

- [x] Beginning service focus:
  - all maid/helper services first
  - instant help like quick home help
  - kitchen help
  - house cleaning
  - kitchen cleaning
  - bathroom cleaning
  - bedroom cleaning
  - total house cleaning
  - electrician
  - plumber as backend-supported/early optional if supply exists
  - selected emergency services
- [x] MVP frontend focus: all maid/helper services and electrician.
- [x] Backend should recruit/support all worker/service types from the beginning and show available services to consumers when workers exist.
- [x] Add separate worker page for each service type.
- [x] Workers should fill their own price.
- [x] App should suggest a price range by service, duration, city, and demand, but worker controls final price.
- [x] Add price range intelligence:
  - too low
  - fair
  - high
  - premium
  - demand adjusted
  - emergency adjusted
  - city/area benchmark
- [x] Show worker a suggested price band while entering price, not a forced price.
- [x] Show consumer whether a price is fair/high/premium without exposing worker strategy or shaming the worker.
- [x] Support city-wide services for rare worker categories where 10 km radius is too small.
- [ ] Prepare worker training videos for each service:
  - work process
  - checklist
  - what photos to upload
  - what tools/materials are expected
  - safety behavior
  - what not to do
  - how SocioScore is affected
- [x] Start app and worker recruiting/support in parallel. Do not wait for perfect supply everywhere.
- [x] If no workers are available in a consumer's area, show honest state: "No workers available in your area right now."
- [x] If all workers are booked, show honest state: "All nearby workers are booked today."
- [x] Use social-proof psychology only when true:
  - "Workers are joining in this area"
  - "All nearby workers are busy today"
  - "Join waitlist / notify me"
  - "Want service later this week?"
- [x] Never fake worker availability or fake demand.
- [x] Worker quality checklist per service should depend on before-work and after-work pictures in MVP.
- [x] If worker marks work complete, require completion/after-work photo before completion can progress.
- [x] After worker completion photo, collect consumer feedback/confirmation.
- [ ] AI should compare before/after pictures and produce a quality signal.
- [ ] AI photo quality signal should affect SocioScore only with guardrails:
  - combine AI score with consumer feedback
  - never apply severe penalty from AI alone
  - flag low-confidence AI result for manual/superadmin review
  - store reason code and explain score impact to worker
  - support appeal when photo is unclear or consumer context is missing

## Matching, Area, Emergency, Future Booking, Standby

- [x] Support both service-area matching and 10 km radius matching.
- [x] In metro cities, use service area plus 10 km radius together.
- [x] For common high-density services, match by area/10 km first.
- [x] For rare services, allow city-wide matching with clear travel fee and ETA.
- [x] When consumer books, show available workers within 10 km and matching service area.
- [x] Consumer should be able to:
  - manually select worker
  - use auto-select
- [x] Auto-select should consider:
  - availability today
  - distance
  - price
  - SocioScore
  - tier
  - guild standby support
  - cancellation/no-show risk
- [ ] Emergency work:
  - target worker arrival/service within 4 hours
  - charge extra emergency fee
  - show only workers who are truly available
  - use nearby/guild standby if primary worker fails
- [x] Future booking:
  - allow up to 2 weeks only
  - lock worker/time with clear cancellation rules
- [x] Recurring bookings:
  - allow weekly booking
  - allow monthly booking
  - allow same-worker preference
  - allow guild/backup-worker fallback
  - show recurring booking price and cancellation rules clearly
- [x] Give higher marketplace priority to weekly and monthly booking consumers because they improve worker stability and platform retention.
- [x] Priority for recurring consumers can include:
  - earlier access to worker slots
  - same-worker preference
  - backup guild support
  - small SocioScore bonus after successful completion
  - customer support priority for active recurring booking issues
- [x] Priority must not break emergency safety; SOS/emergency jobs still override ordinary recurring priority.
- [x] Reward recurring consumers:
  - weekly/monthly clean booking streak bonus
  - small SocioScore increase for successful recurring completion
  - optional wallet/campaign benefit when economics allow
  - no bonus for fake/repeated low-quality cycles
- [ ] Standby help:
  - if worker is suddenly sick/unavailable, ask their guild first
  - if guild cannot help, find nearby available worker
  - keep consumer informed with replacement status

## Worker-Consumer Blocking And Bad Match Memory

- [x] If a consumer gives a worker a verified 1-star rating, never auto-assign that worker to the same consumer again.
- [x] Hide that worker from the same consumer's normal selection UI unless superadmin/field operator manually overrides for a special case.
- [x] Store bad-match records:
  - consumerId
  - workerId
  - bookingId
  - rating
  - reason
  - createdAt
  - overrideAllowed
  - reviewedBy
- [x] Bad-match exclusion should affect:
  - auto-select
  - manual worker list
  - recurring booking replacement
  - emergency fallback
- [x] If the 1-star is later proven fake or reversed, allow field operator/superadmin to remove the bad-match block with audit.

## Demand Pricing Scope

- [ ] Demand pricing should be calculated at multiple scopes:
  - area/service scope for common services
  - city/service scope for rare services
  - emergency scope for urgent 4-hour jobs
- [ ] Area demand should use signals like:
  - available workers within 10 km for that service
  - open bookings in the next 4-24 hours
  - worker utilization today
  - response/acceptance rate
  - cancellation/no-show risk
- [ ] City demand should use signals like:
  - total active workers for rare service
  - city-wide booking pressure
  - travel distance/ETA
  - availability across the day
- [ ] Use area demand when enough local data exists.
- [ ] Fall back to city demand when service is rare or area sample size is too low.
- [ ] Do not let demand pricing override worker-controlled price blindly. Show suggested range and demand signal; worker final price remains worker-entered unless emergency/platform rules define otherwise.

## Strategy Scorecard And Missing Ideas

- [ ] Keep an internal strategy scorecard and update it after major planning changes.
- [ ] Current idea ratings:
  - No worker commission + subscription model: `9/10`
  - First year free for verified UC/Pivot/similar workers: `9/10`
  - SocioScore as worker reputation weapon: `9.5/10`
  - Diamond/Elite tier gate: `8.5/10`
  - Guild system with 3-6 members and standby help: `8.5/10`
  - Copper monitoring and recovery pricing: `8/10`
  - Heart Monitor E2E script: `10/10`
  - AI CICD with human production approval: `9/10`
  - Privacy-safe AI/RAG logging: `10/10`
  - Razorpay collection + 3 AM payout pipeline: `8.5/10`
  - Worker SOS and nearby helper reward: `9/10`
  - Weekly/monthly recurring bookings: `9/10`
  - Price range intelligence: `8.5/10`
  - 1-star bad-match block: `9/10`
  - Local language support: `9/10`
  - Launching with maid/helper + cleaning + plumber/electrician: `8.5/10`
- [ ] Missing high-priority ideas to add:
  - consumer repeat-retention engine
  - exact cancellation/refund policy
  - field operator SOP and incentive model
  - service checklist and proof standard per category
  - support SLA and escalation rules
  - fraud/risk scoring for consumer and worker
  - low-end Android/PWA performance budget
  - city-by-city launch playbook
  - unit economics dashboard
  - insurance/liability planning
  - trust and safety incident playbook
  - worker training/certification completion tracking
  - service guarantee wording
  - referral program with abuse controls

## Discussion Backlog - Needs Deep Dive Before Implementation

- [ ] Trust guarantee: one simple promise consumers understand.
  - example direction: verified worker, transparent price, live tracking, support/replacement path
  - decide exact wording later after refund/cancellation policy
- [ ] Supply liquidity strategy:
  - how many workers are needed before a service/area feels alive
  - what to show consumers when supply is low
  - whether to open waitlist before workers exist
  - whether to offer first-day activation bonus to workers
  - if offering activation bonus, decide if it is cash, wallet, fee waiver, or SocioScore boost
  - avoid paying workers before real jobs unless there is a clear launch campaign budget
- [ ] Worker first-day incentive discussion:
  - do we need to pay `INR 50` before first-day work?
  - my default suggestion: avoid upfront cash unless city launch needs it; prefer free subscription, Phoenix Bonus, first-job priority, and training badge
  - if cash is used, give it only after verification plus first real completed job, not just signup
- [x] Legal review checklist:
  - competitor ID proof wording and storage
  - worker safety/SOS liability
  - refund/cancellation policy
  - data privacy and logs
  - AI photo scoring impact on worker income/reputation
  - subscription terms
  - cash collection/platform fee dues
- [ ] WhatsApp support:
  - consumer support
  - worker support
  - payout failure support
  - booking issue support
  - SOS fallback
  - recurring booking reminders
  - avoid over-notification and respect consent

- [x] Exact cancellation/refund policy:
  - consumer cancellation before worker accepts
  - consumer cancellation after worker accepts
  - consumer cancellation when worker is already traveling
  - worker cancellation
  - worker no-show
  - consumer no-show/unreachable
  - bad work complaint
  - partial work
  - emergency booking cancellation
  - recurring booking cancellation
  - payout hold/refund timing
- [x] Service guarantee wording:
  - what Gigtos promises
  - what Gigtos does not promise
  - replacement worker rules
  - refund/support boundaries
  - consumer-safe language
- [x] Worker quality checklist per service:
  - before photos
  - after photos
  - mandatory proof angles
  - AI photo quality scoring
  - consumer feedback
  - appeal and manual review
  - SocioScore impact rules
- [ ] Field operator SOP and incentive model:
  - future phase only because funds are limited
  - what field operator verifies
  - dispute visit rules
  - worker onboarding checks
  - quality audit rules
  - incentive/payment model
- [ ] Insurance/liability planning:
  - worker accident
  - consumer property damage
  - theft accusation
  - women worker safety
  - emergency/SOS handling
- [ ] Unit economics dashboard:
  - booking fee revenue
  - payment gateway cost
  - payout cost
  - support cost
  - discount/campaign cost
  - subscription revenue
  - city/service profitability
- [ ] Support SLA rules:
  - payment issue
  - active job issue
  - worker SOS
  - bad work complaint
  - refund request
  - payout failure
- [ ] Fraud/risk scoring:
  - fake bookings
  - fake 1-star ratings
  - fake before/after photos
  - referral abuse
  - guild collusion
  - payout fraud
  - repeated cancellation
- [ ] Low-end Android/PWA performance budget:
  - first load
  - booking page
  - worker list
  - map/tracking
  - photo upload
  - language switching
- [ ] City-by-city launch playbook:
  - first locality
  - first 50 workers
  - first 500 consumers
  - service area boundaries
  - local language copy
  - emergency support path
- [ ] Worker training completion tracking:
  - video watched
  - checklist passed
  - quiz/confirmation
  - service-specific badge
  - SocioScore bonus for completion
- [ ] Referral program with abuse controls:
  - consumer referral
  - worker referral
  - verified worker referral from UC/Pivot-like platforms
  - same-device/payment/phone abuse checks
  - reward only after real completed job
- [ ] Guild strategy deep dive:
  - guild as worker union/community
  - how guild pulls more workers into app
  - group responsibility without unfair punishment
  - standby support
  - guild owner duties
  - guild dispute handling
  - guild score and benefit abuse controls

## Dev Bypass And Smoke Testing

- [x] Add local/dev-only bypass for repeatable end-to-end smoke tests.
- [x] Dev bypass must be disabled in production builds and protected by environment flag.
- [x] Production deploy build must fail if `REACT_APP_ENABLE_DEV_BYPASS=true`; local dev build can warn and continue.
- [ ] Remove/disable every dev bypass before production push.
- [x] Dev bypass should support roles:
  - consumer
  - worker
  - field operator
  - superadmin
- [ ] Add seeded smoke-test data:
  - consumer
  - worker
  - Diamond worker
  - Copper worker
  - guild
  - booking
  - payment mock
  - active tracking mock
- [ ] Add smoke tests for:
  - consumer booking create
  - worker accept/start/travel/complete
  - live tracking state
  - payment success mock
  - payout candidate creation
  - score event creation
  - score reason display
  - Copper monitoring
  - group join/exit
  - language switching
- [x] Add first basic booking smoke test for consumer booking -> worker assignment -> completion photo -> consumer rating -> score event.
- [x] Smoke test should produce a PASS/FAIL report that can be saved in docs.
- [x] Add built app route/asset checks to `npm run smoke:heart` for home, auth, jobs, service, my bookings, worker dashboard, superadmin, JS, and CSS.
- [x] Add dev-auth UI smoke checks for protected consumer service page and worker dashboard interactions.
- [ ] Expand `npm run smoke:heart` from local utility/build/route checks into full browser Heart Monitor with URL, SSL, maps, payment, and Firebase checks.

## Rebuild From Scratch Plan

- [ ] Create a new app architecture plan before major feature work.
- [ ] Preserve useful existing logic only after review; do not let old region lead/mason/admin assumptions drive the new app.
- [ ] New modules should be:
  - auth and roles
  - consumer booking
  - worker jobs
  - field operator console
  - superadmin console
  - SocioScore and tiers
  - guilds/groups
  - payments and payouts
  - localization
  - notifications
  - support/disputes
  - smoke-test/dev bypass
- [ ] Decide whether to keep CRA temporarily or move to a cleaner modern frontend stack during rebuild.
- [ ] Define database schema first, then implement UI around stable contracts.
- [x] MVP definition for Gigtos:
  - smallest version that can prove a real consumer can book a real worker safely
  - must include booking, worker availability, payment/cash fallback, completion photo, consumer feedback, SocioScore event, and basic support path
  - should not include every future feature before launch

## Immediate Stabilization

1. Profile extended fields and photo upload
- Add `postalCode`, `city`, `state`, and profile photo upload support.
- Primary files: `react-app/src/pages/CompleteProfilePhone.js`, `react-app/src/pages/Profile.js`.

2. Full payment/settlement pipeline UI
- Implement end-to-end client payment flow and settlement views.
- Implement shared pricing helper for the new booking fee formula so Service, MyBookings, InstantBookingModal, AdminBookings, invoices, tests, and Functions cannot drift.
- Prepare Razorpay or approved payment gateway integration: order creation, signature verification, webhook handling, idempotency, refund path, and reconciliation.

3. Worker calendar scheduling
- Add calendar board for worker availability and booking slots.
- Prevent overlaps and support rescheduling for future jobs.

4. Full manual UAT with real accounts
- Validate all role flows: consumer, worker, field operator, superadmin.
- Capture strict step-by-step PASS/FAIL execution logs.
- Include web and installable PWA/mobile-browser checks in the same UAT pass.
- Current local check on 2026-05-16: production build compiles; full Jest suite passes; heart smoke passes.
- First few days may not have manual support coverage. App must be honest, simple, and avoid risky automated promises until support is ready.

5. Premium UI polish
- [x] Global Layout: Refactor Header, App.js, and tokens.css for consistent premium app-shell quality.
- [x] Landing Page: Redesign Home.js/Home.css hero and service display.
- [x] Service marketplace: add premium all-services search/catalog with MVP/recruit status and direct booking CTA.
- [x] Functional Flows: Overhaul Service.js booking flow and MyBookings.js overview.
- [x] Profile page full premium rewrite: replace old inline layout with account readiness, saved login/phone/location, wallet, and trust controls.
- [x] Worker App: Polish worker dashboard, open work, future work, profile, support, map, history, SocioScore speedometer, and guild display.
- [x] Add dark/light-mode contrast hardening so legacy inline dashboard text remains readable in dark mode.
- [x] Field Operator App: add full verification queue, dispute queue, worker checks, and quality notes beyond the current admin/superadmin polish layer.
- [x] Add backend contract scaffolds for worker availability, worker matching/assignment candidates, live tracking, support tickets, wallet dues, and operator quality notes.
- [x] Discuss and redesign the home-page `Ask Gito` / `Nearby Workers` panel: current UI felt raw/default, prompt chips looked like browser buttons, spacing was too heavy, and the section needed a premium quick-action surface with polished chips, clearer selected state, compact mobile behavior, stronger worker-availability context, and honest non-AI wording until Gemini/Vertex is connected.
- [x] Auth page full premium rewrite: remove broken blank layout, hide normal app chrome on `/auth`, add clear consumer/worker switch, Google login, phone/email login, worker signup fields, dark/light-safe inputs, and mobile-responsive trust panel.
- [x] Service booking page full cleanup: remove old unreachable inline booking UI, replace overclaimed AI wording with honest smart matching, keep consumer details/service/timing/photo/review path clear, and harden dark/light responsive booking cards.
- [x] Fix local dev-bypass hash-route support so protected smoke-test pages like `/service?devAuth=consumer` work through GitHub Pages-style hash routing while production bypass remains blocked.

## Safety And Policy

- [x] Write plain consumer terms: booking, payment, cancellation, dispute, support, and refund boundaries.
- [x] Write worker agreement: no-commission model, subscription, accepted jobs, conduct, safety, cancellation, dispute, suspension, and appeal.
- [x] Write field-operator policy: what they can verify, what they can change, what needs superadmin.
- [x] Write SocioScore policy: what changes score, pending/finalized states, appeal, fraud checks, manual adjustment, and reset/recovery rules.
- [x] Add privacy policy: collected data, purpose, retention, who can see it, deletion/export path, and AI usage boundaries.
- [ ] Add consent records for location, notifications, analytics, optional identity verification, AI-assisted support, and marketing.

## Completed In Previous Cycle

- Worker schema fields wired (`certifications`, `bankDetails`, `totalEarnings`).
- Worker auto-pick assignment with manual override before start.
- Quote presets with editable add-on values.
- Search + filter enhancements for earlier operational role screens.
- Multi-day work day-count tracking.
- 24h delay SLA backend checks and alerts.
