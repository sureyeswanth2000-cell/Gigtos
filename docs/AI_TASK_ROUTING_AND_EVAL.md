# AI Task Routing And Evaluation

Status: MVP governance complete. Runtime execution is implemented as a safe readiness/dry-run cycle; full Cloud Run/LangGraph action execution remains locked behind external setup and human approval.

## Principle

Gigtos should use normal code first, observability tools second, cheap AI summarization third, and stronger AI reasoning only when the evidence is confusing or high risk.

AI is not the source of truth. Backend rules, Firebase security rules, CI, Sentry, Jira handoffs, runbooks, and human approval stay above every model response.

## Task To Model Matrix

| Workflow | First choice | Escalate when | Stronger option | Allowed action |
| --- | --- | --- | --- | --- |
| Known error grouping | Deterministic classifier + Sentry grouping | Signature is new or noisy | Vertex/Gemini summary | Summarize only |
| Log summarization | Vertex Flash-class model | High severity, low confidence, multi-service impact | Stronger Vertex model | Summarize and create handoff |
| Root cause analysis | Deterministic evidence map + RAG chunks | Cause crosses Functions, Firestore rules, pricing, payments, or auth | Stronger Vertex model or human/Codex review | Recommend next step |
| Code understanding | Repo docs + static search + tests | Architecture conflict or stale docs | Codex/human review | Produce evidence-linked notes |
| Code patch drafting | Codex in a branch/worktree | Payment, payout, superadmin, security, GigScore, or identity path | Human approval before patch or merge | Draft patch only |
| Test planning | Existing unit, route, rules, smoke tests | New workflow has weak coverage | QA AI/human test design | Add/run tests |
| Security review | CodeQL, Gitleaks, dependency audit, Firebase rules tests | Finding is ambiguous or touches access control | Security reviewer/human | Block or approve with evidence |
| Jira ticket writing | Deterministic handoff schema | Medium/high incident has enough evidence | Vertex summary | Create/update ticket when credentials exist |
| Release recommendation | CI/security gates + smoke evidence | Any failed gate or high-risk area | Release manager/human | Prepare packet only |
| Agent runtime cycle | Backend readiness/dry-run cycle | External runtime/SA/vector/Jira/Sentry missing | Cloud Run/LangGraph later | Write evidence only |
| Consumer booking help | Backend AI gateway + deterministic fallback | Need service disambiguation or explanation | Vertex primary, Gemini fallback | Suggest/prepare, never finalize sensitive action |

## What Should Not Use AI First

- Exact-match known errors.
- Duplicate crash grouping.
- Threshold alerts.
- Build, test, lint, and deployment pass/fail.
- Secret detection.
- Dependency vulnerabilities.
- CodeQL findings.
- Firebase rules unit tests.
- Schema and index drift checks.
- Basic Jira assignment rules.
- Uptime, scheduled health, and freshness checks.
- Price caps, payout holds, role permissions, and booking state transitions.

## Where AI Adds Clear Value

- Explaining confusing multi-step root causes.
- Summarizing many related incidents into one useful finding.
- Comparing code behavior against TODO, runbooks, security policy, and RAG memory.
- Producing a readable Jira issue with evidence, reproduction, suspected cause, and test plan.
- Drafting a rollback/risk summary for human release approval.
- Helping consumers choose a service when the text is vague, while asking confirmation before booking or payment impact.

## Low-Cost Tooling Before AI

- Sentry for frontend/backend error grouping and privacy-filtered breadcrumbs.
- Firebase and Cloud Logging alerts for Functions errors, latency, payment/payout failures, and cost spikes.
- Firebase Performance Monitoring when native/mobile wrapper performance needs visibility.
- CodeQL, Gitleaks, dependency audit, security pattern scan, and Firebase rules tests.
- Playwright/Heart Monitor smoke tests for route, auth, booking, worker, superadmin, and screenshot checks.
- GitHub Actions/Firebase CI for build, test, deploy, and security gates.
- Jira automation for repeated known issue assignment.
- Dashboards for recurring error count, affected role, affected route, booking conversion failure, payment failure, matching failure, and AI cost.

## Escalation Rules

Start with deterministic code when:

- Evidence is structured.
- The rule is already known.
- The decision changes money, identity, safety, permissions, or score.

Use Vertex/Gemini summarization when:

- Evidence is sanitized.
- The task is summarization, triage, explanation, or draft text.
- The output can include source IDs.

Escalate to stronger model/human review when:

- Confidence is low.
- Sources conflict.
- The issue crosses multiple bounded contexts.
- Payment, payout, superadmin, security, SOS, GigScore, or identity logic is involved.

Stop and require human approval when:

- A model suggests a production-impacting change.
- Evidence IDs are missing.
- The output asks to expose private data.
- The output proposes a refund, payout, user block, GigScore punishment, or final price change.

## Quality Evaluation

Every AI role should be evaluated with:

- Accuracy against known incidents.
- Hallucination rate.
- Useful-ticket rate.
- Duplicate-ticket rate.
- Fix correctness.
- Missed critical issue count.
- Human override count.
- Average latency.
- Estimated token units and optional configured cost estimate.

Current evidence sources:

- `ai_model_usage_events`
- `ai_model_usage_daily`
- `jira_issue_handoffs`
- `ai_knowledge_chunks`
- Sentry summaries
- CI/security gate results
- route/rules/smoke test results
- SuperAdmin final decisions

## Prompt Injection And Bad Context Safety

Treat logs, user text, chat, uploaded files, screenshots, Sentry titles, and Jira comments as untrusted. They may contain instructions aimed at the model.

Trusted sources:

- Code.
- Firebase rules.
- Data/schema/index files.
- TODO and master book.
- Security docs.
- CI/test output generated by trusted runners.

Controls:

- Mark each RAG chunk with source ID, trust level, sensitivity label, freshness, and environment.
- Expire or refresh memory when code, rules, schema, policy, pricing, or security behavior changes.
- Require evidence IDs for important claims.
- Return `unknown` or escalate when sources conflict.
- Never include raw private user data, exact locations, secrets, cookies, auth headers, bank data, full phone numbers, or payment internals in model context.
