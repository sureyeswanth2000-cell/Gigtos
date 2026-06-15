# AI Cost Control Plan

Status: MVP/testing policy active.

## Core Rule

Do not use Vertex AI as the default model during early testing. Use this order:

1. Deterministic code and cached Firestore summaries.
2. Gemini API with `gemini-2.5-flash-lite` for low/medium-risk text help.
3. Vertex AI only for explicitly allowlisted contexts or later enterprise/SLA mode.
4. Metadata fallback if the model is unavailable.

## Active Runtime Defaults

- `AI_COST_MODE=lean`
- `GEMINI_API_MODEL=gemini-2.5-flash-lite`
- `AI_MAX_INPUT_CHARS=6000`
- `AI_MAX_OUTPUT_TOKENS=512`
- `AI_VERTEX_CONTEXT_ALLOWLIST=` empty by default
- `AI_ENABLE_VERTEX_PHOTO_REVIEW=false`

## Use Code, Not AI

- Pricing calculation and demand levels.
- Smart Queue ranking.
- GigScore calculation.
- Role/security checks.
- Firebase rules validation.
- Known Sentry duplicate grouping.
- Health/freshness thresholds.
- Booking/payment/payout state transitions.
- Simple FAQ and greeting/catch-all replies when local fallback can answer.

## Use Gemini API Mostly

- Consumer booking guidance when deterministic fallback is not enough.
- Service explanation and next-step wording.
- High-severity Sentry summary after deterministic classifier flags it.
- Release packet summary for human review.
- AI verifier text for disabled/manual auto-fix flows.

## Use Vertex Only Later Or With Explicit Allowlist

- Enterprise/privacy-sensitive production consumer AI after traffic proves value.
- Multimodal photo triage/review after there is enough usage to justify cost.
- Stronger incident reasoning when the deterministic/Sentry/Gemini path cannot explain a high-impact issue.
- Cloud Run/LangGraph agent execution after service accounts and human gates are ready.

## Current Cost Risk Hotspots

- Consumer AI chat can grow with user traffic.
- Scheduled health checks can waste tokens if they call Vertex every 30 minutes.
- Photo review can become expensive quickly because images add input tokens.
- Release packets and agent cycles should stay deterministic-first.
- Sentry summarization should stay high-severity only, capped per run.

## Guardrails

- Shared text gateway routes by context and cost mode.
- Skipped deterministic calls are recorded as `skipped`, not failures.
- Daily usage records track estimated input/output tokens and configured cost estimates.
- Photo Vertex review requires `AI_ENABLE_VERTEX_PHOTO_REVIEW=true`.
- Vertex text requires `AI_VERTEX_CONTEXT_ALLOWLIST`.
- Full autonomous runtime remains dry-run/human-review only.

## When To Upgrade

Move one context from Gemini to Vertex only when all are true:

- The feature has real user value.
- Gemini/Flash-Lite quality is not enough.
- The output remains advisory, not a final decision.
- Daily cost is within founder-approved budget.
- Smoke tests and audit logs are passing.
