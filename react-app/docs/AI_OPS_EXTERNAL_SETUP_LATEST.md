# AI/Ops External Setup Latest

- Time: 2026-06-15T10:37:46.796Z
- Status: NEEDS_EXTERNAL_SETUP
- Blocking external items: 1

## Frontend Sentry DSN accepts browser events

- Status: configured_no_403_seen
- Next action: No Sentry ingest 403 was seen in the latest browser monitor.
- Evidence:

## Firebase App Check accepts gigto.in domain

- Status: configured_no_403_seen
- Next action: No App Check 403 was seen in the latest browser monitor.
- Evidence:

## Backend Sentry issue ingest

- Status: needs_external_values
- Next action: Provide backend Sentry DSN plus issue-read token/org/project slugs if production issue ingest should create Jira/RAG handoffs.
- Evidence:
  - SENTRY_DSN=missing
  - SENTRY_AUTH_TOKEN=missing
  - SENTRY_ORG=missing
  - SENTRY_PROJECTS=missing

## Jira handoff creation

- Status: configured_firebase_handoff
- Next action: Using Firestore jira_issue_handoffs as MVP issue tracking. Atlassian Jira can be connected later if needed.
- Evidence:
  - JIRA_HANDOFF_MODE=firebase
  - JIRA_BASE_URL=missing
  - JIRA_EMAIL=missing
  - JIRA_API_TOKEN=missing

## Vertex Vector Search

- Status: optional_not_configured
- Next action: Optional for MVP. Firestore RAG stays active until these Vertex Vector Search values are provided.
- Evidence:
  - VERTEX_VECTOR_SEARCH_INDEX_ID=missing
  - VERTEX_VECTOR_SEARCH_INDEX_ENDPOINT=missing
  - VERTEX_VECTOR_SEARCH_DEPLOYED_INDEX_ID=missing

## Full AI agent runtime

- Status: safe_dry_run
- Next action: Keep dry_run for MVP. Enable Cloud Run/LangGraph only after separate service accounts and human approval are ready.
- Evidence:
  - AI_AGENT_RUNTIME_MODE=dry_run
  - AI_AGENT_RUNTIME_URL=missing
  - AI_AGENT_RUNTIME_SERVICE_ACCOUNT=missing
