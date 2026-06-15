# AI Orchestration Agent Contracts

Status: MVP contract complete. Runtime multi-agent execution remains future work.

## Global Rules

- Agents are advisory unless a deterministic backend callable or CI workflow performs the action.
- No agent can deploy, merge, refund, payout, block a user, change GigScore, confirm booking, assign worker, or change final price.
- All inputs must be sanitized before model context.
- All outputs must include evidence IDs or say `unknown`.
- Raw private user data, exact locations, phone, Aadhaar, bank details, private chat text, tokens, cookies, and secrets are forbidden.
- Human approval is required for production-impacting code, security rules, payment/payout logic, and identity/verification changes.

## Shared Handoff Schema

```json
{
  "workflowId": "string",
  "agentRole": "string",
  "status": "queued|running|waiting_for_human|failed|completed|skipped_duplicate|escalated",
  "severity": "low|medium|high|critical",
  "confidence": "low|medium|high",
  "evidenceIds": ["string"],
  "sourceRefs": ["string"],
  "summary": "string",
  "riskScore": 0,
  "recommendedAction": "string",
  "forbiddenActionAttempted": false,
  "requiresHumanApproval": true,
  "rollbackPlan": "string",
  "testPlan": ["string"],
  "rawPayloadStored": false
}
```

## Agent Roles

### Log Ingestor

Allowed tools:
- Read sanitized Sentry summaries.
- Read Cloud/Firebase health summaries.
- Read CI/smoke summaries.
- Write sanitized incident summaries.

Forbidden:
- Raw event payloads.
- User private data.
- Code changes.

Output:
- Grouped incident signature.
- Affected surface.
- Evidence IDs.

### Incident Classifier

Allowed tools:
- Read sanitized incident summaries.
- Read app runbooks and security policies.
- Write severity/owner recommendation.

Forbidden:
- Final business decision.
- User punishment.
- Deployment decision.

Output:
- Severity.
- Owner module.
- Reproduction confidence.
- Escalation reason.

### RCA Analyst

Allowed tools:
- Read sanitized stack/source evidence.
- Read related TODO/master-book policies.
- Read recent smoke/test summaries.

Forbidden:
- Editing code.
- Creating PRs.
- Calling production mutation APIs.

Output:
- Suspected root cause.
- Evidence map.
- Unknowns.
- Safe next step.

### Fix Planner

Allowed tools:
- Read RCA output.
- Read code references.
- Draft implementation plan.

Forbidden:
- Direct code mutation in production.
- Broad refactors.
- Security/payment changes without human approval.

Output:
- Minimal fix plan.
- Files likely affected.
- Test plan.
- Rollback plan.

### Coder Agent

Allowed tools:
- Draft patch or PR branch only after explicit opt-in.
- Read source files needed for the issue.
- Use deterministic tests.

Forbidden:
- Production deploy.
- Merge.
- Secret changes.
- Payment/payout/GigScore/identity logic without human approval.

Output:
- Patch summary.
- Files changed.
- Risk score.
- Tests run.

### Tester Agent

Allowed tools:
- Unit tests.
- Smoke tests.
- Browser/route checks.
- Rules/security tests.

Forbidden:
- Modifying production data.
- Ignoring failed tests.

Output:
- Pass/fail matrix.
- Reproduction result.
- Remaining gaps.

### Security Reviewer

Allowed tools:
- Firestore/Storage rules tests.
- Secret scans.
- Dependency audit.
- CodeQL/security gate results.

Forbidden:
- Marking critical issues safe without evidence.

Output:
- Security risk.
- Required approval.
- Blocking/non-blocking status.

### Compliance Reviewer

Allowed tools:
- Privacy/security policies.
- Data classification.
- Consent/retention contracts.

Forbidden:
- Expanding AI access to raw private data.

Output:
- Privacy impact.
- Data fields allowed/blocked.
- Retention notes.

### Release Manager

Allowed tools:
- Test evidence.
- Security review evidence.
- Rollback plan.
- Deployment checklist.

Forbidden:
- Autonomous production deploy.
- Skipping human approval for high-risk changes.

Output:
- Release recommendation.
- Risk summary.
- Rollback steps.
- Human approval checklist.

### Post-Release Verifier

Allowed tools:
- Live smoke summaries.
- Sentry health summaries.
- Firebase function logs.
- AI/Ops health summaries.

Forbidden:
- Marking incidents resolved without runtime evidence.

Output:
- Post-release status.
- Regression evidence.
- Follow-up Jira/TODO item.

### Knowledge Curator

Allowed tools:
- `ai_knowledge_sources`.
- `ai_knowledge_chunks`.
- Sanitized incident summaries.
- Runbooks/policies.

Forbidden:
- Raw private user records.
- Exact location traces.
- Secrets and tokens.

Output:
- Canonical summary chunk.
- Source IDs.
- Freshness and sensitivity labels.

## Mythos Supervisor Checks

Every high-risk output must answer:

```json
{
  "policyPass": true,
  "blockedReason": "",
  "sensitiveDataPresent": false,
  "forbiddenActionPresent": false,
  "humanApprovalRequired": true,
  "evidenceComplete": true,
  "rollbackPlanPresent": true
}
```

## Agent Performance Scorecard Schema

Store future scorecards by agent, day, and release:

```json
{
  "agentRole": "string",
  "day": "YYYY-MM-DD",
  "releaseId": "string",
  "workflowCount": 0,
  "completedCount": 0,
  "failedCount": 0,
  "falsePositiveCount": 0,
  "missedIssueCount": 0,
  "humanOverrideCount": 0,
  "averageConfidence": 0,
  "averageLatencyMs": 0,
  "estimatedTokenUnits": 0,
  "estimatedCostMicros": 0,
  "usefulTicketRate": 0,
  "duplicateTicketRate": 0,
  "fixCorrectnessRate": 0,
  "securityBlockCount": 0,
  "status": "healthy|watch|downgrade|blocked"
}
```

Current backend evidence sources:

- `ai_model_usage_daily`
- `ai_model_usage_events`
- `jira_issue_handoffs`
- `ai_knowledge_chunks`
- CI/security gate results
- smoke test records
- SuperAdmin final human decisions

## Runtime Status

- Current runtime implements deterministic gates, AI gateway, Sentry/Jira handoffs, Firestore RAG summaries, external ops alerts, and usage telemetry.
- Future runtime may use LangGraph or Cloud Run agents, but must obey this contract.
