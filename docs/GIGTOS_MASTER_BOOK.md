# Gigtos Master Book

Date: 2026-05-26

This book is the working training guide for Gigtos. It explains the product rules, backend contracts, and MVP marketplace logic so juniors can understand why the app behaves the way it does before they touch code.

## 1. Product North Star

Gigtos is an Indian local-services marketplace for home and daily help work. The first reliable product loop is:

1. Consumer logs in.
2. Worker registers and is approved.
3. Worker clicks `Open to Work`.
4. Consumer requests a service in an area/time.
5. Backend calculates fair demand-aware price.
6. Smart Queue finds the best eligible worker.
7. Worker accepts, starts travel/work, completes with proof.
8. Consumer confirms, pays worker directly in MVP, and gives feedback.
9. GigScore records the outcome.
10. Founder/SuperAdmin sees health, demand, issues, and failures.

The MVP is not a simple static website. It needs marketplace intelligence from day one because there are limited employees to monitor jobs manually.

## 2. MVP Required Systems

MVP required:

- Demand pricing v1
- Worker `Open to Work`
- Smart Queue v1
- Favorite worker priority
- Same-area-first worker matching
- Radius expansion up to `15 km`
- Google Maps distance/ETA
- Area intelligence dashboard v1
- SEO pages and worker landing page
- Consumer AI v1 with backend gateway, Vertex AI primary model routing, Gemini fallback, LangChain, and mem0 safe memory
- Sentry/Vertex/Heart Monitor basic orchestration with privacy-filtered frontend/backend error capture
- Worker camera-only arrival selfie
- Optional consumer before-work photo
- Required worker after-work photo where proof is needed
- Live tracking after worker clicks `On the way` or `Start travel/work`
- SuperAdmin MFA before production use

Later, not MVP:

- Razorpay consumer checkout
- Automated payout pipeline for MVP cash/direct UPI jobs
- Full multi-model release orchestration
- Auto booking without confirmation
- Multi-booking
- Advanced field-operator mobile workflows
- Full city heat-map intelligence

## 3. Core Roles

Consumer:

- Searches service.
- Chooses area/time.
- Sees price and explanation.
- Gets matched with real open workers.
- Confirms whether the correct worker arrived.
- Pays worker directly after work in MVP.
- Rates and gives feedback.

Worker:

- Registers with service, area, price, photo, phone, proof, and availability.
- Must be approved/verified before receiving work.
- Must click `Open to Work` before assignment.
- Receives suggested price from backend demand rules.
- Accepts/rejects job offers.
- Starts travel/work before exact address and live tracking are active.
- Uploads completion proof.

SuperAdmin:

- Approves workers.
- Controls city/area/service price rules.
- Sees demand and supply.
- Reviews issues, fraud, support, SOS, and pricing health.
- Can override manually with reason and audit.

Field Operator:

- Future heavier workflow.
- MVP should not depend on field operator availability.

## 4. Data Contracts

### `service_price_rules`

Purpose:

- SuperAdmin-editable pricing truth.
- Controls city/area/service prices.
- Controls worker allowed min/max.
- Controls demand thresholds and caps.

Suggested fields:

```js
{
  city: "Hyderabad",
  areaId: "kukatpally",
  areaName: "Kukatpally",
  serviceId: "bathroom_cleaning",
  serviceName: "Bathroom cleaning",
  unitType: "per_bathroom",
  currency: "INR",

  minPrice: 249,
  normalPrice: 349,
  highPrice: 399,
  peakPrice: 499,
  maxAllowedPrice: 499,

  workerMinPrice: 249,
  workerMaxPrice: 499,
  minimumWorkerThreshold: 20,
  peakUtilizationPercent: 90,

  demandMultiplierLow: 1.0,
  demandMultiplierNormal: 1.0,
  demandMultiplierHigh: 1.15,
  demandMultiplierPeak: 1.35,

  manualDemandLevel: null,
  manualOverrideReason: "",
  peakWindows: [
    { day: "saturday", start: "07:00", end: "11:00" }
  ],

  enabled: true,
  version: 1,
  updatedBy: "superadminUid",
  updatedAt: "Timestamp",
  updateReason: "MVP launch price setup"
}
```

Only SuperAdmin, through backend callable functions, should edit this.

### `area_demand_snapshots`

Purpose:

- Hourly or event-refreshed demand state.
- Prevents random pricing.
- Lets the backend explain why price changed.

Suggested fields:

```js
{
  city: "Hyderabad",
  areaId: "kukatpally",
  serviceId: "bathroom_cleaning",

  windowStart: "Timestamp",
  windowEnd: "Timestamp",
  computedAt: "Timestamp",
  expiresAt: "Timestamp",

  approvedWorkers: 35,
  openWorkers: 12,
  busyWorkers: 21,
  activePoolWorkers: 33,

  openJobs: 8,
  activeBookings: 21,
  searches: 42,
  noWorkerSearches: 9,
  cancellations: 2,

  utilizationPercent: 64,
  demandPressureScore: 72,
  demandLevel: "high",
  recommendedPrice: 399,
  confidence: "medium",
  lowSampleSize: false,
  usedManualOverride: false,

  reasonCodes: ["HIGH_SEARCH_VOLUME", "FEW_OPEN_WORKERS"],
  explanationConsumer: "High demand now. Few bathroom-cleaning workers are open nearby.",
  explanationWorker: "Demand is high in Kukatpally. Suggested current price is INR 399.",

  ruleId: "hyderabad_kukatpally_bathroom_cleaning",
  ruleVersion: 1
}
```

Snapshot rules:

- Compute every `60 minutes` for MVP.
- Refresh on major booking/open-work/search events when practical.
- Expire after about `75 minutes`.
- If stale, booking falls back to normal rule price, not fake peak pricing.

### `worker_open_sessions`

Purpose:

- Worker availability truth.
- A worker cannot receive jobs unless this session is valid.
- Prevents consumers waiting on stale or offline workers.

Suggested fields:

```js
{
  workerId: "workerUid",
  city: "Hyderabad",
  areaIds: ["kukatpally", "miyapur"],
  serviceIds: ["bathroom_cleaning", "kitchen_help"],

  status: "open",
  openSince: "Timestamp",
  expiresAt: "Timestamp",
  lastHeartbeatAt: "Timestamp",

  locationConsent: true,
  approximateLocation: {
    geohash: "...",
    latRounded: 17.49,
    lngRounded: 78.39
  },

  workerBasePrices: {
    bathroom_cleaning: 349,
    kitchen_help: 180
  },
  currentSuggestedPrices: {
    bathroom_cleaning: 399,
    kitchen_help: 200
  },
  acceptedDemandLevel: {
    bathroom_cleaning: "high",
    kitchen_help: "normal"
  },

  matchingOpenJobsCount: 3,
  matchingSearchesLastHour: 12,
  activeBookingId: null,

  createdAt: "Timestamp",
  updatedAt: "Timestamp"
}
```

Session defaults:

- Open session length: `90 minutes`.
- Heartbeat: every `2-5 minutes`.
- Auto-close when stale, busy, offline, expired, or manually closed.

### Booking Pricing Evidence

Purpose:

- Audits the exact price shown.
- Explains price to consumer, worker, SuperAdmin, and safe AI summaries.
- Prevents future disputes.

Fields stored inside booking:

```js
pricing: {
  serviceId: "bathroom_cleaning",
  city: "Hyderabad",
  areaId: "kukatpally",
  unitType: "per_bathroom",
  currency: "INR",

  workerId: "workerUid",
  workerBasePrice: 349,

  ruleId: "hyderabad_kukatpally_bathroom_cleaning",
  ruleVersion: 1,
  snapshotId: "snapshotId",
  snapshotDemandLevel: "high",

  minPrice: 249,
  normalPrice: 349,
  highPrice: 399,
  peakPrice: 499,
  maxAllowedPrice: 499,

  finalConsumerPrice: 399,
  workerReceivable: 399,
  platformFee: 0,
  launchFeeWaived: 0,

  priceSource: "demand_snapshot",
  explanation: "High demand now. Few bathroom-cleaning workers are open nearby.",
  reasonCodes: ["HIGH_SEARCH_VOLUME", "FEW_OPEN_WORKERS"],
  calculatedAt: "Timestamp"
}
```

MVP rule:

```text
finalConsumerPrice === workerReceivable
```

## 5. MVP Service Price Caps

Starter values, editable by SuperAdmin per city/area/service:

| Service | Min | Normal | High | Peak Cap |
|---|---:|---:|---:|---:|
| Maid hourly basic help | INR 150/hr | INR 180/hr | INR 220/hr | INR 250/hr |
| Kitchen utensils/basic help | INR 150/hr | INR 200/hr | INR 240/hr | INR 280/hr |
| Bedroom cleaning | INR 199/room or INR 150/hr | INR 299/room or INR 180/hr | INR 399/room or INR 220/hr | INR 449/room or INR 250/hr |
| Bathroom cleaning | INR 249/bathroom | INR 349/bathroom | INR 399/bathroom | INR 499/bathroom |
| Full house basic cleaning | INR 699 | INR 999 | INR 1499 | INR 1799 |
| Deep kitchen cleaning | INR 699 | INR 999 | INR 1499 | INR 1799 |

Electrician/plumber should stay manual/recruitable until local work complexity and supply are understood.

## 6. Demand Pricing Logic

Implementation file:

- `react-app/src/utils/mvpDemandPricing.js`

Pricing inputs:

- Service default range.
- Worker price.
- City/area/service rule.
- Time of day.
- Day of week.
- Open workers.
- Busy workers.
- Open jobs.
- Searches/no-worker searches.
- Worker utilization.
- Manual SuperAdmin demand override.
- Minimum worker threshold.
- `90%` occupied/utilized rule.

Demand levels:

| Level | Meaning | Price Behavior |
|---|---|---|
| Low | Many open workers, low demand | Worker price or lower range |
| Normal | Balanced supply/demand | Normal area/service price or worker price, whichever is higher |
| High | Fewer open workers, more demand, strong time/day pattern | High price within cap |
| Peak | Minimum worker threshold met and `90%` utilization rule active | Peak price within cap |

Peak rule:

```text
activePoolWorkers = openWorkers + busyWorkers
utilizationPercent = busyWorkers / activePoolWorkers * 100

Peak may activate only if:
activePoolWorkers >= minimumWorkerThreshold
AND utilizationPercent >= 90
```

Low sample rule:

- If only one or two workers are available, do not fake peak automatically.
- Use normal/high cautiously.
- Show SuperAdmin low-sample warning.
- Consumer should not see confusing internal warnings.

Snapshot freshness rule:

- Pricing can use a snapshot only when it is not expired.
- Missing/stale snapshot means the booking quote falls back to normal area price.
- Missing/stale snapshot also returns a refresh signal so Firebase can update the area/service state.
- Low sample size blocks fake peak pricing even when utilization is technically `100%`.

Event-driven refresh rule:

- Refresh demand state on worker open/close, worker busy/available, booking requested, booking accepted, booking completed, booking cancelled, consumer search, no-worker search, and manual override save.
- Manual override refresh is immediate priority.
- Stale snapshot refresh is high priority.
- Normal marketplace events are normal priority and can be batched shortly.

GCP Pub/Sub load-control rule:

- Demand refresh events should publish to Pub/Sub topic `gigtos-demand-refresh-v1`.
- Pub/Sub message aggregation key is `city + areaId + serviceId`.
- Backend consumer should write/merge `demand_refresh_queue/{dedupeKey}` before recomputing Firestore snapshots.
- The queue doc prevents duplicate Pub/Sub deliveries or rapid repeated searches from causing unlimited Firestore writes.
- Manual override uses `0s` debounce because founder control must take effect immediately.
- High-priority marketplace events use about `30s` debounce: booking requested, booking accepted, no-worker search, worker open/close, worker busy/available.
- Normal search/noise events use about `120s` debounce.
- Snapshot recompute should write one `area_demand_snapshots` document per service/area/window, not one document per user click.
- Pub/Sub payload must not contain exact address, phone, private chat, payment details, or raw user PII.

Webhook/event-callback speed rule:

- Use webhook-style callbacks or realtime event listeners to make the UI reflect important state quickly.
- Webhooks/callbacks are for lightweight state reflection, not heavy recomputation.
- Good callback events: quote created, price lock updated, worker open/closed, worker offer sent/accepted/expired, booking status changed, support issue opened, health incident detected, and later payment/payout events.
- External webhooks must be signed/verified, idempotent by event ID, rate-limited, and privacy-safe.
- Internal callbacks should update the smallest needed status document and enqueue heavy recomputation through Pub/Sub.
- This gives fast UI without hammering Firestore or recalculating demand on every click.

Pure pricing engine:

`calculateMvpDemandPrice()` must stay deterministic. It should not call AI, Maps, Firestore, or payment systems directly.

Output must include:

- `finalConsumerPrice`
- `workerReceivable`
- `demandLevel`
- `priceSource`
- `reasonCodes`
- `explanationConsumer`
- `explanationWorker`
- `priceLockedUntil`
- rule and snapshot evidence
- snapshot refresh signal

MVP invariant:

- `finalConsumerPrice` must equal `workerReceivable`.
- No hidden platform fee in MVP.
- Worker price above max is blocked.
- Worker price below minimum is raised to the local minimum with reason.

## 7. Smart Queue v1

Smart Queue chooses which worker gets the job offer first.

Eligibility first:

- Worker is approved/verified.
- Worker clicked `Open to Work`.
- Open session is not expired.
- Worker matches service.
- Worker matches area or radius expansion.
- Worker has valid price.
- Worker has no active safety block.
- Worker is not already busy.
- Worker is not blocked for this consumer by bad-match memory.

Search order:

1. Same-area workers first.
2. If not enough safe/open same-area workers, expand radius gradually.
3. Radius expansion limit: `15 km`.
4. Distance and ETA are calculated through Google Maps where available.
5. Do not hold consumer on unavailable workers.

Suggested expansion:

```text
same area
0-3 km
3-5 km
5-10 km
10-15 km
```

If no worker exists after `15 km`, show honest unavailable state and `Notify Me`.

## 8. Queue Score Breakdown

The score breakdown is not a consumer-facing promise. It is backend evidence stored on `smart_queue_offers` so engineers and SuperAdmin can understand why a worker was ranked.

Example:

```js
scoreBreakdown: {
  gigScore: 780,
  favoriteBoost: 20,
  sameAreaBoost: 40,
  distanceScore: 85,
  priceFitScore: 70,
  responseSpeedScore: 90,
  cancellationPenalty: 0,
  skipPenalty: -2,
  finalRankScore: 1083
}
```

Suggested calculation:

```text
finalRankScore =
  gigScore
  + favoriteBoost
  + sameAreaBoost
  + distanceScore
  + priceFitScore
  + responseSpeedScore
  - cancellationPenalty
  - skipPenalty
  - safetyPenalty
```

Recommended weights:

- `gigScore`: use worker actual GigScore, such as `780`.
- `favoriteBoost`: `+20` if consumer marked worker favorite and no safety block exists.
- `sameAreaBoost`: `+40` if worker is in exact same service area/locality.
- `distanceScore`: `0-100`, higher when closer/faster ETA.
- `priceFitScore`: `0-100`, higher when worker price is near fair range and not too high.
- `responseSpeedScore`: `0-100`, based on recent accept response speed.
- `cancellationPenalty`: subtract for repeated accepted-job cancellations/no-shows.
- `skipPenalty`: small ranking penalty for repeated safe-job skips.
- `safetyPenalty`: hard block or large penalty only when rules require it.

Important:

- GigScore stays first because trust is the main marketplace weapon.
- Favorite worker helps, but does not beat safety, approval, service match, serious bad-match memory, or severe GigScore risk.
- Same-area helps strongly because it improves ETA and reduces cancellations.
- Price fit matters, but price should not beat trust.

## 9. Worker Skip Penalty

Skipping is not the same as fraud. A worker may skip for good reasons.

No penalty when:

- Job is outside selected area.
- Job is beyond allowed radius.
- Worker is already busy.
- Offer expired before worker saw it.
- Service type is wrong.
- Safety concern exists.
- App/network issue is suspected.

Small penalty when:

- Worker repeatedly skips safe, matching, fair-price jobs while open.
- Worker ignores multiple offers during an active open session.
- Worker opens availability but repeatedly refuses similar jobs without reason.

Suggested MVP effect:

- Per confirmed safe skip: `-0.5` GigScore or a separate skip counter first.
- Prefer starting with a hidden reliability counter before visible GigScore deduction.
- Apply visible deduction only after repeated pattern, for example 3 safe skips in one open session or 5 safe skips in 7 days.
- Always log reason and evidence.

Recommended fields:

```js
{
  workerId: "workerUid",
  bookingId: "bookingId",
  offerId: "offerId",
  skippedAt: "Timestamp",
  skipReason: "no_response",
  eligibleForPenalty: true,
  penaltyPoints: 0.5,
  evidence: {
    sameArea: true,
    withinRadiusKm: 2.4,
    serviceMatched: true,
    workerWasOpen: true,
    offerVisibleSeconds: 90
  }
}
```

## 10. Smart Queue Offer Contract

Purpose:

- Track who was offered a job.
- Track TTL.
- Move to next worker cleanly.
- Debug ranking decisions.

Fields:

```js
{
  bookingId: "bookingId",
  workerId: "workerUid",
  rank: 1,
  scoreBreakdown: {
    gigScore: 780,
    favoriteBoost: 20,
    sameAreaBoost: 40,
    distanceScore: 85,
    priceFitScore: 70,
    responseSpeedScore: 90,
    cancellationPenalty: 0,
    skipPenalty: -2,
    finalRankScore: 1083
  },
  status: "offered",
  offeredAt: "Timestamp",
  expiresAt: "Timestamp",
  respondedAt: null,
  skipReason: null,
  queueVersion: 1
}
```

Offer TTL:

- MVP default: `90 seconds`.
- Accept within TTL to lock worker.
- If expired, queue offers next eligible worker.

## 11. Proof, Identity, And Tracking

Consumer before photo:

- Optional during booking.
- Helpful for problem explanation.
- Must be stored securely.

Worker before photo:

- Optional/required depending on service.
- Useful when quality comparison is needed.

Worker after photo:

- Required before completion can progress for proof-based services.

Worker arrival identity selfie:

- Camera capture only.
- No gallery upload.
- Used so consumer can confirm correct worker arrived.

Consumer correct-worker check:

- Ask after worker reaches location.
- Options: yes, no, skipped.
- If no, create support/issue review.

Live tracking:

- Starts only after worker clicks `On the way` or `Start travel/work`.
- Exact consumer address is shown only after accepted booking and start-travel/work.
- Track ETA, last location, route status, and heartbeat.
- Live map location is not demand pricing data. It must feel near-real-time, ideally milliseconds to a few seconds, because slow map updates can make the worker miss location or make the consumer lose trust.
- Do not route active live tracking through the demand-pricing Pub/Sub debounce path.
- Use a low-latency active-job location channel only while the worker is traveling/working.
- Location cadence should adapt to movement, battery, and network: faster while moving, slower when stationary, stopped after job close or timeout.
- Consumer map must show last update age and stale-location warning when the worker coordinate is old.
- Use realtime callbacks/listeners where needed so worker movement, ETA state, arrival, and stale-location warnings reflect quickly in UI.

Timeout rules:

- Warn at `1.5x` expected ETA.
- Escalate/review at `2x`.
- At `2.5x` with stale heartbeat/no response, stop live sharing, notify consumer, mark `travel_timeout_review` or no-show candidate.
- Do not harshly punish automatically for GPS/network glitches.

## 12. Consumer AI v1

Allowed:

- Service suggestion.
- Price explanation.
- Availability explanation.
- Booking guidance.
- Support triage.
- Safe memory lookup after consent.

Not allowed:

- Final price decision.
- Worker ranking override.
- Booking without explicit confirmation.
- Payment/refund action.
- GigScore changes.
- Reading raw private user data.

Architecture:

- Backend AI gateway only.
- Vertex AI primary model gateway for response generation, with Gemini API-key fallback only during migration.
- LangChain for allowed tool routing.
- mem0 for safe preferences/summaries.
- No frontend secret keys.
- MVP implementation uses deterministic backend tool-intent routing and Firestore summary-only memory first, then can swap the internals to external LangChain/mem0/Vertex without changing frontend trust boundaries.

## 13. SuperAdmin Controls

SuperAdmin must be able to search and edit:

- City.
- Area/locality.
- Service.
- Min price.
- Normal price.
- High price.
- Peak cap.
- Worker min/max price.
- Minimum worker threshold.
- Peak windows.
- Demand multiplier.
- Manual demand level.
- Rule enabled/disabled.

Every change needs:

- Reason.
- Old value.
- New value.
- Updated by.
- Updated at.
- Version increment.
- Audit log.

## 14. Smoke Tests Needed

Pricing tests:

- Low demand uses worker/normal price.
- Normal demand uses normal area price.
- High demand uses high price within cap.
- Peak demand uses `90%` rule only when worker threshold is met.
- Low sample size blocks fake peak.
- Stale snapshot falls back safely.
- Worker below min is corrected/guided.
- Worker above cap is blocked or requires SuperAdmin override.

Queue tests:

- Same-area worker ranks before radius worker when safe.
- Radius expands up to `15 km`.
- Favorite boost works only when safe.
- GigScore outranks cheaper but lower-trust workers when rules say so.
- Expired open session is excluded.
- Worker skip creates offer log and tiny/reviewed penalty only when eligible.

Tracking/proof tests:

- Exact address hidden before start travel/work.
- Live tracking starts only after worker action.
- Arrival selfie requires camera capture.
- Consumer wrong-worker answer creates review.
- `2.5x` travel timeout creates review, not silent completion.

## 15. Junior Engineer Rule

When adding or changing any job, pricing, queue, AI, or tracking logic, ask:

1. Is this backend-rule controlled?
2. Is it explainable to consumer/worker?
3. Is SuperAdmin able to configure it without code?
4. Is private data excluded from AI/log summaries?
5. Does it protect worker dignity?
6. Does it protect consumer trust?
7. Does it avoid fake availability?
8. Does it have a smoke test?

If the answer is no, pause and fix the design first.

## 16. GigScore Motivation Rules

GigScore must grow slowly enough to stay trustworthy, but new approved workers need early motivation. The recommended MVP model is Fast Start growth until `590`, then normal scoring.

### Fast Start For New Workers

Purpose:

- Motivate new workers quickly.
- Help good workers see progress toward Silver.
- Avoid letting new accounts jump to Gold/Diamond too early.

Rules:

- Start score: `450`.
- Profile/photo/basic onboarding can move worker to `500`.
- Fast Start zone: `450` to `590`.
- Fast Start applies only to approved/verified workers.
- Fast Start stops at `590`.
- After `590`, normal GigScore logic applies.
- Fast Start cannot bypass anti-farming, review holds, daily caps, or monthly caps.

Suggested Fast Start deltas:

| Action | Normal | Fast Start |
|---|---:|---:|
| Clean completion | `+3` | `+8` |
| 5-star job | `+8` | `+15` |
| 4-star job | `+4` | `+8` |
| Completion photo | `+2` or review-based | `+4` |
| On-time arrival/work | `+3` | `+5` |

Caps:

- Fast Start event must be clipped so score never crosses `590` from Fast Start bonus.
- Daily positive cap remains `+40`.
- Monthly positive cap remains `+160`.
- Same consumer-worker anti-farming still applies.
- Suspicious/tiny/fake jobs, unresolved disputes, wrong-worker arrival, reused photos, or manual review holds must not receive Fast Start boost.

Consumer display:

- Do not show "boosted new worker score".
- Show only actual tier, verified signals, review count, and safety/trust labels.

### Diamond Worker Benefits

Diamond worker benefits should create aspiration without hurting consumer trust.

Recommended MVP rule:

- Diamond workers have no platform fee on eligible jobs when platform fees return.
- During MVP, platform fee is already `INR 0`, so display this as a future/active waived benefit carefully.
- Diamond workers can receive a `+10%` trusted-service price increase on future eligible jobs.
- The `+10%` increase should be SuperAdmin-configurable and worker-visible before applying.
- Price increase applies only to future unaccepted jobs.
- Never change price after booking confirmation or work start.
- Price increase must respect service/area peak caps and price-lock rules.
- Consumer copy should say: "Diamond worker. Trusted-service price."
- Monthly positive GigScore cap still applies; Diamond price benefit must not create uncapped score growth.

### Positive Growth Caps

Default caps:

- Daily positive cap: `+40`.
- Monthly positive cap: `+160`.
- Monthly tip positive cap: `+40`.

Negative fraud, safety, dispute, no-show, and verified complaint penalties should not be capped away.

## 17. Step 1 Implementation Status

Status: complete for the shared contract layer.

Implemented in `react-app/src/utils/backendContracts.js`:

- Collection constants for `service_price_rules`, `area_demand_snapshots`, `worker_open_sessions`, and `smart_queue_offers`.
- `buildAreaId()` as the first canonical area ID source, using city + area name such as `hyderabad_kukatpally`.
- `buildServicePriceRule()` for SuperAdmin-editable service caps, price ladder validation, worker min/max guardrails, manual demand level, and audit metadata.
- `buildAreaDemandSnapshot()` for hourly area/service demand state, active pool derivation, utilization percentage, confidence, expiry, and explanation fields.
- `buildWorkerOpenSession()` for worker `Open to Work` availability, heartbeat, expiry, area/service coverage, location consent, and current suggested price context.
- `buildBookingPricingEvidence()` for booking-level price audit where MVP consumer price must equal worker receivable.
- `buildSmartQueueOffer()` for worker offer TTL, rank, status, and transparent score breakdown.

Smoke status:

- Contract tests passed.
- Booking smoke passed.
- Heart monitor smoke passed.
- Production build and built-route checks passed.
- Dev-auth UI smoke passed.

What this step does not do yet:

- It does not calculate final demand price in live booking flow.
- It does not write these contracts to Firestore.
- It does not expose SuperAdmin edit screens.
- It does not run Smart Queue assignment.
- It does not call Google Maps for distance or ETA.

Next implementation step:

- Step 2 should build deterministic backend pricing logic using these contracts: select rule, load valid snapshot, classify demand, clamp worker price inside caps, apply price lock, and return clear consumer/worker explanation text.

## 18. Step 2 Implementation Status

Status: complete for the pure pricing engine and update-state guard.

Implemented in `react-app/src/utils/mvpDemandPricing.js`:

- `calculateMvpDemandPrice()` for deterministic MVP pricing.
- `evaluateDemandSnapshotState()` to mark snapshots as fresh, stale, missing, or low sample.
- `shouldRefreshDemandSnapshot()` to signal when Firebase should update demand state from marketplace events.
- `buildDemandRefreshPubSubMessage()` to create Pub/Sub-ready, privacy-safe refresh messages with aggregation key, dedupe key, priority, and debounce.
- `resolveDemandLevel()` to apply manual override, stale fallback, low-sample peak blocking, and confirmed `90%` peak logic.

Pricing rules now enforced:

- Stale/missing snapshot falls back to normal price with low confidence.
- Low sample size cannot create fake peak pricing.
- Peak requires configured minimum worker threshold and configured utilization threshold.
- Worker price below local minimum is raised with an explanation.
- Worker price above max guardrail is blocked.
- SuperAdmin manual override can raise demand, but only with a clear audit reason and cannot break max cap.
- Manual override hierarchy is `disabled_rule > worker_price_cap > superadmin_manual_demand_with_reason > fresh_snapshot > safe_normal_fallback > max_price_cap`.
- Consumer price and worker receivable remain equal in MVP.

Update-state rule:

- Demand snapshots must refresh on booking/search/open-work/worker-state/manual-override events.
- Refresh must go through GCP Pub/Sub topic `gigtos-demand-refresh-v1` to prevent direct Firestore write storms.
- Duplicate/rapid events should merge through `demand_refresh_queue/{dedupeKey}` using aggregation key `city + areaId + serviceId`.
- This is still a pure message contract today; the next backend step must wire it to Firestore scheduled jobs, event triggers, and a Pub/Sub subscriber.

Tests passed:

- Low demand pricing.
- Normal demand pricing.
- High demand pricing.
- Peak demand with `90%` and minimum pool.
- Stale snapshot fallback.
- Low-sample fake peak block.
- Worker below min.
- Worker above max.
- Manual override with cap.
- Demand refresh signaling.
- Pub/Sub refresh message aggregation, dedupe, debounce, and immediate manual override behavior.

What this step does not do yet:

- It does not write refreshed snapshots to Firestore.
- It does not expose a Firebase callable.
- It does not connect live booking UI to the new price quote.
- It does not show SuperAdmin demand controls.
- It does not integrate Smart Queue worker assignment.

Next implementation step:

- Step 3 should wrap the pure engine in Firebase/backend orchestration: load rule, load latest valid snapshot, compute quote, write pricing evidence, publish refresh requests to Pub/Sub, merge `demand_refresh_queue` dedupe docs, and recompute demand snapshots safely.

## 19. Step 3 Implementation Status

Status: complete for backend orchestration foundation, indexes, and Firestore security rules.

Implemented:

- `firestore.indexes.json` for price rules, demand snapshots, worker open sessions, locked quotes, Smart Queue offers, and demand refresh queue.
- `firebase.json` now deploys Firestore indexes with rules.
- Firestore rules explicitly protect:
  - `service_price_rules`
  - `area_demand_snapshots`
  - `worker_open_sessions`
  - `price_quotes`
  - `smart_queue_offers`
  - `demand_refresh_queue`
- `functions/index.js` exports `getMvpDemandQuote`.
- `functions/index.js` exports `processDemandRefreshQueue`.
- `functions/package.json` includes `@google-cloud/pubsub`.
- `worker_open_sessions` contract includes `areaServiceKeys` so backend can query `areaId + serviceId` cheaply.

`getMvpDemandQuote` does:

- Verifies auth and App Check.
- Rate-limits quote requests.
- Validates service, city, area, worker, optional booking ID, and quantity.
- Requires worker to be approved/verified and active.
- Requires a fresh worker `Open to Work` session for the requested area/service.
- Loads `service_price_rules/{areaId_serviceId}`.
- Loads latest `area_demand_snapshots` for city/area/service.
- Computes backend-authoritative MVP price.
- Saves `price_quotes/{quoteId}` with lock/evidence.
- Enqueues demand refresh in `demand_refresh_queue`.
- Publishes Pub/Sub message to `gigtos-demand-refresh-v1`.
- Returns only safe quote fields to the frontend.

`processDemandRefreshQueue` does:

- Receives Pub/Sub refresh event.
- Marks dedupe queue document as processing.
- Counts active open sessions for the area/service.
- Counts active matching bookings where future booking documents include `areaId` and `serviceId`.
- Computes open workers, busy workers, active pool, utilization, low sample state, demand level, and recommended price.
- Writes one `area_demand_snapshots` document for the current area/service/window.
- Marks queue item completed.

Security rules now enforce:

- Consumers/workers cannot write final prices.
- Consumers/workers cannot write demand snapshots.
- Consumers/workers cannot write queue offers.
- Workers cannot directly create/update `worker_open_sessions`.
- Consumers/workers can read only their own locked quote.
- Workers can read only their own open session and queue offer.
- Admins can inspect price/demand internals.
- `demand_refresh_queue` is backend-only.

Tests passed:

- Cloud Functions syntax check.
- Pricing contracts and deterministic pricing tests.
- Firebase rules unit tests, including backend-owned pricing/queue collections.

What this step does not do yet:

- Step 4 now wires the consumer booking UI to `getMvpDemandQuote`.
- SuperAdmin price-rule editor/manual override UI is not wired yet.
- Smart Queue assignment is not implemented yet.
- Existing booking documents may need `areaId` and `serviceId` fields populated for demand snapshot recompute to count active jobs correctly.
- Live map tracking remains separate from demand pricing.

Next implementation step:

- Step 4 should wire the consumer booking UI to backend locked quotes, then Step 5 can build Smart Queue assignment using those locked quotes.

## 20. Step 4 Implementation Status

Status: complete for consumer booking UI quote locking.

Implemented:

- `react-app/src/utils/mvpQuoteClient.js`:
  - maps current catalog services to backend MVP service IDs
  - derives `city`, `areaName`, and canonical `areaId`
  - calls Firebase callable `getMvpDemandQuote`
  - checks quote expiry before submit
- `react-app/src/pages/Service.js`:
  - requests a backend quote before opening the confirmation modal
  - blocks booking submit if `quoteId` is missing or expired
  - stores `priceQuoteId`, `quoteId`, `quoteStatus`, `serviceId`, `city`, and `areaId` on booking payload
  - shows locked consumer price, worker receivable, demand explanation, and price-lock time
  - keeps static frontend range as guidance only
- `functions/index.js`:
  - `getMvpDemandQuote` can find an eligible `worker_open_sessions` document by `areaId + serviceId` when the UI has not selected a worker yet

Tests passed:

- Quote helper tests.
- Dev-auth UI smoke confirms locked price and worker receivable copy appear before confirmation.
- Full React test suite.
- Firebase rules tests.

Important production requirements:

- `service_price_rules` must be seeded before real users can get backend quotes.
- `worker_open_sessions` must be created by backend callables before quote requests.
- Approved active workers must have valid base/suggested prices for the service.
- The deployed Functions/App Check setup must be active for `getMvpDemandQuote`.

What this step does not do yet:

- It does not assign the worker.
- It does not create Smart Queue offers.
- It does not let SuperAdmin edit price rules in UI.
- It does not verify the quote during final booking creation through a booking callable; current client booking stores the quote ID for backend/ops verification.

Next implementation step:

- Step 5 should build backend Smart Queue assignment using the locked quote, open sessions, same-area-first matching, offer TTL, and worker concurrency lock.

## 21. Step 5 Implementation Status

Status: complete for backend same-area Smart Queue assignment.

Implemented:

- `functions/index.js`:
  - `startSmartQueueForBooking` verifies the booking owner/admin, checks that the booking is linked to the locked quote, blocks quote reuse across bookings, writes `booking_assignment_states`, links quote to booking, and starts worker matching
  - `offerNextSmartQueueWorker` loads same-area eligible Open-to-Work sessions using `areaServiceKeys`, filters out unapproved/inactive/safety-blocked/busy workers, ranks candidates, creates one active offer, and locks the worker session
  - `respondToSmartQueueOffer` lets the offered worker accept or reject; accept assigns the booking and marks the quote used, while reject releases the worker and advances the queue
  - `expireSmartQueueOffers` runs every minute, marks stale offers as `expired` with `responseType: no_response`, releases the worker session lock, and continues to the next candidate
- `react-app/src/utils/mvpQuoteClient.js`:
  - adds `startSmartQueueForBooking()` callable wrapper
- `react-app/src/pages/Service.js`:
  - after creating a booking, calls `startSmartQueueForBooking` with the locked quote
  - success copy now reflects Smart Queue matching
- `firestore.indexes.json`:
  - adds offer-expiry and assignment-state indexes
- `firebase.rules`:
  - adds scoped read-only access for `booking_assignment_states`
  - clients still cannot write queue internals
- `react-app/src/utils/backendContracts.js`:
  - includes `booking_assignment_states`
  - allows temporary Open-to-Work session status `offered`

Smart Queue v1 behavior now:

- Same-area workers are searched first.
- Eligibility requires approved/verified active worker, valid open session, matching service/area, no safety block, and no active booking/offer lock.
- Ranking evidence stores GigScore, favorite boost, same-area boost, distance placeholder, price fit, response speed, cancellation penalty, skip penalty, safety penalty, and final score.
- Offers are one-at-a-time with a `90s` TTL.
- Consumer assignment state is honest: `searching`, `offered`, `assigned`, `no_worker`, or `quote_expired`.
- Explicit reject and no-response expiry are separate.

Tests passed:

- Cloud Functions syntax check.
- Focused React tests for backend contracts, pricing, quote client, and dev-auth UI.
- Firebase rules unit tests.
- Full React test suite.
- Booking smoke.
- Heart Monitor live/staging smoke with `GIGTOS_SMOKE_URL` set.

What this step does not do yet:

- Radius expansion up to `15 km`.
- Google Maps distance/ETA ranking.
- Worker offer notification/UI.
- Consumer live matching UI for `booking_assignment_states`.
- Notify Me/Book Later UI after no-worker timeout.
- SuperAdmin Smart Queue monitor.
- Exact skip-score deduction thresholds.

Next implementation step:

- Step 6 should build the worker Open-to-Work/offer response UI and then connect consumer My Bookings to `booking_assignment_states`.

## 22. Step 6A Implementation Status

Status: complete for Smart Queue offer visibility and response UI.

Implemented:

- `functions/index.js`:
  - Smart Queue offers now include safe display fields for the worker: consumer price, worker receivable, demand level, and worker explanation
- `react-app/src/pages/worker/WorkerDashboard.js`:
  - listens to active `smart_queue_offers` where the logged-in worker is the offered worker
  - shows a Smart Queue offer panel with service, area/city, receivable amount, demand label, and expiry time
  - lets worker accept or skip using `respondToSmartQueueOffer`
  - includes a dev-auth mock offer path for smoke testing
- `react-app/src/pages/MyBookings.js`:
  - listens to `booking_assignment_states` for the consumer
  - shows honest matching state on the booking card: finding worker, offer sent, no worker, or expired quote
  - recognizes booking status `matching`
- `react-app/src/styles/worker-dashboard.css` and `react-app/src/pages/MyBookings.css`:
  - add compact queue panels that fit existing dashboard/card patterns
- `react-app/src/__tests__/devAuthUiSmoke.test.js`:
  - verifies worker dashboard shows Smart Queue offers in dev smoke

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth and booking smoke tests.
- Full React test suite.
- Booking smoke.

What this step does not do yet:

- Backend callable for workers to create/update `worker_open_sessions`.
- Worker price guardrails before opening work.
- Push notification / FCM for offers.
- Notify Me and Book Later UI after no worker.
- Google Maps ETA and radius expansion.
- SuperAdmin queue monitor.

Next implementation step:

- Step 6B should replace the legacy Open-to-Work availability write with backend-owned `worker_open_sessions` callables and price guardrails.

## 23. Step 6B Implementation Status

Status: complete for backend-owned Open-to-Work session creation/close with price guardrails.

Implemented:

- `functions/index.js`:
  - `updateWorkerOpenSession` callable supports `open`, `heartbeat`, and `close`
  - verifies auth and rate limits worker session changes
  - requires the worker to be approved/verified, active, and not safety-blocked
  - reads worker profile from `worker_auth` and `gig_workers`
  - normalizes launch service IDs such as home helper, kitchen help, bathroom cleaning, and full house cleaning
  - validates every `areaId + serviceId` pair against `service_price_rules`
  - blocks worker price above the area/service cap
  - raises worker price below the configured minimum and records a guard reason
  - writes a single current session at `worker_open_sessions/{workerId}`
  - stores `areaServiceKeys` for cheap queue matching
  - stores worker requested prices, adjusted base prices, suggested prices, price rule IDs, session timing, location consent, and optional coordinates
  - enqueues demand refresh events when workers open or close
  - prevents a worker from closing the session while an active offer is waiting; they must accept or skip first
- `react-app/src/components/worker/ActiveStatusButton.js`:
  - replaces local-only 12-hour active state with backend `updateWorkerOpenSession`
  - uses `90 minutes` for Open-to-Work
  - derives city, areaId, service IDs, and worker base prices from worker profile data
  - keeps dev-auth mode safe with a local mock session
- `react-app/src/pages/worker/WorkerDashboard.js`:
  - passes worker profile/dev mode into `ActiveStatusButton`
- `react-app/src/styles/worker-dashboard.css`:
  - adds a compact Open-to-Work active session display

Tests passed:

- Cloud Functions syntax check.
- Full React test suite.
- Firebase rules unit tests.

Important production requirements:

- `service_price_rules/{areaId_serviceId}` must exist before a real worker can open work for that area/service.
- Worker profiles need usable city/area/service/price fields, or the callable will block opening work.
- The UI heartbeat path exists in the callable but still needs a recurring frontend timer if the app should extend the session while the worker stays online.

What this step does not do yet:

- SuperAdmin seed/editor UI for missing service price rules.
- Rich worker price editor before opening work.
- Recurring heartbeat timer in the worker UI.
- Push notification when an offer arrives.
- Open-session stale cleanup scheduler beyond expiry filtering.

Next implementation step:

- Step 6C should add worker price/open-session polish: show selected service/area/price before opening, add heartbeat refresh, and give clean guidance when a price rule is missing.

## 24. Step 6C Implementation Status

Status: complete for worker-facing Open-to-Work session polish.

Implemented:

- `react-app/src/components/worker/ActiveStatusButton.js`:
  - shows an Open-to-Work setup preview before the worker opens work
  - preview includes city, area IDs, service IDs converted to readable labels, and worker base price by service
  - lets the worker edit per-service prices before opening work
  - requires a backend price-rule preview before opening work in production UI, and clears that preview when the worker edits price
  - shows allowed min/max plus normal, high, and peak suggested prices returned by backend guardrails
  - shows matching open jobs, active bookings, and open workers from the latest demand snapshot
  - explains that backend min/cap rules are checked before the worker is shown to consumers
  - calls backend heartbeat every `4 minutes` while active
  - refreshes local session timer after successful heartbeat
  - active state now shows session time remaining and last heartbeat refresh time
  - displays backend suggested prices after opening when the callable returns them
  - gives clearer worker-facing errors for missing price rules, disabled/mismatched rules, above-cap price, and inactive/unapproved accounts
- `functions/index.js`:
  - extends `updateWorkerOpenSession` with a `preview` action that validates the same city/area/service price rules without writing an open session
  - returns requested price, adjusted price, suggested prices, guardrail details, price rule IDs, and demand-snapshot context
  - still revalidates all guardrails during the real `open` action, so a modified browser cannot bypass caps
- `react-app/src/styles/worker-dashboard.css`:
  - adds compact Open-to-Work preview, editable price, and demand-context styling that fits worker dashboard cards
- `react-app/src/__tests__/devAuthUiSmoke.test.js`:
  - verifies the worker dashboard shows the Open-to-Work setup, price guardrail editor, rule-check action, and `Open to Work (90 min)` action

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth smoke.
- Full React test suite.
- Booking smoke.
- Firebase rules unit tests.

What this step does not do yet:

- Push notification when offers arrive.
- Stale-session cleanup scheduler beyond query expiry filtering.

Next implementation step:

- Step 7 should start SuperAdmin price-rule seed/editor UI, because real workers cannot open work cleanly until every MVP area/service has a valid rule.

## 25. Step 7 Implementation Status

Status: complete for SuperAdmin MVP service price-rule seed/editor v1.

Implemented:

- `functions/index.js`:
  - defines backend MVP starter rules for maid hourly, kitchen help, bedroom cleaning, bathroom cleaning, full house basic cleaning, and deep kitchen cleaning
  - adds `save_service_price_rule` to `superadminAction`
  - adds `seed_mvp_price_rules` to `superadminAction`
  - validates every price ladder as `min <= normal <= high <= peak <= max`
  - validates worker min/max guardrails inside service caps
  - supports manual demand level, manual override audit reason, enabled/disabled state, minimum worker threshold, peak utilization threshold, versioning, updatedBy, updatedAt, and update reason
  - requires MFA/recent-auth protection for price-rule seed/edit actions
  - writes SuperAdmin audit events
  - enqueues immediate demand refresh after rule seed/edit so snapshots can update without client-owned writes
- `react-app/src/pages/SuperAdmin.js`:
  - shows an MVP Service Price Rules panel in the pricing tab
  - lets SuperAdmin seed all MVP starter service rules for a city/area
  - lets SuperAdmin edit one service rule at a time
  - lets SuperAdmin set min, normal, high, peak, max cap, worker min, worker max, minimum worker threshold, peak utilization percent, manual demand, audit reason, and enabled state
  - loads existing rules from Firestore and lets SuperAdmin click a rule to edit it
  - uses shared MVP service presets and `buildAreaId()` so area naming stays closer to the backend contract
- `react-app/src/pages/SuperAdmin.css`:
  - adds compact responsive styling for the price-rule editor and rule list

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth UI smoke.
- Full React test suite.
- Firebase rules unit tests.
- Heart Monitor live/staging smoke with `GIGTOS_SMOKE_URL` set.

What this step does not do yet:

- Rich search/filter by city, area, and service in the price-rule list.
- Impact preview before saving a rule.
- Optional day/time windows for price rules.
- Area Intelligence v1 dashboard for price-rule health, stale snapshots, supply gaps, and no-worker searches.

Next implementation step:

- Step 8 should build Area Intelligence v1 for SuperAdmin. The founder needs to see open workers, busy workers, active jobs, searches, no-worker searches, stale demand snapshots, current demand level, and rule health before manually changing prices.

## 26. Step 8 Implementation Status

Status: complete for Area Intelligence v1 dashboard.

Implemented:

- `react-app/src/pages/SuperAdmin.js`:
  - listens to `area_demand_snapshots` ordered by latest computation
  - combines the latest snapshot with each `service_price_rules` row
  - derives health states: `healthy`, `supply_gap`, `stale_snapshot`, `missing_snapshot`, and `disabled`
  - shows total rules, fresh snapshots, stale/missing snapshots, and supply gaps
  - shows area/service rows with demand level, open workers, busy workers, active pool, open jobs, utilization, recommended price, and snapshot age
  - sorts attention items first so supply gaps and stale data do not hide below normal rows
  - lets SuperAdmin jump directly from Area Intel to the matching price-rule editor
- `react-app/src/pages/SuperAdmin.css`:
  - adds responsive Area Intelligence summary, health rows, demand badges, and compact operational metrics

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth UI smoke.
- Booking smoke.
- Full React test suite.
- Heart Monitor live/staging smoke with `GIGTOS_SMOKE_URL` set.

What this step does not do yet:

- City/area/service search and saved filters inside Area Intel.
- Map visualization.
- Recruiting recommendations such as "need 8 more cleaners in this area".
- Notification/escalation when snapshots stay stale too long.
- Direct no-worker search counters unless backend snapshots populate that field.

Next implementation step:

- Step 9 should add FCM/push notification for Smart Queue offers. The backend now creates 90-second offers, but workers can miss them if the app is backgrounded.

## 27. Step 9 Implementation Status

Status: complete for Smart Queue worker push notification v1.

Implemented:

- `functions/index.js`:
  - adds `registerWorkerPushToken` callable for signed-in worker accounts
  - stores FCM tokens in `worker_push_tokens` with token hash, worker ID, platform, permission, status, and audit event
  - sends a push notification after a Smart Queue offer transaction commits
  - records `pushNotificationStatus`, success/failure counts, and attempt timestamp on the offer
  - marks invalid/unregistered FCM tokens as `invalid` so dead devices are not retried forever
  - keeps notification failure non-blocking so an offer is not lost when FCM is unavailable
- `firebase.rules`:
  - blocks direct client writes to `worker_push_tokens`
  - scopes token reads to the owning worker or admins
- `react-app/src/utils/workerPushNotifications.js`:
  - registers browser service worker
  - requests notification permission
  - creates FCM token using `REACT_APP_FIREBASE_VAPID_KEY`
  - calls backend token registration
  - listens for foreground offer messages
- `react-app/public/firebase-messaging-sw.js`:
  - handles background FCM messages
  - shows a persistent job offer notification
  - opens the worker dashboard when the notification is clicked
- `react-app/src/pages/worker/WorkerDashboard.js`:
  - adds a Job Offer Alerts control
  - auto-registers if permission is already granted
  - shows safe fallback states when browser push or VAPID setup is missing
  - keeps existing Firestore Smart Queue offer UI as the reliable in-app path
- `react-app/src/styles/worker-dashboard.css`:
  - adds responsive alert-control styling

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth UI smoke.
- Booking smoke.
- Full React test suite.
- Firebase rules unit tests.
- Heart Monitor live/staging smoke with `GIGTOS_SMOKE_URL` set.

External setup needed before real browser delivery:

- Create or copy the Firebase Web Push certificate public key.
- Set it as `REACT_APP_FIREBASE_VAPID_KEY` in the web build/deploy environment.
- Keep the key public; do not store private server keys in React.

What this step does not do yet:

- Native Android/iOS token registration.
- Push delivery analytics dashboard.
- SMS/WhatsApp fallback for workers who disable browser notifications.
- Quiet-hours/safety rules for notification timing.

Next implementation step:

- Step 10 should add stale Open-to-Work session cleanup and offer/no-response hygiene. Backend filtering already ignores expired sessions, but proactively closing stale docs will keep Area Intel and queue state cleaner.

## 28. Step 10 Implementation Status

Status: complete for stale Open-to-Work cleanup and offer/no-response hygiene v1.

Implemented:

- `functions/index.js`:
  - adds scheduled `cleanupWorkerOpenSessions`
  - runs every `5 minutes`
  - expires `worker_open_sessions` where `status == open` and `expiresAt <= now`
  - repairs stale `offered` sessions where `offerLockedUntil <= now` and no active offer remains valid
  - reopens stale offered sessions when the session itself is still fresh
  - expires stale offered sessions when the session itself is past `expiresAt`
  - marks any still-offered queue offer tied to the stale lock as `expired` with `responseType: no_response`
  - writes `cleanupReason` for audit/debugging
  - enqueues demand refresh events after cleanup so Area Intel and demand pricing recover from stale availability
- `firestore.indexes.json`:
  - adds `worker_open_sessions(status, expiresAt)`
  - adds `worker_open_sessions(status, offerLockedUntil)`

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth UI smoke.
- Full React test suite.
- Firebase rules unit tests.
- Heart Monitor live/staging smoke with `GIGTOS_SMOKE_URL` set.

What this step did not do yet at the time:

- Queue fairness rotation. Completed later with backend fairness memory.
- Visible skip/no-response score policy. Completed later with pending `-0.5` review thresholds.
- Consumer no-worker recovery UI. Completed later with `Notify Me`, `Book Later`, and `Search Nearby`.
- Radius expansion beyond same-area matching. Completed later up to `15 km` with haversine fallback.

Next implementation step:

- Step 11 should add consumer no-worker recovery UI: `Notify Me`, `Book Later`, and clear radius-expansion copy so users are not left at a dead end when Smart Queue cannot find a worker.

## 29. Step 11 Implementation Status

Status: complete for consumer no-worker recovery UI v1.

Implemented:

- `functions/index.js`:
  - adds `recordNoWorkerRecoveryChoice`
  - validates booking ownership
  - supports `notify_me`, `book_later`, and `expand_radius`
  - updates `booking_assignment_states` with consumer-safe status/copy
  - updates the booking for scheduled future matching when `Book Later` is chosen
  - writes `consumer_queue_recovery_requests` for follow-up, area intelligence, and recruiting signals
  - enqueues `no_worker_search` demand refresh events so no-worker demand becomes visible in pricing/Area Intel
- `firebase.rules`:
  - blocks direct client writes to `consumer_queue_recovery_requests`
  - lets only the owning consumer or admins read recovery request records
- `firestore.indexes.json`:
  - adds user/status recovery request index
  - adds city/area/service/action recovery request index
- `react-app/src/pages/MyBookings.js`:
  - shows recovery actions on `no_worker`: `Notify Me`, `Book Later`, and `Search Nearby`
  - shows saved recovery states: `notify_me`, `book_later`, and `radius_requested`
  - asks for date/time when the consumer chooses Book Later
- `react-app/src/pages/MyBookings.css`:
  - adds compact recovery action button styling inside the queue-state panel

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth UI smoke.
- Full React test suite.
- Firebase rules unit tests.
- Heart Monitor live/staging smoke with `GIGTOS_SMOKE_URL` set.

Important limitation:

- Step 12 completes true nearby/radius Smart Queue assignment. Google Maps ETA precision is now wired as a backend-only upgrade: Smart Queue uses Google Distance Matrix when `GOOGLE_MAPS_SERVER_API_KEY` exists, caches route lookups for `5 minutes`, and falls back to haversine when Maps is missing, quota-limited, or unavailable.

Next implementation step:

- Step 13 is now complete for live tracking v1. Google Maps ETA/routing precision v1 is implemented through backend callable `updateWorkerTravelLocation`; workers send GPS to the backend, the backend verifies assignment, computes route ETA where possible, and writes `etaSource`, `distanceSource`, `routeStatus`, and `routeLookupStatus` to `booking_live_tracking`.

Proof/photo flow add-on:

- Worker self-start now goes through `StartWorkProofModal`.
- The worker must upload one arrival selfie before `worker_start_work` succeeds.
- Optional before-work photos can be attached at start.
- After-work photos remain required before `worker_mark_finished` can move the booking to `awaiting_confirmation`.
- Consumer `My Bookings` shows the arrival selfie during active work and asks whether the correct worker arrived.
- Consumer decisions are `correct`, `wrong_worker`, or `skipped`.
- `wrong_worker` opens backend support/admin evidence through `support_tickets/wrong_worker_{bookingId}` and `admin_alerts/wrong_worker_{bookingId}`, sets booking review flags, and tells the consumer not to confirm completion until support resolves.
- Storage rules allow image-only uploads under `beforePhotos`, `arrivalSelfies`, `afterPhotos`, and dispute/admin proof paths. Clients cannot list, update, or delete proof uploads.
- Web `capture="user"` is a camera hint, not a cryptographic guarantee. Native app camera-only enforcement remains a later platform hardening layer.

## 30. Step 12 Implementation Status

Status: complete for Smart Queue nearby/radius backend assignment v1.

Implemented:

- `functions/index.js`:
  - adds `SMART_QUEUE_MAX_RADIUS_KM = 15`
  - keeps same-area worker sessions first and returns them before any nearby fallback
  - if same-area supply is empty, queries same-city open sessions by matching service
  - uses coordinate-backed haversine distance when consumer and worker coordinates exist
  - caps coordinate-backed nearby candidates to `15 km`
  - allows low-confidence nearby fallback when coordinates are missing, but ranks it below coordinate-confirmed matches
  - writes `matchingScope`, `sameArea`, `distanceKm`, `distanceConfidence`, and `radiusKm` on Smart Queue offers
  - changes `Search Nearby` recovery to trigger backend matching immediately
  - gives consumers honest copy for same-area offers, nearby fallback offers, and no-worker states
- `firestore.indexes.json`:
  - adds `worker_open_sessions(serviceIds CONTAINS, city, status, expiresAt)` for service/city radius fallback matching
- `react-app/src/pages/worker/WorkerDashboard.js`:
  - shows workers whether an offer is same-area, nearby with approximate distance, or low-confidence nearby-area fallback
- `react-app/src/utils/backendContracts.js`:
  - expands the Smart Queue offer contract with matching scope and distance metadata
- `react-app/src/utils/backendContracts.test.js`:
  - verifies matching metadata on Smart Queue offer contracts

Ranking behavior:

1. Same-area worker sessions are always considered first.
2. If any safe/open same-area candidate exists, nearby candidates are not queried for that offer round.
3. If no same-area candidate exists, backend queries open workers in the same city with the same service.
4. Coordinate-confirmed nearby workers are allowed only within `15 km`.
5. Missing-coordinate workers can still be considered as a low-confidence fallback so the marketplace does not dead-end because of incomplete location data.
6. GigScore remains the largest rank input; distance/same-area are rank inputs, not absolute overrides over safety and approval.

Tests passed:

- Cloud Functions syntax check.
- Focused backend contract test.
- Focused dev-auth UI smoke.
- Firebase rules unit tests.
- Full React test suite.
- Production React build.

Important limitation:

- Google Maps ETA/routing v1 is implemented server-side through Distance Matrix when `GOOGLE_MAPS_SERVER_API_KEY` exists. Current fallback still uses coordinate haversine distance and marks missing-location matching as low confidence.

Smart Queue fairness add-on:

- Backend ranking now includes `fairnessPenalty` in `scoreBreakdown`.
- A worker's Open-to-Work session tracks `smartQueueOfferCount`, `smartQueueRejectCount`, `smartQueueNoResponseCount`, and recent offer timestamps.
- Recent repeated offers, explicit rejects, and no-responses create a small capped penalty so similar safe workers rotate instead of one worker being spammed.
- The fairness penalty is capped and does not override approval, safety, service/area match, favorite safety guardrails, or large GigScore quality differences.
- Fresh Open-to-Work sessions reset fairness memory so workers are not punished for old launch-session behavior.

Smart Queue skip/no-response GigScore review add-on:

- Exact MVP threshold is `3` eligible safe skips/no-responses in one Open-to-Work session or `5` eligible safe skips/no-responses in one week.
- Crossing the threshold creates a deterministic pending `gigscore_events` review with `delta: -0.5`.
- The worker score does not change automatically. SuperAdmin must finalize or reverse the review.
- Exemptions: unsafe reason, far/distance reason, wrong service, already busy, emergency/medical/family reason, low-confidence nearby fallback, missing service/quote/booking evidence, or unsafe/fraud-blocked worker state.
- Backend stores weekly reliability memory in `smart_queue_reliability_windows`; this is admin-readable and backend-owned only.

Consumer price explanation add-on:

- `react-app/src/pages/Service.js` now shows consumer-safe locked-price explanation in the quote panel and confirmation modal.
- Copy includes demand label, worker full customer-price receivable during launch, local service/rule/current demand basis, and price-lock time.
- Copy intentionally avoids exact utilization thresholds, minimum-worker internals, and other values that workers/consumers could game.
- The existing dev-auth UI smoke protects the "Why this price?" and full-worker-receivable text.

Launch no-worker copy add-on:

- `react-app/src/pages/MyBookings.js` shows honest recovery copy when Smart Queue cannot find a worker.
- No-worker copy says same-area workers were checked and lets the consumer choose `Notify Me`, `Book Later`, or `Search Nearby`.
- `Search Nearby` copy explains nearby matching can expand up to `15 km`, while still keeping verified-worker rules.
- `quote_expired`, `notify_me`, `book_later`, `radius_requested`, and `offered` states each have safe fallback copy if the backend state message is missing.

Next implementation step:

- Step 13 is complete for live tracking v1. Google Maps route ETA v1 is now backend-computed when configured; the app keeps haversine fallback for missing key/quota/API failures.

## 31. Step 13 Implementation Status

Status: complete for live tracking v1.

Implemented:

- `react-app/src/context/WorkerLocationContext.js`:
  - active assigned booking tracking writes to Firestore every about `5 seconds`
  - open-work/background availability location writes stay slower at about `30 seconds` to control cost
  - writes booking-scoped live tracking to `booking_live_tracking/{bookingId}`
  - stores `lat`, `lng`, accuracy, speed, heading, approximate ETA, distance remaining, route status, location status, `timestampMs`, and `lastLocationAt`
  - marks `arrived`, `left_location`, `stopped`, or `location_closed` as route/location state changes
- `react-app/src/components/TrackingMap.js`:
  - replaces the old Realtime Database `/active_tracking/{bookingId}` listener with Firestore `booking_live_tracking/{bookingId}`
  - shows last update age, stale warning after `30 seconds`, approximate ETA, and approximate distance remaining
  - labels fallback ETA as approximate so consumers do not over-trust straight-line distance
- `react-app/src/pages/worker/WorkerDashboard.js`:
  - starts booking-scoped live tracking after worker successfully clicks `Start Work`
  - passes booking ID and known destination coordinates into the tracking context
- `react-app/src/components/worker/StartTravelButton.js`:
  - updates legacy start-travel behavior to write the same `booking_live_tracking` contract
- `firebase.rules`:
  - adds participant-scoped read rules for `booking_live_tracking`
  - only the assigned worker can create/update live tracking for that booking
  - unrelated users cannot read or write live tracking
- `react-app/scripts/testFirebaseRules.js`:
  - verifies consumer/worker/admin live-tracking access and blocks unrelated users/client spoofing

Important behavior:

- Live tracking is separate from demand-pricing Pub/Sub. Location should not wait on 30-120 second demand debounce.
- Firestore realtime means the UI reflects committed location writes immediately; write cadence is currently about `5 seconds` for active jobs.
- Exact route ETA uses backend Google Distance Matrix when configured. If Maps is not configured or fails, the app labels ETA as approximate fallback.
- Stale GPS/network states are shown as warnings, not automatic penalties.
- Exact lat/lng is short-retention data only. Active booking tracking writes `retentionClass: active_job_exact_location` and `exactLocationExpiresAt`; scheduled cleanup redacts exact coordinates after `4 hours`.
- Worker availability live location writes `retentionClass: active_live_location` and is deleted when expired.
- `worker_location_sessions` are summary-only records and must not store exact destination/current coordinates.

Tests passed:

- Cloud Functions syntax check.
- Focused dev-auth UI smoke and backend contract tests.
- Firebase rules unit tests.
- Full React test suite.
- Production React build.

Next implementation step:

- Step 15 is complete for watchdog review queues in SuperAdmin and Field Operator UI.

## 32. Step 14 Implementation Status

Status: complete for travel-time watchdog v1.

Implemented:

- `functions/index.js`:
  - adds scheduled `monitorTravelWatchdog`, running every `1 minute`
  - reads active `booking_live_tracking` records
  - stores `expectedTravelMinutes` baseline before escalation
  - creates `worker_warning` when elapsed travel time reaches `1.5x`
  - creates `support_review` when elapsed travel time reaches `2x`
  - creates `timeout_review` only when travel reaches `2.5x` and location heartbeat is stale
  - writes `travel_watchdog_events` evidence records
  - opens backend `support_tickets` for `support_review` and `timeout_review`
  - updates booking with `travelWatchdogStatus`, evidence, `supportReviewRequired`, and `noShowCandidate`
  - sets `noAutoGigScorePenalty: true`; score changes require later deterministic review
- `firebase.rules`:
  - lets admins read `travel_watchdog_events`
  - blocks direct client writes to watchdog events
  - splits `booking_live_tracking` create/update rules so backend watchdog metadata does not block later worker GPS updates
- `react-app/src/components/TrackingMap.js`:
  - shows backend watchdog messages to the consumer when a travel review state exists
- `react-app/scripts/testFirebaseRules.js`:
  - verifies watchdog event visibility is admin-only
  - verifies workers can keep updating GPS after backend watchdog metadata exists

Important behavior:

- Booking `status` is not changed to a custom timeout status. This avoids breaking existing active-job screens.
- Timeout state is stored separately as review evidence: `travelWatchdogStatus`, `supportReviewRequired`, and `noShowCandidate`.
- `timeout_review` requires both `2.5x` expected travel time and stale location heartbeat.
- GPS/network problems create review evidence, not automatic worker punishment.

Tests passed:

- Cloud Functions syntax check.
- Firebase rules unit tests.
- Focused dev-auth UI smoke.

Next implementation step:

- Step 15 is complete. Step 16 should add resolve/dismiss actions for watchdog tickets with a required reason and optional payout/score decision.

## 33. Step 15 Implementation Status

Status: complete for watchdog review queues.

Implemented:

- `react-app/src/utils/operatorQueues.js`:
  - adds `buildTravelReviewQueue`
  - builds travel review rows from booking watchdog fields and `travel_watchdog` support tickets
  - adds `travel` to operator console totals
  - routes travel support tickets to route-evidence review copy
- `react-app/src/pages/FieldOperator.js`:
  - adds a dedicated `Travel` tab
  - shows booking ID, service, worker, watchdog level, elapsed time, stale seconds, and next action
  - demo/dev data includes a timeout review case for UI smoke visibility
- `react-app/src/pages/SuperAdmin.js`:
  - listens to `support_tickets`
  - adds a global `Travel` tab
  - shows timeout/support/warning/high-priority summary counts
  - lists review rows with clear "No automatic GigScore penalty" copy
- `react-app/src/utils/backendContracts.test.js`:
  - updates operator totals expectations for the new `travel` bucket

Important behavior:

- These queues are read/review surfaces only. They do not resolve tickets or apply score/payout decisions yet.
- Human review remains required before any GigScore penalty or no-show decision.

Tests passed:

- Cloud Functions syntax check.
- Firebase rules unit tests.
- Focused dev-auth UI smoke and backend contract tests.
- Full React test suite.
- Production React build.

Next implementation step:

- Step 16 is complete. Next step should add area intelligence v1 for founder visibility.

## 34. Step 16 Implementation Status

Status: complete for watchdog resolve/dismiss actions.

Implemented:

- `functions/index.js`:
  - adds backend callable `resolveTravelWatchdogReview`
  - requires admin, superadmin, region lead, or field operator context
  - requires booking ID, decision, and resolution reason
  - supports `worker_contacted`, `consumer_updated`, `dismiss_gps_issue`, `confirmed_no_show`, and `resolved_no_issue`
  - updates booking resolution fields, tracking resolution fields, support ticket status, and watchdog resolution evidence
  - writes activity log and security audit with actor, role, reason, payout decision, and score decision
- `react-app/src/utils/operatorQueues.js`:
  - removes resolved, dismissed, or closed watchdog reviews from the open queue
- `react-app/src/pages/FieldOperator.js`:
  - adds `Contacted`, `Dismiss GPS`, and `No-show` actions to the Travel queue
  - requires a typed reason before sending a resolution
  - keeps dev/demo mode functional by updating local review state
- `react-app/src/pages/SuperAdmin.js`:
  - adds the same Travel queue action buttons for SuperAdmin
  - calls the backend resolver with payout and score decisions

Important behavior:

- Confirmed no-show can hold payout for manual review.
- Confirmed no-show sends the case into explicit pending GigScore review, not an automatic score deduction.
- GPS/network issues can be dismissed without worker penalty.
- Resolved and dismissed rows leave the open Travel review queue so operators do not keep seeing completed work.
- Resolved and dismissed rows remain visible in resolved travel history for audit.

Resolved travel history add-on:

- `react-app/src/utils/operatorQueues.js` builds `travelResolvedHistoryQueue` from resolved/dismissed booking fields and closed/resolved `travel_watchdog` support tickets.
- `react-app/src/pages/FieldOperator.js` adds a `History` tab for completed travel watchdog decisions.
- `react-app/src/pages/SuperAdmin.js` shows resolved travel history below open Travel reviews.
- History rows show decision, reason, payout decision, score decision, resolved time, resolver, and pending GigScore review event ID when applicable.
- History counts do not inflate open work/check totals.

Tests passed:

- Cloud Functions syntax check.
- Firebase rules unit tests.
- Focused dev-auth UI smoke and backend contract tests.
- Full React test suite.
- Production React build.

Next implementation step:

- Step 19 is complete. Next step should move to SEO + worker landing, or a resolved-history view for watchdog reviews depending on launch priority.

## 35. Step 17 Implementation Status

Status: complete for founder Area Intelligence v1.

Implemented:

- `react-app/src/utils/areaIntelligence.js`:
  - adds deterministic aggregate logic for city/area/service intelligence
  - combines `service_price_rules`, latest `area_demand_snapshots`, and recent `price_quotes`
  - calculates supply gaps, stale/missing snapshots, low sample size, peak active state, manual override state, and price-to-queue conversion after price is shown
  - returns privacy-safe recruiting/action suggestions without raw consumer or worker coordinates
  - builds aggregate map points from SuperAdmin-managed area centers or city fallback centers
  - offsets overlapping service markers visually while preserving the original aggregate center for audit/debug context
- `react-app/src/components/SuperAdminAreaIntelMap.js`:
  - renders the Area Intelligence Map with Leaflet/OpenStreetMap
  - plots aggregate city/area/service pressure only
  - shows marker popups with demand level, worker supply, open jobs, no-worker searches, queue conversion, recommended price, and recruiting guidance
  - flags city-fallback markers so SuperAdmin knows to add exact aggregate area center coordinates to the price rule
- `react-app/src/pages/SuperAdmin.js`:
  - watches recent `price_quotes` for admin-only aggregate conversion samples
  - upgrades Area Intel summary with peak active, low sample, manual override, quote sample, and price-to-queue metrics
  - shows per-row searches, no-worker searches, quote shown count, conversion, health labels, suggested price, and recruiting guidance
  - adds `areaCenterLat/areaCenterLng` inputs to the price-rule form and passes them into save/seed actions
  - mounts the aggregate map before growth insights so location pressure is visible before cap edits
- `react-app/src/pages/SuperAdmin.css`:
  - adds visual health states for peak active, low sample, manual override, and aggregate health tags
  - adds responsive map canvas, map legend, fallback warning, and popup styling
- `react-app/src/utils/areaIntelligence.test.js`:
  - verifies supply gap ranking, stale snapshot detection, low sample/manual override flags, quote conversion, and aggregate-only recruiting copy
  - verifies map points from area centers, city fallback behavior, and overlap offsets without exact user/worker coordinates
- `react-app/scripts/patchReactScriptsDevServer.js`:
  - keeps the secure `webpack-dev-server@5.2.4` override
  - patches CRA/react-scripts dev-server config after install so `npm start` still works with the newer dev server API

Important behavior:

- The dashboard stays aggregated by `city/area/service`.
- It does not show raw exact live locations.
- Area map markers use `areaCenterLat/areaCenterLng` on price rules when available.
- When area center is missing, the map uses a city fallback marker and tells SuperAdmin to add the area center.
- Exact consumer homes, worker live GPS, and booking route coordinates are intentionally excluded from the analytics map.
- Price-to-queue is treated as an operational signal, not a final finance or revenue metric.
- Deeper heatmaps for worker clusters, consumer/order density, recurring-demand slots, risk zones, and ad/recruiting campaigns remain later analytics work.

Growth insight add-on:

- `functions/index.js` now has deterministic `refreshAreaGrowthInsights`.
- It runs every `4 hours` and SuperAdmin can run it manually through `refresh_area_growth_insights`.
- It reads only aggregate `service_price_rules`, latest `area_demand_snapshots`, and recent `price_quotes`.
- It writes backend-owned `area_growth_insights` with priority, insight type, reason codes, aggregate metrics, recommendation, source, status, and `rawPayloadStored: false`.
- It marks old open insights as `resolved` when latest aggregate data no longer supports them.
- SuperAdmin Area Intel shows open growth insights, urgent/high counts, last refresh time, and top recommendations for recruiting, no-worker recovery, stale snapshots, weak conversion, and low-sample high demand.
- Firestore rules allow admins to read `area_growth_insights`; create/update/delete is backend-only.
- Vertex AI can later summarize these safe insight records, but AI must not read raw private users, exact locations, raw support text, or personal logs for growth recommendations.

Tests passed:

- Area Intelligence unit tests.
- Backend contract unit tests.
- Cloud Functions syntax check.
- Firebase rules unit tests.
- Full React test suite.
- Production React build.
- `npm audit --omit=dev` with 0 vulnerabilities.
- Local `npm start` smoke responded on localhost.

Next implementation step:

- Step 19 is complete. Next step should move to SEO + worker landing, or a resolved-history view for watchdog reviews depending on launch priority.

## 36. Step 18 Implementation Status

Status: complete for Consumer AI v1 backend gateway guardrails.

Implemented:

- `functions/index.js`:
  - upgrades `aiBookingAssistant` into the single backend AI gateway for consumer chat
  - uses Vertex AI as the primary model gateway for consumer chat when project/location/model and service-account IAM are configured
  - keeps Gemini API-key mode as fallback-only during migration, using LangChain Google GenAI first and raw Gemini REST only if LangChain fails
  - adds deterministic allowed-tool routing for service suggestion, price explanation, area availability, booking guidance, support triage, and safe memory lookup
  - blocks prompt-injection attempts that ask for internal prompts, secrets, logs, admin data, source code, or bypass behavior
  - redacts email, phone, payment-like numbers, UPI-like values, OTP/PIN/secrets, and address-like detail before AI context, memory, and audit writes
  - writes summary-only safe memory only after explicit consumer consent
  - optionally writes the same redacted summary to mem0 cloud when `MEM0_API_KEY` is configured in the backend runtime, with inference disabled so mem0 remains memory-only and not a separate model decision path
  - filters AI replies so the model cannot claim final price, worker assignment, booking confirmation, payment/refund/payout, or GigScore changes
  - records `modelProvider` and `modelName` in `consumer_ai_audits` so SuperAdmin/future AI agents can see whether Vertex, Gemini fallback, or deterministic fallback answered
  - keeps final deterministic fallback if Vertex/Gemini are missing or fail
  - writes `consumer_ai_audits` with redacted prompt preview, selected tool intents, policy evidence, and memory-write evidence
- `react-app/src/components/ConsumerAiAssistant.js`:
  - sends only safe area context such as city/source, not exact lat/lng
  - adds a consumer-controlled "Remember safe preferences only" consent toggle
  - surfaces when a safe preference summary was saved
- `firebase.rules`:
  - makes `consumer_ai_memories` and `consumer_ai_audits` backend-owned and admin-readable only
- `react-app/scripts/testFirebaseRules.js`:
  - verifies consumers cannot directly read or write AI memories/audits
  - verifies admins can inspect AI memory/audit evidence
- `functions/package.json`:
  - includes `langchain`, `@langchain/core`, `@langchain/google-genai`, and `mem0ai`
  - overrides vulnerable `undici` pulled through mem0/Qdrant to a fixed version

CrewAI decision:

- Direct Firebase Functions install is not recommended for MVP.
- The available npm `crewai` package is an unofficial Node implementation that pulls OpenAI, SQLite/native packages, old LangChain, Chroma, and heavier deploy-risk dependencies.
- If CrewAI is needed later, run official Python CrewAI in Cloud Run and call it from Firebase through the same AI gateway. Keep Gemini as the model provider and never expose keys to frontend.
- `MEM0_API_KEY` is documented as optional. Do not attach it as a required Firebase secret until a real mem0 key exists; otherwise deploy can fail even though Firestore summary memory is enough for MVP.

Important behavior:

- Consumer AI can explain, suggest, triage, and guide.
- Consumer AI cannot auto-book, assign workers, set final price, change payment/refund/payout state, or change GigScore.
- Memory is summary-only and consent-gated.
- Exact location stays out of the AI gateway context.
- Vertex AI is the default model gateway behind the same backend contract. External mem0 and LangChain remain supporting tools, not direct frontend integrations.
- Sanitized high-severity Sentry/Jira incident summaries also use the same Vertex-first backend gateway, capped to avoid noisy/costly summarization loops.
- Scheduled `monitorAiModelGatewayHealth` checks the backend model gateway every `30 minutes`, writes `platform_settings/ai_model_gateway_health`, and opens `ai_model_gateway_degraded` if Vertex falls back or fails.
- SuperAdmin has an `AI Health` tab for the model provider, model, Vertex project/location, last check, safe reply/error, and fallback status.
- SuperAdmin can manually refresh the same AI health check through `superadminAction`.

## 36A. AI Orchestration Product Contracts Added

Status: complete for MVP-safe orchestration contracts.

Implemented:

- Consumer AI Concierge:
  - `aiBookingAssistant` now returns a structured `concierge` object with `supportLevel`, `planTier`, `recommendedActions`, `allowedActions`, `blockedActions`, `photoSupport`, and no-worker recovery copy.
  - `consumer_ai_audits` stores support level and recommended actions for future agent evaluation.
  - AI can suggest `notify_me`, `book_later`, and `expand_radius_to_15km`, but state changes remain backend callable decisions.
  - `ConsumerAiAssistant` supports user-owned problem-photo upload and passes only a verified Storage path to `aiBookingAssistant`.
  - backend problem-photo triage returns likely service, confidence, urgency, and confirmation requirement; it cannot auto-book or price.
  - `consumer_ai_home_profiles` stores consent-gated premium preference fields such as time, language, budget, recurring need, and favorite-worker preference without raw chat.
  - `manageConsumerAiMemory` plus the Gito assistant memory panel let users view safe summaries, pause/resume memory, delete individual memories, clear home profile, or clear all AI memory.
- AI conversion evidence:
  - `recordConsumerAiConversionEvent` writes sanitized `consumer_ai_conversion_events` and aggregate `consumer_ai_conversion_daily`.
  - `ConsumerAiAssistant` records assistant opened, message sent, book clicked, booking page opened, problem photo attached, and problem photo triaged as best-effort non-blocking analytics.
- AI work photo quality handoff:
  - booking after-photo arrival automatically queues `ai_photo_quality_reviews`.
  - `requestAiWorkPhotoQualityReview` lets a participant/admin retry the review.
  - Vertex multimodal review is attempted for allowlisted Firebase/Google Storage HTTPS photos; otherwise metadata fallback creates a human-review packet.
  - AI photo review never changes GigScore, payout, dispute, or booking status. It stores `pending_human_review` and `canAffectGigScore: false`.
- AI release manager packet:
  - `prepareAiReleaseManagerPacketDaily` writes daily `ai_release_packets` with AI gateway, Sentry, Jira handoff, recurrence, governance, and RAG evidence.
  - SuperAdmin can manually run `prepare_ai_release_manager_packet`.
  - packets explicitly disallow autonomous deploy/progressive rollout and require post-release verifier evidence.

Firestore security:

- `consumer_ai_home_profiles`, `consumer_ai_privacy_settings`, `consumer_ai_conversion_events`, `consumer_ai_conversion_daily`, `ai_photo_quality_reviews`, and `ai_release_packets` are backend-written and admin-readable only.

Tests passed:

- Cloud Functions syntax check.
- Functions dependency audit with 0 vulnerabilities.
- Firebase rules unit tests.
- Focused dev-auth UI smoke.
- Area Intelligence and backend contract unit tests.

Next implementation step:

- Proceed to SEO + worker landing if growth work is highest priority, or add a resolved-history view for completed watchdog reviews if operations needs it first.

## 37. Step 19 Implementation Status

Status: complete for explicit GigScore review handoff for confirmed travel no-show cases.

Implemented:

- `functions/index.js`:
  - adds `createTravelNoShowGigScoreReview()` to create a deterministic pending GigScore event for confirmed watchdog no-shows
  - uses event ID `travel_no_show_{bookingId}` so repeated review clicks cannot create duplicate score penalties
  - stores `reasonCode: worker_no_show_travel_watchdog_review`, `delta: -50`, `status: pending`, and `handoffType: travel_watchdog_confirmed_no_show`
  - records route/watchdog evidence, support ticket ID, confirmer role, redacted reason, and `noAutomaticPenalty: true`
  - updates the booking with `travelWatchdogGigScoreReviewEventId`, `travelWatchdogGigScoreReviewStatus`, `travelWatchdogScoreDecision: pending_gigscore_review`, and `noAutoGigScorePenalty: true`
  - activity log and security audit now include the created GigScore review event ID
- `react-app/src/pages/SuperAdmin.js`:
  - changes the Travel queue confirmed no-show action to `Send No-show Review`
  - updates copy so operators understand no-show confirmation creates a review handoff, not an instant score deduction
  - highlights travel watchdog handoffs inside the GigScore Review queue with a route/support/contact evidence reminder
- `react-app/src/pages/FieldOperator.js`:
  - changes the Travel queue confirmed no-show action to `Send No-show Review`
  - sends `scoreDecision: create_gigscore_review`, while the backend remains the source of truth and stores `pending_gigscore_review`

Important behavior:

- Travel watchdog evidence can identify a no-show candidate.
- Human review can confirm the case.
- Worker score still does not change until SuperAdmin finalizes the pending GigScore event.
- SuperAdmin can reverse the pending handoff if GPS, traffic, consumer communication, or support evidence is weak.
- This protects workers from automatic penalties while still giving operations a clear evidence path for real no-shows.

Tests passed:

- Cloud Functions syntax check.
- Firebase rules emulator tests.
- Full React test suite.
- Production React build.
- Route smoke.
- Heart Monitor smoke.
- Functions and React production dependency audits with 0 vulnerabilities.

Next implementation step:

- Step 20 is complete for SEO + worker landing v1, and watchdog resolved-history is now implemented. Next growth polish is city/locality pages and SEO analytics; next ops setup is connecting real Sentry/Jira credentials.

## 38. Step 20 Implementation Status

Status: complete for SEO + worker landing v1.

Implemented:

- `react-app/src/utils/seo.js`:
  - adds a small route-level metadata helper for title, description, keywords, canonical, Open Graph, Twitter, and JSON-LD
- `react-app/public/index.html`:
  - replaces old broken-encoding default metadata with clean launch SEO copy
  - keeps the GitHub Pages SPA redirect script
  - adds Organization JSON-LD for Gigtos launch services
- `react-app/public/sitemap.xml` and `react-app/public/robots.txt`:
  - list home, services, workers, key launch service URLs, and worker signup
  - block admin/operator/worker-dashboard paths from crawler focus
- `react-app/src/pages/ServiceCatalog.js`:
  - adds route-level service catalog SEO metadata and ItemList JSON-LD
- `react-app/src/pages/WorkerLanding.js` and `WorkerLanding.css`:
  - adds public `/workers` landing page for experienced workers
  - explains no-commission launch, first month free, verified-worker proof, GigScore, Open-to-Work control, launch services, and proof-photo trust
  - sends worker CTA to `/auth?mode=worker&phase=signup`
- `react-app/src/pages/Auth.js`:
  - respects `phase=signup` so worker landing can open signup directly
- `react-app/src/components/Header.js`:
  - links public visitors and signed-in users to `/workers`
- `react-app/scripts/runRouteSmoke.js` and `react-app/src/__tests__/devAuthUiSmoke.test.js`:
  - include `/workers` in route and UI smoke coverage

Important behavior:

- This is honest SEO v1, not fake locality expansion.
- GitHub Pages/hash routing limits true server-rendered city/locality SEO, so city/locality pages and organic tracking remain growth polish.
- Worker landing copy keeps MVP promises clear: workers keep job earnings during launch, must be verified, and receive offers only when Open to Work.

## 39. Sentry Log Monitoring Implementation Status

Status: complete for optional privacy-filtered Sentry SDK monitoring.

Implemented:

- `react-app/src/utils/sentryMonitoring.js`:
  - initializes `@sentry/react` only when `REACT_APP_SENTRY_DSN` is configured
  - captures React error-boundary crashes and frontend auth role lookup failures
  - stores Sentry user context as ID and role only
  - redacts email, phone, numeric/payment-like values, secrets, cookies, auth headers, exact addresses, and exact lat/lng before upload
  - drops user-side offline/network noise, aborted requests, and browser extension frames before upload
- `functions/index.js`:
  - initializes `@sentry/node` only when `SENTRY_DSN` or `FUNCTIONS_SENTRY_DSN` is configured
  - captures Firebase callable failures through the shared `appCheckOnCall` wrapper
  - captures Razorpay webhook runtime failures
  - captures backend unhandled rejections and uncaught exceptions
  - redacts sensitive data before events leave Firebase Functions
  - adds scheduled `syncSentryIssueSummaries` every `15 minutes` when Sentry API env vars are configured
  - writes sanitized `sentry_issue_summaries` and `ai_incident_summaries` for founder/AI/Jira workflows
  - creates deterministic SuperAdmin alerts for high severity Sentry issues
  - creates `jira_issue_handoffs` for high severity Sentry issues
  - creates Jira issues when Jira env vars are configured; otherwise stores `pending_configuration` handoffs for SuperAdmin
  - adds scheduled `monitorSentryPipelineHealth` every `30 minutes`
  - creates deterministic `SENTRY_PIPELINE_DOWN` SuperAdmin alert and Jira handoff when ingest is failed, stale, or partially configured
  - adds scheduled `sendSentryCanaryHeartbeat` every `60 minutes` using Sentry Cron check-ins for active backend DSN verification without fake error issues
  - keeps the older Sentry auto-fix backlog scheduler under `legacySyncSentryAutoFixBacklog` so it cannot overwrite the privacy-filtered `syncSentryIssueSummaries` export
- `docs/SENTRY_LOG_MONITORING.md`:
  - documents DSN setup, privacy boundaries, and MVP alert policy

Important behavior:

- Sentry is disabled by default until DSNs are configured.
- Local runtime Sentry env has been configured and API access has been verified without exposing DSNs/tokens.
- `syncSentryIssueSummaries`, `monitorSentryPipelineHealth`, and `legacySyncSentryAutoFixBacklog` are deployed to Firebase project `gigto-c0c83`.
- Production logs show successful scheduled Sentry ingest/health executions, and `syncSentryIssueSummaries()` was invoked through Firebase Functions shell after the export-collision fix.
- Backend Sentry canary state lives at `platform_settings/sentry_canary`; it stores only status, monitor slug, check-in ID, timestamps, and `rawPayloadStored: false`.
- If Sentry Cron monitor verification fails, the backend opens SuperAdmin alert `sentry_canary_needs_monitor_setup` instead of reporting a false healthy state.
- Sentry Cron monitor slug `gigtos-backend-sentry-canary` exists under the backend `node` project, and the backend canary was invoked successfully after setup.
- SuperAdmin `AI/Ops Health` now shows Sentry ingest and canary health beside AI model gateway health, including issue counts, high-severity counts, Jira configured state, monitor verification state, and the exact next action.
- SuperAdmin `AI/Ops Health` includes a recent-reauth manual `Run canary check` action backed by `run_sentry_canary_check`.
- GitHub Pages CSP allows Sentry ingest hosts in `connect-src`, including regional ingest domains, so frontend envelopes are not blocked by the browser.
- Local route smoke and live smoke both assert the Sentry ingest CSP hosts remain present.
- Sentry frontend filtering ignores weak-user-network noise so founder attention stays on real app/backend failures.
- Frontend DSN is public-browser only; Vertex, Gemini, Firebase Admin, payment, and private keys must never go into React env.
- Backend DSN stays in Firebase Functions/runtime secrets or environment only.
- Sentry groups and alerts on incidents; Jira/TODO remains the source of truth for fix work.
- Raw Sentry issue payloads are not stored in Firestore; only redacted metadata, evidence IDs, severity, and suggested next step are saved.
- Every high-severity Sentry issue gets a deterministic `workflowId` and Jira handoff state, so later agents stay on the same incident thread.
- The Sentry pipeline itself is monitored as a first-class incident path.

Next implementation step:

- Monitor the Sentry Cron canary after first live check-in and tune Sentry alert routing if founder notifications become noisy.

## 40. Current Implementation Score And Missing Pieces

Current product design score: `9.79/10`.

Target before implementation: at least `9.5/10`.

What is strong:

- Demand pricing is backend-rule controlled.
- SuperAdmin can configure price rules without code.
- Worker receives full consumer price in MVP.
- Same-area workers are preferred before radius expansion.
- Nearby radius fallback up to `15 km` is implemented.
- Live tracking v1 is implemented for accepted bookings.
- Travel-time watchdog v1 creates warnings/review evidence without automatic penalties.
- SuperAdmin and Field Operator can see travel watchdog review queues.
- SuperAdmin and Field Operator can resolve or dismiss travel watchdog reviews with audit evidence.
- Confirmed watchdog no-shows now create an explicit pending GigScore review handoff, not an automatic penalty.
- Sentry monitoring is wired for privacy-filtered frontend/backend error capture.
- Scheduled Sentry issue ingest creates sanitized AI/Jira-ready incident summaries, SuperAdmin alerts, and Jira handoffs.
- Founder Area Intelligence v1 shows aggregate supply, demand, pricing health, conversion, and recruiting gaps.
- Consumer AI v1 is backend-gated, consent-aware, memory-safe, and forbidden from making marketplace decisions.
- Google Maps distance/ETA precision upgrade v1 is implemented with backend-only Distance Matrix calls and safe fallback.
- GigScore is first in ranking.
- Open-to-Work prevents fake availability.
- AI can explain, but cannot decide final price or ranking.
- Pricing evidence is stored on every booking.

Missing pieces to reach `9.5/10`:

1. Define a single source of truth for `areaId`.
   City/locality strings are messy. Before implementation, define canonical area IDs such as `hyderabad_kukatpally`, `hyderabad_miyapur`, and map user-entered addresses to those IDs.

2. Google Maps fallback is partially implemented.
   The backend and consumer tracking UI use Google Maps route ETA when the backend server key is configured. If Maps is missing or fails, the app uses approximate haversine distance and labels fallback ETA as approximate.

3. Worker offer concurrency lock is implemented for backend same-area v1.
   Worker sessions move to `offered` for one active queue offer and then to `busy` after accept. Next improvement is cross-session/global worker locking if the same worker can accidentally create multiple open sessions.

4. Queue fairness limits are implemented for backend v1.
   The same top worker should not receive every offer if they keep ignoring jobs. Current backend uses recent-offer, reject, and no-response memory inside the active Open-to-Work session to rotate similar safe workers while keeping GigScore first.

5. No-response versus reject is implemented for backend same-area v1.
   `reject` and `no_response` are tracked separately. Next improvement is skip-score policy and worker-facing reason UI.

6. Exact skip/no-response GigScore threshold is implemented for backend v1.
   The backend starts with hidden reliability evidence, then creates a pending `-0.5` GigScore review only after `3` eligible safe skips/no-responses in one Open-to-Work session or `5` in one week. SuperAdmin must finalize or reverse.

7. Price-lock duration is implemented.
   Backend quotes lock pricing for `10 minutes`, so demand snapshots do not change mid-confirmation.

8. Consumer wait timeout and no-worker recovery are implemented.
   Smart Queue state uses an `8 minute` consumer wait window. Consumers can choose `Notify Me`, `Book Later`, or `Search Nearby`.

9. Audit indexes are partially implemented.
   Indexes now cover price rules, snapshots, open sessions, quotes, queue offers, assignment states, and demand refresh queue. More can be added when SuperAdmin queue dashboards define exact filters.

10. Location privacy boundary is implemented for backend/rules v1.
   Permanent analytics should use area/service aggregates. Exact live location is only for active job tracking and short review windows. `booking_live_tracking` exact coordinates are redacted after `4 hours`, expired `worker_live_locations` are deleted, and `worker_location_sessions` keep summary status/timing only.

11. Manual override hierarchy is implemented for backend/UI v1.
   SuperAdmin manual demand beats fresh snapshots only when a clear audit reason exists. Full hierarchy: `disabled_rule > worker_price_cap > superadmin_manual_demand_with_reason > fresh_snapshot > safe_normal_fallback > max_price_cap`. Pricing ignores old/bad manual override data when the audit reason is missing or too short, and `superadminAction.save_service_price_rule` writes override audit metadata.

12. Launch UI copy is implemented for v1.
   Pricing and recovery now use clear text:
   - "Worker receives the full customer price during launch."
   - "High demand now because few workers are open nearby."
   - Price-lock time is shown on locked quotes; quote-expired states ask the consumer to refresh the backend price.
   - No-worker state explains same-area checked, `Notify Me`, `Book Later`, and `Search Nearby` verified-worker fallback up to `15 km`.

13. Pricing and Smart Queue seeded smoke tests are implemented.
   `react-app/src/__tests__/marketplacePricingSmartQueueSmoke.test.js` covers the MVP marketplace seed set:
   - deterministic low, normal, high, and peak pricing
   - stale snapshot fallback
   - worker price below local minimum and above cap
   - SuperAdmin manual override still capped
   - favorite worker boost only when the worker is safe, approved, open, non-expired, and service/area eligible
   - unsafe favorite and expired Open-to-Work sessions excluded from matching
   - same-area-first plus nearby radius up to `15 km`
   - out-of-radius/no-worker recovery options
   - repeated safe skip/no-response pending review with no automatic penalty
   - travel timeout/no-show evidence routed into human review instead of silent completion

   New command:

   ```bash
   npm run smoke:marketplace
   ```

   `npm run smoke:heart` now runs marketplace smoke before build, Playwright browser Heart Monitor, route, dev-auth, and optional live checks.
   `npm run smoke:browser-heart` renders key routes in Chromium, checks React root health/fatal browser errors, and writes screenshots/report to `react-app/test-results/heart-monitor`.
   `.github/workflows/heart-monitor.yml` runs the Heart Monitor hourly, manually, and after main/react-app changes, then uploads the latest report/screenshots as workflow artifacts.

## 41. Worker Onboarding / Verification MVP

Status: implemented for MVP v1.

Purpose:

- Let experienced workers join with enough proof for marketplace trust before they receive jobs.
- Keep protected approval/verification fields backend-owned.
- Keep raw identity data out of normal app-readable worker profiles.

Worker signup collects:

- Name, phone, city/area, service types, experience years, starting price, and short bio.
- Mock Aadhaar OTP verification in the UI. Real Surepass/DigiLocker integration is still later.
- Required profile photo with selected-file preview.
- Required previous platform/work proof documents with selected-file preview.
- Optional certificate documents with selected-file preview.
- Optional previous platform name and masked previous platform ID.

Storage contract:

- Worker uploads go under `workers/{uid}/verification/{category}/{file}`.
- Allowed categories are `profile_photo`, `previous_platform`, `certificate`, `portfolio`, and `identity_optional`.
- Storage rules allow only the owning worker to upload/read their own verification files.
- Storage rules block list/update/delete and block oversized or unsafe content types.
- Frontend upload uses resumable Firebase Storage uploads and shows per-file progress during submission.

Backend contract:

- `submitWorkerVerification` is the only worker signup submission path for protected verification state.
- It writes pending records to `worker_auth/{uid}`, `gig_workers/{uid}`, `worker_verification_submissions/{uid}`, `admin_alerts`, `security_audits`, and the worker phone index.
- Normal profile documents get masked/safe fields only.
- `worker_verification_submissions` stores masked Aadhaar display and a SHA-256 hash when Aadhaar is supplied; raw Aadhaar is not stored in normal profile documents.
- The callable rate-limits repeated submissions and requires the profile photo plus previous work/platform proof.

SuperAdmin review:

- SuperAdmin has a `Worker Verify` tab.
- Pending rows are read from `worker_verification_submissions`.
- Reviewers can inspect safe profile fields and uploaded document links.
- Approve/reject uses `adminWorkerAction`, not direct Firestore writes.
- Approval sets worker auth/profile state to active/approved and records reviewer metadata on the submission.
- Rejection sets verification/approval state to rejected and stores a reason/reviewer audit trail.

Rules and tests:

- Firestore rules let workers read only their own verification submission and admins read submissions for review.
- Direct client create/update/delete on `worker_verification_submissions` is blocked.
- Direct worker changes to `verificationStatus`, `approvalStatus`, `status`, `adminId`, and other protected fields remain blocked.
- Firebase rules tests cover owner/admin reads, blocked non-owner reads, blocked direct approval writes, owner-only storage uploads, blocked cross-user uploads, blocked JavaScript uploads, blocked listing, and blocked cross-user file reads.
- Dev auth UI smoke covers the new worker verification fields.

Still later:

- Real Aadhaar/DigiLocker/Surepass provider integration.
- Embedded smooth-scroll signup directly on `/workers`.
- Field-operator-first verification.
- Payout/bank setup as part of onboarding.
- Worker-facing education for first 5 jobs, Phoenix path, Diamond path, and Elite eligibility.

## 42. June 2026 Audit Fixes

Status: deployed.

Fixed:

- Booking payloads now use the locked quote context for `serviceType`, `serviceId`, `city`, `areaId`, smart match, and issue details. Stale in-flight quote responses are ignored.
- Worker dashboard live/future/completed payout job lists now subscribe with `onSnapshot` and merge modern `assignedWorkerId` plus legacy `workerId` results.
- Worker location tracking finalises from refs on unmount, so live location cleanup, session status, and duration writes do not depend on stale React closures.
- Worker location persist interval reads latest refs instead of restarting on every GPS fix.
- Rating workflow now writes canonical `gigScoreEvents`, preserves `reviewText`, and uses declared reason codes such as `five_star_job` and `fair_rating_submitted`.
- Consumer booking actions now surface backend failures with toasts instead of empty catches.
- Profile loading waits for Firebase auth-state restoration before reading profile, cashback, and GigScore subscriptions.
- Worker dashboard status transitions use an explicit `nextStatus -> backend action` map.
- Tiered platform-fee brackets are normalized from SuperAdmin pricing settings instead of hardcoded in `pricing.js`.
- Service booking validates 10-digit phone numbers and retries demand quote locking once.
- Worker onboarding checklist requires confirmed login plus contact for the auth step.
- Worker dashboard listens to `worker_auth/{uid}` so payout-bank readiness is not stale.
- SuperAdmin pricing controls show editable tier fields and the effective clamped payout hold window.
- `getGigScoreFreeAccessProgress` accepts `now` for deterministic tests.
- `.editorconfig` defines LF line endings for future edits without mass-normalizing existing files.

Still open from the audit:

- Move `MyBookings` inline `BookingCard` to a module-level component.
- Decide whether to remove heavy AI deps before production cold-start optimization, or keep them because AI orchestration work is active.
- Optional later: run a dedicated line-ending normalization pass when the branch is otherwise quiet.

## 43. Known Overlap Code To Preserve For Now

Do not delete these yet. They are current compatibility code and tests may depend on them.

- `react-app/src/utils/pricing.js`
  Older online-payment pricing helper with platform/gateway fees. MVP Jobs v1 should use backend demand pricing where platform/payment fees are `0` and worker receivable equals consumer price.

- `react-app/src/utils/priceIntelligence.js`
  Static frontend price-band helper. MVP Jobs v1 should use backend `service_price_rules` and `area_demand_snapshots`.

- `react-app/src/utils/serviceCatalog.js`
  Static catalog and static price bands. Keep as UI fallback, but final MVP price should come from backend rules.

- `react-app/src/utils/workerMatching.js`
  Frontend/local worker ranking. MVP Smart Queue v1 should move final ranking to backend with Open-to-Work sessions, same-area-first, radius expansion to `15 km`, Google Maps ETA, skip history, and audit evidence.

- `react-app/src/utils/instantBooking.js`
  Older instant assignment/payment flow. MVP Jobs v1 should use queue offer TTL and direct COD/worker-UPI copy, not instant paid assignment.

- `react-app/src/components/worker/WorkerFixedRateForm.js`
  Older direct client write to `worker_availability`. MVP Jobs v1 should use backend callables for Open-to-Work sessions and price guardrails.

- `react-app/src/utils/socioScore.js`
  Compatibility alias. New code should use `GigScore`; keep alias until all imports/tests are migrated.

Cleanup rule:

- Comment legacy overlap.
- Do not delete now.
- Build new backend contracts first.
- After smoke tests pass, migrate old screens gradually.
- Remove old code only in a dedicated cleanup task.

## 44. Demand Snapshot Sweep

Status: complete for MVP scheduled refresh.

Why it exists:

- Demand pricing cannot depend only on live user events. If an area is quiet, stale snapshots could stay stale and workers may see old pricing context.
- The scheduled sweep gives every enabled `service_price_rules` row a regular refresh path while the event-driven Pub/Sub path handles spikes.

Implementation:

- `functions/index.js` exports `refreshDemandSnapshotsForAllRules`.
- The schedule is `every 60 minutes` in `Asia/Kolkata`.
- The function reads enabled `service_price_rules` rows, capped at `500` rules per MVP run.
- Each rule enqueues `scheduled_snapshot_sweep` through the existing `gigtos-demand-refresh-v1` Pub/Sub topic.
- The Pub/Sub consumer `processDemandRefreshQueue` still performs the actual recompute and writes one `area_demand_snapshots` document per city/area/service aggregation window.
- The sweep writes `platform_settings/demand_snapshot_sweep` with status, schedule, enabled rule count, queued count, failed count, cap state, topic, and last run timestamp.
- If the sweep hits the MVP cap or partially fails, it writes `admin_alerts/demand_snapshot_sweep_attention`.

Safety rules:

- No client writes are involved.
- The scheduler only enqueues refresh work; it does not fan out raw booking/user/location data.
- Existing debounce keys still prevent unlimited refresh documents.
- Pricing still falls back to normal price when snapshots are stale/missing, so the sweep improves freshness but does not create fake peak demand.

Still later:

- Live seeded-data observation after production scheduler runs.
- SuperAdmin impact preview before saving price-rule changes.

## 45. Mock And Dead-Flow Cleanup

Status: complete for the high-risk MVP gaps.

Fixed:

- `UserDashboard` no longer uses `MOCK_BOOKINGS`; it subscribes to the signed-in user's real `bookings` rows and shows honest empty states.
- `UserProfile` no longer uses `MOCK_PROFILE`, `MOCK_WALLET`, or `MOCK_REVIEWS`; it reads the signed-in user's profile, bookings, reviews, favorite worker IDs, and cashback records.
- Legacy worker `OpenWork` no longer queries open bookings directly or uses a fake 500 ms quote delay. It calls backend `listOpenWork` and submits quotes through `submitQuote`.
- `submitQuote` now supports approved workers as well as admins, stores quote actor role, worker ID, final price, message, and writes an activity log.
- Accepting a worker-submitted quote assigns that worker directly.
- `/dashboard` routes to the real consumer dashboard.
- `/mason/dashboard` routes to the existing Mason dashboard page.
- `/ride-booking` and `/ride-tracking/:rideId` redirect to `/services` because the ride vertical is not MVP-ready.
- `Chat.js` now handles permission errors cleanly when a booking chat is denied by Firestore rules.

Verified, not a current gap:

- Booking chat rules already restrict `bookings/{bookingId}/chat` to the booking owner, assigned/admin hierarchy, and superadmin.
- User private chat rules are scoped to `users/{userId}` where `userId == request.auth.uid`.
- Worker push token registration is called from Worker Dashboard; live push still depends on Firebase Web Push/VAPID setup.

Still later:

- Recurring booking cron that creates the next booking after a completed recurring booking.
- Localization provider and UI copy migration using the existing translation helpers.

## 46. AI Orchestration Safety Fix

Status: complete for the legacy Sentry AI auto-fix guardrail.

What changed:

- Legacy Sentry AI auto-fix is no longer enabled just because `GITHUB_TOKEN` exists.
- Auto-fix drafting now requires explicit runtime opt-in with `AI_AUTO_FIX_ENABLED=true` plus `GITHUB_TOKEN`.
- `aiAutoFixSentryIssue` now uses the same App Check protected callable wrapper as other privileged backend actions and still requires superadmin role.
- Code-fix drafting now calls the shared `callGigtosAiAssistant` gateway, so provider order stays Vertex AI first, Gemini API-key fallback second, deterministic failure last.
- PR CI review comments also use the shared AI gateway instead of direct Vertex SDK calls.
- The old direct `@google-cloud/vertexai` import path was removed from `functions/index.js`, avoiding a runtime failure because that package is not part of the deployed Functions dependencies.
- Stored Sentry auto-fix evidence now includes model provider/model name where available.
- The scheduled legacy Sentry sync remains ingest/backlog oriented unless explicit auto-fix opt-in is configured.

Safety rule:

- AI may summarize, draft, and open review evidence only after explicit opt-in. It must not merge, deploy, mark incidents resolved, change booking/user/payment state, or bypass human review.

## 47. AI Knowledge Store MVP

Status: complete for Firestore summary-chunk RAG foundation.

What changed:

- Added backend-owned `ai_knowledge_sources` and `ai_knowledge_chunks`.
- Each chunk stores sanitized summary text, source type, source ID, content hash, keywords, trust level, sensitivity label, evidence IDs, freshness timestamps, and `rawPayloadStored: false`.
- Added scheduled `refreshAiKnowledgeStore` every `6 hours` in `Asia/Kolkata`.
- Added SuperAdmin action `refresh_ai_knowledge_store` through the App Check protected `superadminAction`.
- Added Firestore rules so AI knowledge sources/chunks are admin-readable and backend-written only.
- Added Firestore indexes for future retrieval by source/status/freshness and keyword/status/freshness.
- Seeded the first refresh through Firebase Functions shell after deploy.

Current sources:

- Static AI model gateway policy summary.
- Static RAG privacy policy summary.
- Static MVP marketplace rules summary.
- Static incident operations policy summary.
- Sanitized `sentry_issue_summaries`.
- Sanitized `ai_incident_summaries`.
- Safe platform health summaries from `platform_settings`.

Still later:

- Use retrieved chunks inside model prompts only after citation thresholds and no-evidence escalation are enforced.
- Add TTL/retention cleanup for stale chunks.
- Add repo/docs source inventory refresh instead of only static policy summaries.
- Weekly compaction of resolved incidents into reusable patterns.
- Move to Vertex Vector Search only if Firestore summary chunks are not enough for scale, latency, or retrieval quality.

## 48. Jira Handoff Traceability Bridge

Status: complete for MVP Firestore/RAG traceability.

What changed:

- Added `mirrorJiraHandoffToKnowledge()` in Functions.
- Every Sentry/monitoring Jira handoff now mirrors a sanitized summary into `ai_knowledge_chunks`.
- The mirrored record uses trust level `jira_handoff_summary`.
- Mirrored summaries include workflow ID, source, status, severity, suggested owner, Jira key presence, and safe evidence IDs.
- The mirror runs for linked, pending-configuration, failed, and newly-created handoff states.
- This keeps incident evidence available to future RAG/AI workflows even when Jira credentials are missing and the handoff is only pending configuration.

Deployment:

- Deployed updated `syncSentryIssueSummaries`.
- Deployed updated `monitorSentryPipelineHealth`.
- Deployed updated `monitorAiModelGatewayHealth`.
- Deployed updated `sendSentryCanaryHeartbeat`.
- Deployed updated `refreshAiKnowledgeStore`.
- Deployed updated `superadminAction`.
- Invoked `monitorAiModelGatewayHealth()` once through Firebase Functions shell after deployment.

Still later:

- Write PR links, test artifacts, rollout decisions, and post-release results back to Jira.
- Auto-reopen or update Jira when recurrence checks detect the same error signature.

## 49. AI Ops Alert Delivery And Usage Telemetry

Status: complete for MVP backend coverage.

What changed:

- Added `deliverFounderOpsAlert()` with dedupe.
- Delivery evidence is stored in backend-owned `ops_alert_deliveries`.
- Alerts can send formatted email to `SUPERADMIN_EMAIL`.
- Alerts can send SMS to `SUPERADMIN_PHONE` / `FOUNDER_ALERT_PHONE` when Twilio is configured.
- `OPS_ALERT_DEDUPE_MINUTES` controls repeated alert suppression.
- AI gateway degradation/failure now sends external founder delivery in addition to `admin_alerts` and Jira/RAG handoff.
- Sentry pipeline failure now sends external founder delivery.
- Sentry canary monitor setup failure now sends external founder delivery.
- Added scheduled `monitorAiOrchestrationFreshness` every `30 minutes`.
- Freshness monitor checks:
  - `platform_settings/ai_model_gateway_health`
  - `platform_settings/sentry_issue_ingest`
  - `platform_settings/sentry_canary`
  - `platform_settings/ai_knowledge_store`
- Freshness failures create `admin_alerts`, Jira/RAG handoffs, and external founder delivery.
- Added SuperAdmin action `run_ai_orchestration_freshness_check`.

Usage telemetry:

- Shared AI gateway now writes `ai_model_usage_events`.
- Shared AI gateway now writes daily aggregates in `ai_model_usage_daily`.
- Usage evidence includes context, provider, model, latency, estimated input/output token units, fallback count, failure count, and optional configured cost estimates.
- Weekly AI orchestration evaluation writes `ai_orchestration_evaluations/{weekKey}` and `platform_settings/ai_orchestration_weekly_eval`.
- `evaluateAiOrchestrationWeekly` runs every Monday 08:00 IST and alerts/handoffs if failure or fallback rates cross configured thresholds.
- Optional env vars:
  - `VERTEX_AI_COST_MICROS_PER_1M_TOKENS`
  - `GEMINI_COST_MICROS_PER_1M_TOKENS`
  - `AI_EVAL_FAILURE_RATE_THRESHOLD`
  - `AI_EVAL_FALLBACK_RATE_THRESHOLD`

Deployment:

- Deployed updated AI gateway, Sentry summarizer, health monitors, freshness monitor, AI knowledge refresh, SuperAdmin action, auto-fix callable, PR review webhook, Firestore rules, and Firestore indexes.
- Invoked `monitorAiModelGatewayHealth()` and `monitorAiOrchestrationFreshness()` once through Firebase Functions shell after deploy.

Still external setup:

- Rotate the Brevo SMTP key in the Brevo account console, then update Functions `.env`/runtime and redeploy alert functions.
- Optional: set `SUPERADMIN_PHONE` and Twilio credentials.
- Optional: set cost-per-million-token env values for currency estimates.

## 50. AI Agent Contracts

Status: complete for MVP documentation/config contract.

Added `docs/AI_ORCHESTRATION_AGENT_CONTRACTS.md`.

It defines:

- Global AI orchestration rules.
- Shared JSON handoff schema.
- Log Ingestor contract.
- Incident Classifier contract.
- RCA Analyst contract.
- Fix Planner contract.
- Coder Agent contract.
- Tester Agent contract.
- Security Reviewer contract.
- Compliance Reviewer contract.
- Release Manager contract.
- Post-Release Verifier contract.
- Knowledge Curator contract.
- Mythos supervisor check schema.

Important boundary:

- Current runtime implements deterministic gates, backend AI gateway, Sentry/Jira handoffs, Firestore RAG summaries, external ops alerts, and usage telemetry.
- Future LangGraph/CrewAI/Cloud Run agents must obey this contract before they can be connected.

## 51. AI Task Routing And Evaluation

Status: complete for MVP governance.

Added `docs/AI_TASK_ROUTING_AND_EVAL.md`.

It defines:

- Task-to-model matrix for known errors, log summaries, RCA, code understanding, code patch drafting, test planning, security review, Jira ticket writing, release recommendation, and consumer booking help.
- What must run without AI first: known error grouping, duplicate detection, threshold alerts, build/test pass-fail, secret detection, dependency vulnerabilities, CodeQL findings, Firebase rules tests, schema/index drift checks, basic Jira routing, uptime checks, price caps, payout holds, permissions, and booking state transitions.
- Where AI adds value: confusing RCA, related-incident summaries, code-vs-policy comparison, human-readable Jira packets, release risk summaries, and service disambiguation.
- Escalation rules from deterministic code to Vertex/Gemini summaries to stronger model/human review.
- Quality evaluation metrics: accuracy, hallucination rate, useful-ticket rate, duplicate-ticket rate, fix correctness, missed critical issues, human overrides, latency, token estimates, and optional configured cost.
- Bad-context safety rules for prompt injection from logs, user text, chat, uploads, screenshots, Sentry titles, and Jira comments.

Current enforcement:

- Backend AI gateway records usage telemetry in `ai_model_usage_events` and `ai_model_usage_daily`.
- AI health/freshness monitor alerts when model health, Sentry ingest, canary, or knowledge-store refresh becomes stale or degraded.
- Deterministic CI/security gates remain the production authority.

## 52. Consumer AI Manual

Status: complete for MVP policy.

Added `docs/CONSUMER_AI_MANUAL.md`.

It defines:

- Gito AI purpose: service selection, pricing explanation, safe availability help, booking preparation, support explanation, and approved memory usage.
- Blocked actions: exposing internals, revealing another user's data, exact-location leakage, refund/payout/block/GigScore decisions, final price decisions outside backend rules, and sensitive action finalization without backend confirmation.
- Allowed and blocked model-context data.
- Basic and Premium Concierge response examples.
- No-worker recovery menu.
- Usage limits and cost policy by support type.
- Conversion/outcome tracking plan.
- Action safety rules for booking/payment-impacting flows.

Important boundary:

- Consumer AI can recommend, draft, search, compare, and prepare.
- Backend rules and explicit user confirmation must perform final sensitive actions.

## 53. AI Recurrence Detection

Status: complete for MVP Sentry recurrence monitoring.

What changed:

- Added backend-owned `ai_recurrence_signatures`.
- Added backend-owned `ai_recurrence_checks`.
- `syncSentryIssueSummaries` now upserts recurrence signatures for ingested Sentry summaries.
- Added scheduled `detectAiIssueRecurrence` every day at 09:00 IST.
- Added SuperAdmin action `run_ai_recurrence_detection`.
- Recurring high-impact signatures open SuperAdmin alerts, external founder delivery, and deterministic Jira/RAG handoffs.
- Firestore rules make recurrence collections admin-readable and backend-written only.

Boundary:

- This is deterministic recurrence detection, not autonomous fix approval.
- Full autonomous release-manager runtime remains future work, but PR/test evidence writeback and 14-day stability archival are now covered for MVP backend orchestration.

## 54. AI Orchestration Completion Pass

Status: complete for MVP backend orchestration.

What changed:

- AI code-fix drafts now run an independent verifier before any PR branch is created.
- Verifier-blocked drafts are stored as `verifier_blocked` and do not open PRs.
- AI PR test reviews now run an independent verifier before a test-passing status is promoted.
- PR/test evidence is written back into `jira_issue_handoffs` as `releaseEvidence`.
- If a Jira key exists, the backend adds a Jira comment with PR, build, test, verifier, and rollout evidence.
- Release evidence is mirrored into `ai_knowledge_chunks` through the existing Jira/RAG bridge.
- Added monthly model governance collection `ai_model_governance_reviews`.
- Added scheduled `reviewAiModelGovernanceMonthly` on the first day of each month at 09:00 IST.
- Added SuperAdmin action `run_ai_monthly_governance_review`.
- Monthly governance recommends `keep_current_routing`, `review_vertex_configuration`, `downgrade_or_fix_provider`, or `collect_more_data`.
- Recurrence checks now archive open watches after 14 clean days as `stable_archived`.
- Fixed the AI auto-fix callable role gate to accept the real `superadmin` role while keeping the pipeline opt-in only.
- Added scheduled `checkVertexVectorSearchReadiness`, which writes `platform_settings/vertex_vector_search` and opens a setup alert until the external Vertex index/endpoint/deployed-index IDs are configured.
- Added scheduled `runAiAgentRuntimeReadinessCycle`, which refreshes RAG, checks Vertex Vector Search, checks model gateway health, checks orchestration freshness, prepares an AI release packet, writes `ai_agent_runtime_cycles`, and stops at human approval or external setup blockers.
- Added SuperAdmin actions `check_vertex_vector_search_readiness` and `run_ai_agent_runtime_cycle`.
- Added Firestore rules for `ai_agent_runtime_cycles`: admin-readable and backend-written only.
- Added `npm run audit:ai-ops`, which reads the latest browser Heart Monitor report and writes `react-app/docs/AI_OPS_EXTERNAL_SETUP_LATEST.md` with exact external setup blockers for Sentry, App Check, Jira, Vertex Vector Search, and Cloud Run/LangGraph runtime.
- `npm run smoke:heart` now includes the AI/Ops external setup audit after the browser render monitor.
- Added MVP cost-control routing: `AI_COST_MODE=lean`, `GEMINI_API_MODEL=gemini-2.5-flash-lite`, capped text input/output, Vertex text only through `AI_VERTEX_CONTEXT_ALLOWLIST`, and Vertex photo review only when `AI_ENABLE_VERTEX_PHOTO_REVIEW=true`.

Boundaries:

- Production deploy, merge, payout, payment, security, GigScore, and identity changes still require human approval.
- Firestore summary chunks remain the source of truth until Vertex Vector Search external setup is provided.
- Full Cloud Run/LangGraph action execution is locked behind external setup: `AI_AGENT_RUNTIME_MODE`, `AI_AGENT_RUNTIME_URL`, `AI_AGENT_RUNTIME_SERVICE_ACCOUNT`, Vertex Vector Search IDs, Sentry API config, Jira config, GitHub token, and explicit human approval.
