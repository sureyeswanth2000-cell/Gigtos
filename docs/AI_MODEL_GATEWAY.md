# AI Model Gateway

## Decision

All Gigtos AI features must call models through backend-controlled gateways only. React, PWA, and mobile clients must never call Vertex AI, Gemini, mem0, LangChain, Jira AI, or future agent services directly.

Consumer AI and internal agentic ops are separate systems. Consumer AI may guide booking, pricing explanation, service selection, and safe support triage. Internal agentic ops may summarize incidents, draft evidence, prepare Jira/PR handoffs, and review CI output, but must stay behind backend identity, App Check where applicable, deterministic policy gates, and human review.

## Provider Order

Early/testing stage uses cost-aware routing, not blanket Vertex-first routing:

1. Deterministic backend rules and cached/sanitized summaries.
2. Gemini API with `GEMINI_API_MODEL=gemini-2.5-flash-lite` for allowed low/medium-risk text contexts.
3. Vertex AI only for explicitly allowlisted contexts or later enterprise mode.
4. Deterministic backend fallback when no paid model is available or a model fails.

## Current Implementation

- Cost controls are documented in `docs/AI_COST_CONTROL_PLAN.md`.
- `aiBookingAssistant` is the active backend AI gateway for Consumer AI.
- Sanitized high-severity Sentry/Jira incident summaries use the same backend AI gateway.
- Incident summarization is capped to the first 10 high-severity issues per ingest run to control cost and noise.
- Text model routing is controlled by `AI_COST_MODE`.
  - `lean` is the MVP default: Gemini API/Flash-Lite for allowed text contexts, Vertex only for `AI_VERTEX_CONTEXT_ALLOWLIST`.
  - `gemini_first` allows Gemini API for most text contexts while still keeping Vertex explicit.
  - `vertex_first` restores enterprise Vertex-first routing.
  - `off` skips paid text-model calls and records deterministic fallback usage.
- Vertex AI is available when `AI_MODEL_PROVIDER=vertex` and `VERTEX_AI_PROJECT_ID` are configured, but `lean` mode does not call it unless the context is allowlisted.
- Default Vertex settings:
  - `VERTEX_AI_LOCATION=us-central1`
  - `VERTEX_AI_MODEL=gemini-2.5-flash`
- Gemini API key remains backend-only through `GEMINI_API_KEY`; `GEMINI_API_MODEL` defaults to `gemini-2.5-flash-lite` for early-stage cost control.
- Vision/photo Vertex calls are disabled unless `AI_ENABLE_VERTEX_PHOTO_REVIEW=true`; otherwise metadata/deterministic fallback is used.
- `consumer_ai_audits` records `modelProvider` and `modelName`.
- Legacy Sentry AI auto-fix is safe-disabled by default. It requires `AI_AUTO_FIX_ENABLED=true` plus `GITHUB_TOKEN` before it can draft PRs.
- `aiAutoFixSentryIssue` is App Check protected and superadmin-only. Its code-fix drafting and PR test-review comments use the same Vertex-first/Gemini-fallback gateway instead of direct model SDK calls.
- `legacySyncSentryAutoFixBacklog` remains an ingest/backlog sync unless explicit auto-fix opt-in is configured.
- Deployed Functions are App Check enforced. Live model confirmation must come from a real browser session with a valid App Check token; raw REST/Node calls correctly return `401`.
- `monitorAiModelGatewayHealth` runs every 30 minutes from Firebase backend, checks whether Vertex answers, writes `platform_settings/ai_model_gateway_health`, and opens `ai_model_gateway_degraded` when the gateway falls back or fails.
- SuperAdmin can manually run the same backend health check through `superadminAction`.
- MVP RAG foundation uses backend-owned Firestore summary chunks, not full Vertex Vector Search yet:
  - `ai_knowledge_sources`
  - `ai_knowledge_chunks`
  - `platform_settings/ai_knowledge_store`
- `refreshAiKnowledgeStore` runs every 6 hours and can also be triggered through SuperAdmin action `refresh_ai_knowledge_store`.
- Current RAG sources are curated static AI policies, sanitized Sentry issue summaries, sanitized AI incident summaries, and safe platform health summaries. Raw private user data is excluded.
- `checkVertexVectorSearchReadiness` runs daily and writes `platform_settings/vertex_vector_search`; Firestore summary chunks remain active fallback until the Vertex index, endpoint, and deployed index IDs are configured.
- `runAiAgentRuntimeReadinessCycle` runs daily and writes `ai_agent_runtime_cycles` plus `platform_settings/ai_agent_runtime`; it refreshes RAG, checks model health, checks freshness, prepares a release packet, and stops at human approval/external setup gates.
- `monitorAiOrchestrationFreshness` runs every 30 minutes and checks freshness/status for AI model health, Sentry issue ingest, Sentry canary, AI knowledge-store refresh, Vertex Vector Search readiness, and the AI agent runtime readiness cycle.
- External founder delivery writes `ops_alert_deliveries` and sends to `SUPERADMIN_EMAIL`, with optional `SUPERADMIN_PHONE`/Twilio SMS. Alerts are deduped by `OPS_ALERT_DEDUPE_MINUTES`.
- The shared model gateway writes usage evidence to `ai_model_usage_events` and `ai_model_usage_daily`, including context, provider, model, latency, estimated token units, fallback count, failure count, and optional configured cost estimates.
- `evaluateAiOrchestrationWeekly` runs every Monday 08:00 IST, summarizes `ai_model_usage_daily`, writes `ai_orchestration_evaluations` and `platform_settings/ai_orchestration_weekly_eval`, and alerts/handoffs when fallback or failure rates cross configured thresholds.

## Required Runtime Setup

- Enable Vertex AI API in the Google Cloud project.
- Give the Firebase Functions runtime service account permission to call Vertex AI.
- Configure backend runtime environment:
  - `AI_COST_MODE=lean` for MVP/testing
  - `GEMINI_API_MODEL=gemini-2.5-flash-lite`
  - `AI_MAX_INPUT_CHARS=6000`
  - `AI_MAX_OUTPUT_TOKENS=512`
  - `AI_MODEL_PROVIDER=vertex`
  - `VERTEX_AI_PROJECT_ID`
  - `VERTEX_AI_LOCATION`
  - `VERTEX_AI_MODEL`
- Keep `GEMINI_API_KEY` for the low-cost MVP text path. Move contexts to Vertex only when reliability/privacy/SLA need it.
- Keep the GitHub Pages CSP allowing `https://*.cloudfunctions.net`, `https://www.google.com`, and `https://www.recaptcha.net` in `connect-src` so App Check and callable functions can work.
- Optional Vertex Vector Search:
  - `VERTEX_VECTOR_SEARCH_REGION`
  - `VERTEX_VECTOR_SEARCH_INDEX_ID`
  - `VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT`
  - `VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID`
- Optional full agent runtime:
  - keep `AI_AGENT_RUNTIME_MODE=dry_run` until Cloud Run/LangGraph service accounts are ready
  - `AI_AGENT_RUNTIME_URL`
  - `AI_AGENT_RUNTIME_SERVICE_ACCOUNT`

## Guardrails

- AI may explain, summarize, triage, and guide.
- AI must not decide final price, worker assignment, booking confirmation, refund, payout, user blocking, deployment, or GigScore changes.
- AI input must be redacted before model calls.
- Exact location, full phone, bank details, payment secrets, auth tokens, private logs, and raw user evidence stay out of model context.
- AI output must remain evidence-linked in audits, Sentry summaries, Jira handoffs, or future Vertex knowledge records.
- AI-generated fixes must only create draft evidence/PRs for human review; they must never deploy, merge, change user state, or mark incidents resolved automatically.
- LangGraph/Cloud Run execution may be connected later, but the active backend runtime is currently readiness/dry-run only. It never deploys, merges, writes payment/security state, or marks incidents resolved automatically.

## Next Expansion

- Add richer Sentry/Jira recurrence summaries and daily digests through the same Vertex-first gateway.
- SuperAdmin includes an `AI Health` tab for provider, model, Vertex project/location, last check, safe reply/error, and fallback status.
- Add a small model-routing config for log summarizer, support triage, consumer assistant, and future release-agent roles.
- Configure optional `VERTEX_AI_COST_MICROS_PER_1M_TOKENS` and `GEMINI_COST_MICROS_PER_1M_TOKENS` if currency-like cost estimates are needed; otherwise the system still records token-unit estimates and latency.
- Configure optional `AI_EVAL_FAILURE_RATE_THRESHOLD` and `AI_EVAL_FALLBACK_RATE_THRESHOLD` if weekly model governance thresholds need tuning.
- Connect model prompts to retrieved `ai_knowledge_chunks` only after citation thresholds and no-evidence escalation rules are enforced.
- Move from Firestore summary chunks to Vertex Vector Search only when scale, latency, or retrieval quality requires it; readiness is now checked daily so missing setup is explicit.
