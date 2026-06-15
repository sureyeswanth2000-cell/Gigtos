# Sentry Log Monitoring

Status: optional and privacy-filtered.

## What Sentry Watches

- Frontend React render crashes through `ErrorBoundary`.
- Frontend auth role lookup failures.
- Frontend filters drop user-side offline/network noise before upload.
- Backend Firebase callable failures through the shared `appCheckOnCall` wrapper.
- Razorpay webhook runtime failures.
- Backend unhandled rejections and uncaught exceptions.
- Optional scheduled issue ingest writes sanitized Sentry summaries for founder/AI/Jira workflows.

## Privacy Rules

- Do not send Vertex/Gemini keys, Firebase Admin credentials, payment secrets, OTP/PIN, cookies, auth headers, bank details, full phone numbers, exact addresses, or exact latitude/longitude to Sentry.
- Frontend Sentry user context stores only user ID and role.
- Backend Sentry user context stores only caller UID and role when available.
- Messages, breadcrumbs, request data, and extra context pass through redaction before upload.

## Frontend Noise Filter Rules

Drop before upload:

- Browser is offline (`navigator.onLine === false`).
- User/browser network failures such as `Failed to fetch`, `NetworkError`, `Network request failed`, `Load failed`, `ERR_INTERNET_DISCONNECTED`, `ERR_NETWORK_CHANGED`, `ERR_CONNECTION_RESET`, and `ERR_CONNECTION_TIMED_OUT`.
- Firebase offline/unavailable errors caused by client network loss.
- User-aborted/cancelled requests such as `AbortError` and request aborted.
- Browser extension frames/URLs such as `chrome-extension://`, `moz-extension://`, and `safari-web-extension://`.

Keep and alert:

- Backend/function errors.
- Firebase `permission-denied`, auth/App Check failures, repeated 4xx/5xx, booking/worker/payment/payout failures.
- Route render crashes, data shape bugs, and role/rules regressions.

Recommended Sentry alert rules:

- Do not page/alert for issues matching dropped network/offline patterns.
- Page/high alert when issue title or culprit contains `booking`, `worker accept`, `payment`, `payout`, `auth`, `permission`, `AppCheck`, `superadmin`, or `Razorpay`.
- Create Jira only for `high` severity summaries or repeated unresolved issues above the configured event threshold.

## Runtime Setup

Frontend:

```bash
REACT_APP_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
REACT_APP_SENTRY_ENVIRONMENT=production
REACT_APP_SENTRY_RELEASE=<commit-or-version>
REACT_APP_SENTRY_TRACES_SAMPLE_RATE=0
```

The GitHub Pages CSP must keep Sentry ingest hosts in `connect-src`:

- `https://*.sentry.io`
- `https://*.ingest.sentry.io`
- `https://*.ingest.de.sentry.io`

Without these hosts, the React SDK initializes but browser envelopes are blocked before they reach Sentry.

The local route smoke and live smoke scripts assert that these hosts remain present in the deployed CSP.

Backend:

```bash
SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=<commit-or-version>
```

Scheduled issue ingest:

```bash
SENTRY_AUTH_TOKEN=sntrys_your_read_token_here
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECTS=gigtos-frontend,gigtos-functions
SENTRY_ISSUE_QUERY=is:unresolved
SENTRY_API_BASE_URL=https://sentry.io/api/0
SENTRY_CANARY_ENABLED=true
SENTRY_CANARY_MONITOR_SLUG=gigtos-backend-sentry-canary
```

The scheduled function `syncSentryIssueSummaries` runs every 15 minutes when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECTS` exist. It stores only sanitized summaries in:

- `sentry_issue_summaries`
- `ai_incident_summaries`
- `jira_issue_handoffs` for high-severity incident handoff state
- `admin_alerts` for high severity issues
- `platform_settings/sentry_issue_ingest` for ingest health

MVP Firebase handoff mode:

```bash
JIRA_HANDOFF_MODE=firebase
```

In MVP, high-severity issues remain inside Firestore `jira_issue_handoffs` with `status: firebase_handoff`. SuperAdmin and AI orchestration can use that collection as the issue tracker without an external Atlassian account.

Optional Atlassian Jira creation later:

```bash
JIRA_HANDOFF_MODE=atlassian
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=founder@example.com
JIRA_API_TOKEN=your_jira_api_token
JIRA_PROJECT_KEY=GIG
JIRA_ISSUE_TYPE=Bug
```

If `JIRA_HANDOFF_MODE=atlassian` and Jira variables are missing, high-severity issues remain in `jira_issue_handoffs` with `status: pending_configuration`. If Jira variables exist, the backend creates one Jira issue per deterministic Sentry workflow and stores the Jira key/URL in the handoff.

Pipeline health:

- `monitorSentryPipelineHealth` runs every 30 minutes.
- If Sentry ingest is failed, stale, or partially configured, it creates/updates SuperAdmin alert `sentry_pipeline_down`.
- The same failure creates a backend-owned Jira handoff with workflow ID `SENTRY_PIPELINE_DOWN`.
- The older Sentry auto-fix backlog scheduler uses `legacySyncSentryAutoFixBacklog`; it must not reuse the `syncSentryIssueSummaries` export name.
- `sendSentryCanaryHeartbeat` runs every 60 minutes and uses Sentry Cron check-ins, not fake error messages, to prove the backend DSN can still send to Sentry.
- Canary state is stored in `platform_settings/sentry_canary` with `rawPayloadStored: false`.
- The canary verifies that Sentry can read the Cron monitor. If the monitor is missing or the token cannot verify it, the function stores `needs_monitor_setup` and opens SuperAdmin alert `sentry_canary_needs_monitor_setup`.
- Sentry Cron monitor slug `gigtos-backend-sentry-canary` exists under the backend `node` project, and `sendSentryCanaryHeartbeat()` was invoked successfully after setup.
- SuperAdmin `AI/Ops Health` reads `platform_settings/sentry_issue_ingest` and `platform_settings/sentry_canary` so founder/operators can see Sentry status without opening Firestore.
- SuperAdmin can run `run_sentry_canary_check` from `AI/Ops Health` after recent reauth to verify the Sentry Cron monitor immediately after setup.

## Recurrence Detection

- `syncSentryIssueSummaries` upserts sanitized recurrence baselines in `ai_recurrence_signatures`.
- `detectAiIssueRecurrence` runs every day at 09:00 IST.
- Recurring high-impact signatures write `ai_recurrence_checks`, open SuperAdmin alerts, send founder delivery, and create deterministic Jira/RAG handoffs.
- SuperAdmin can run `run_ai_recurrence_detection` manually.
- Raw Sentry payloads are still not stored; recurrence evidence uses workflow ID, fingerprint, summary ID, project, severity, event count, user count, and safe evidence IDs only.

## MVP Alert Policy

- Alert immediately for login failures, booking failures, worker accept/start/complete failures, payment webhook failures, app down, and repeated permission failures.
- Vertex AI summarizes sanitized high-severity Sentry issue titles and stack fingerprints through the backend AI gateway, with Gemini API-key mode as fallback only. No model may receive raw private event payloads.
- Sentry groups incidents; Jira/TODO remains the task truth when a fix is needed.
