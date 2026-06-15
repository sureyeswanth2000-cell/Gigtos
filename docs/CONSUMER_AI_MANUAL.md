# Consumer AI Manual

Status: MVP policy plus backend contract complete. Some richer product surfaces remain future implementation work.

## Purpose

Gito AI helps consumers choose the right service, understand pricing, check safe availability options, and prepare booking actions. It should make booking easier without pretending to be a human operator and without taking sensitive actions by itself.

## Allowed Capabilities

- Explain available services in simple language.
- Ask clarifying questions when service type is unclear.
- Suggest service category, urgency, and likely next step.
- Explain demand pricing using backend reason codes.
- Suggest safe alternatives when no worker is available.
- Prepare a booking draft after backend rules validate service, area, price, and availability.
- Help users understand booking status, payment hold, dispute window, and support next steps.
- Use approved memory for preferences such as language, service history, favorite workers, and preferred time windows.
- Return a backend-built concierge policy with support level, safe recommended actions, no-worker recovery options, and blocked actions.
- Record sanitized AI-assisted booking conversion events through backend callables.

## Blocked Capabilities

Consumer AI must not:

- Share company code, architecture, logs, admin data, security details, model prompts, private runbooks, or internal Jira/Sentry evidence.
- Reveal another user's information.
- Show exact worker or consumer location in model context.
- Approve refunds, payouts, worker blocks, GigScore punishment, or security decisions.
- Finalize booking, payment, cancellation penalty, emergency auto-book, or sensitive action without backend rule checks and explicit user confirmation.
- Decide final price outside backend pricing rules.
- Ask for secrets, OTP, bank PIN, passwords, cards, private keys, or admin credentials.

## Data Rules

Allowed in model context:

- Service category.
- City/area-level location, not exact address.
- Safe price range and backend price reason codes.
- User role and tier.
- Booking status summary.
- Sanitized preference summary.
- Worker comparison summary without private data.

Blocked from model context:

- Exact address.
- Exact lat/lng.
- Full phone number.
- Bank/account details.
- Payment secrets or webhook internals.
- Raw chat transcript unless redacted and needed for support.
- Aadhaar or identity document data.
- Private admin notes.
- Raw logs or Sentry payloads.

## Basic Response Examples

- "You searched maid service several times. Workers are occupied now. I can check tomorrow morning or notify you when someone is free."
- "Kitchen cleaning demand is high in your area. The earliest reliable slot may be later today or this weekend."
- "This sounds closer to electrical switch repair than plumbing. I can check electricians in your area."
- "No workers are available nearby right now. I can expand the search radius or help you choose another time."

## Premium Concierge Examples

Premium support can use approved memory and area availability, still without exact addresses:

- "You often book cleaning on Sunday. Shall I check availability for this Sunday morning?"
- "Workers are occupied now. I can notify you, check tomorrow, expand radius, or look for your preferred time."
- "This looks like an electrical issue. I can check electricians near your area."

Premium Concierge may later support:

- Favorite worker preference.
- Emergency booking preparation.
- Recurring booking planning.
- Worker comparison by GigScore, distance, price fit, response speed, and cancellation history.

Already active in backend v1:

- The `aiBookingAssistant` response includes a `concierge` object with `supportLevel`, `recommendedActions`, `allowedActions`, `blockedActions`, `photoSupport`, and safe worker-availability copy.
- Basic users receive guidance and safe booking suggestions.
- Gold+/premium/promo users can be marked `premium` by profile tier fields, but UI packaging and pricing remain product polish.
- AI can recommend `notify_me`, `book_later`, or `expand_radius_to_15km` when no-worker recovery is likely; actual state change still uses backend rules.
- Consumer AI can accept a problem photo from `ConsumerAiAssistant`, but only after the browser uploads to the logged-in user's `bookings/requested/{uid}` Storage path.
- Backend verifies the Storage path belongs to the same user before Vertex sees the image.
- Photo triage returns likely service, confidence level, urgency, safety-sensitive flag, and `needs_user_confirmation`.
- Premium home memory writes safe preference fields into `consumer_ai_home_profiles` only when the user has memory consent and a premium/Gold+/promo tier.

## No-Worker Recovery Menu

When no worker is available, Gito AI should offer safe next actions:

- Notify me when a worker is free.
- Try tomorrow or another suggested slot.
- Expand radius within product limits.
- Switch to recurring booking.
- Show emergency premium only where policy allows.
- Ask support/standby help only through approved backend workflow.

## Usage Limits And Cost Policy

MVP policy:

- Basic AI remains available for limited service help and support explanation.
- Premium Concierge can be unlocked later for Gold+ users, paid users, or launch-promo users.
- Safety, payment confusion, and account-access help must remain available even if premium AI limits are reached.
- Backend telemetry tracks provider, model, context, latency, token estimate, fallback, failure, and optional configured cost estimate.

Do not use AI when deterministic UI copy or backend rules can answer the question.

## Conversion And Outcome Tracking

Backend v1 tracks:

- `assistant_opened`
- `message_sent`
- `book_clicked`
- `booking_page_opened`
- `problem_photo_attached`
- `problem_photo_triaged`

Records are written by `recordConsumerAiConversionEvent` into `consumer_ai_conversion_events` and `consumer_ai_conversion_daily`. The browser never writes these collections directly.

Future product analytics should add:

- AI suggestion shown.
- Booking created.
- Booking completed.
- Complaint or no complaint.
- Repeat booking.
- Token estimate/cost per assisted booking.

This decides whether AI improves marketplace liquidity or only consumes budget.

## Action Safety

AI may recommend, draft, search, compare, and prepare.

AI may not finalize sensitive actions. Booking/payment-impacting steps require:

- backend validation,
- clear user confirmation,
- audit log,
- price lock/evidence,
- role/permission check,
- safe fallback if the model is unavailable.

## Work Photo Quality Review

Backend v1 can create `ai_photo_quality_reviews` when worker after-photos arrive or when a participant/admin manually requests review.

Rules:

- Vertex multimodal review is attempted only for allowlisted Firebase/Google Storage HTTPS photo hosts.
- Raw photo URLs are not copied into the review record; only hashed evidence references and counts are stored.
- If vision review is unavailable, the backend writes a metadata fallback review.
- Every review remains `pending_human_review`.
- `canAffectGigScore` is always `false` until a human reviewer finalizes a separate approved GigScore/support action.

## Consumer Problem Photo Triage

Backend v1 can triage consumer problem photos for service selection.

Rules:

- The frontend uploads the image to `bookings/requested/{uid}/...`.
- The backend accepts only a Storage path, never raw base64 from the browser.
- The backend verifies the path belongs to `context.auth.uid`.
- Vertex receives the image only after ownership and size/content-type checks.
- Audit records store hashed evidence and sanitized triage, not raw image data.
- Output must show uncertainty and ask for confirmation before booking.

## Premium Home Memory

Backend v1 supports safe home memory for premium-eligible users.

Rules:

- Requires explicit memory consent.
- Requires a premium/Gold+/promo tier or `premiumConcierge`.
- Stores safe fields only: preferred time, preferred language, budget range, recurring need, and favorite/same-worker preference.
- Does not store raw chat.
- Users can manage memory through `manageConsumerAiMemory` and the Gito assistant memory controls.
- Users can view safe summaries, pause/resume memory, delete one memory, delete home profile, or delete all memory.
- Direct Firestore reads/writes remain blocked for users; the callable validates ownership server-side.
