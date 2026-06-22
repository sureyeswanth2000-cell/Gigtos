# Gigtos — Monitoring Setup Guide

> **Version:** 1.0  
> **Last Updated:** 2026-03-04  
> **Scope:** GCP Cloud Monitoring, Firebase, Cloud Logging  
> **Owner:** Operations / SRE Team

---

## Overview

This guide sets up observability for the Gigtos production environment using:
- **GCP Cloud Monitoring** — dashboards and uptime checks
- **Cloud Logging** — centralized log aggregation and alerting
- **Firebase Performance Monitoring** — client-side performance
- **Firebase Crashlytics** — error tracking (React web app)
- **Cloud Alerting** — automated incident notifications

---

## 1. Prerequisites

```bash
# Confirm gcloud is authenticated and pointing at the right project
gcloud auth login
gcloud config set project <PROJECT_ID>

# Enable required APIs
gcloud services enable \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudtrace.googleapis.com \
  clouderrorreporting.googleapis.com \
  --project=<PROJECT_ID>
```

---

## 2. Cloud Monitoring Dashboards

### 2.1 Create the Gigtos Overview Dashboard

The following steps create a dashboard that combines the most important signals in one view.

**Option A — GCP Console (UI)**
1. Navigate to **Monitoring → Dashboards → Create Dashboard**
2. Name it `Gigtos Production Overview`
3. Add the widgets described in §2.2 – §2.5

**Option B — gcloud CLI (recommended for repeatability)**
```bash
# Save the dashboard JSON to a file, then create it
gcloud monitoring dashboards create --config-from-file=monitoring/gigtos-dashboard.json
```

> Dashboard JSON template is in `monitoring/gigtos-dashboard.json` (see §2.6 for the full template).

---

### 2.2 Core Application Metrics Widgets

Add the following chart widgets to the dashboard:

#### Cloud Functions — Invocation Metrics
| Widget | Metric | Aggregation |
|---|---|---|
| Function invocations/min | `cloudfunctions.googleapis.com/function/execution_count` | Sum, 1 min |
| Function error rate | `cloudfunctions.googleapis.com/function/execution_count` (filter: `status != ok`) | Sum / Total |
| Function latency (p50/p95/p99) | `cloudfunctions.googleapis.com/function/execution_times` | Percentile, 1 min |
| Active instances | `cloudfunctions.googleapis.com/function/active_instances` | Mean, 5 min |

**Filters to apply:**
- `resource.labels.function_name =~ "gigtos.*"` (or specific names: `onBookingCreated`, `onBookingStatusChange`, `secureUpdateBookingStatus`, `secureLogActivity`)

#### Firestore Metrics
| Widget | Metric | Aggregation |
|---|---|---|
| Read operations/min | `firestore.googleapis.com/document/read_count` | Sum, 1 min |
| Write operations/min | `firestore.googleapis.com/document/write_count` | Sum, 1 min |
| Delete operations/min | `firestore.googleapis.com/document/delete_count` | Sum, 1 min |

#### Firebase Hosting
| Widget | Metric | Aggregation |
|---|---|---|
| HTTP requests/min | `firebase.googleapis.com/hosting/request_count` | Sum, 1 min |
| Data transfer (GB) | `firebase.googleapis.com/hosting/sent_bytes` | Sum, 1 h |

---

### 2.3 Security Metrics Widgets

These widgets surface potential security events.

| Widget | Metric | Aggregation | Alert Threshold |
|---|---|---|---|
| Auth failures/min | Log-based metric `auth_failures` (see §4.2) | Sum, 1 min | > 10 |
| Firestore security rule denials | Log-based metric `firestore_denied` (see §4.3) | Sum, 5 min | > 50 |
| Callable function unauthorized errors | Log-based metric `callable_auth_errors` | Sum, 5 min | > 20 |

---

### 2.4 Business KPI Widgets

| Widget | Description | Data Source |
|---|---|---|
| Bookings created (24 h) | Count of `onBookingCreated` trigger invocations | Cloud Functions metric |
| Bookings completed (24 h) | Count of status changes to `completed` | Custom log-based metric |
| Active disputes | Documents in Firestore `bookings` where `hasDispute=true` | (manual refresh or Scheduled Function) |

---

### 2.5 Infrastructure Health Widgets

| Widget | Metric | Alert Threshold |
|---|---|---|
| Cloud Scheduler job success rate | `cloudscheduler.googleapis.com/job/attempt_count` (status=success) | < 100% over 1 h |
| GCS backup export age | Custom log-based metric on backup completion log | > 25 h since last success |

---

### 2.6 Dashboard JSON Template

Save this to `monitoring/gigtos-dashboard.json` and customize as needed:

```json
{
  "displayName": "Gigtos Production Overview",
  "gridLayout": {
    "columns": "2",
    "widgets": [
      {
        "title": "Cloud Function Invocations",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"cloudfunctions.googleapis.com/function/execution_count\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              }
            }
          ]
        }
      },
      {
        "title": "Firestore Operations",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"firestore.googleapis.com/document/read_count\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              },
              "legendTemplate": "Reads"
            },
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"firestore.googleapis.com/document/write_count\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_RATE"
                  }
                }
              },
              "legendTemplate": "Writes"
            }
          ]
        }
      }
    ]
  }
}
```

---

## 3. Security Alerts Configuration

### 3.1 Create Notification Channel (Email)

```bash
gcloud alpha monitoring channels create \
  --display-name="Gigtos Security Team" \
  --type=email \
  --channel-labels="email_address=security@yourdomain.com" \
  --project=<PROJECT_ID>

# Note the channel ID returned; use it in alert policies below
CHANNEL_ID="projects/<PROJECT_ID>/notificationChannels/<ID>"
```

### 3.2 Alert: High Authentication Failure Rate

Triggered when > 10 authentication failures occur within 1 minute (potential credential stuffing).

```bash
gcloud alpha monitoring policies create --policy-from-file=- <<'EOF'
{
  "displayName": "[GIGTOS-SEC] High Auth Failure Rate",
  "conditions": [
    {
      "displayName": "Auth failures > 10/min",
      "conditionThreshold": {
        "filter": "metric.type=\"logging.googleapis.com/user/auth_failures\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 10,
        "duration": "60s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "alertStrategy": { "autoClose": "1800s" },
  "notificationChannels": ["CHANNEL_ID_HERE"],
  "documentation": {
    "content": "High authentication failure rate detected. Check Firebase Auth logs for brute-force attempts. Runbook: SECURITY_TEAM_RUNBOOK.md §2.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 3.3 Alert: Firestore Security Rule Denials Spike

```bash
gcloud alpha monitoring policies create --policy-from-file=- <<'EOF'
{
  "displayName": "[GIGTOS-SEC] Firestore Denial Spike",
  "conditions": [
    {
      "displayName": "Security rule denials > 50 in 5 min",
      "conditionThreshold": {
        "filter": "metric.type=\"logging.googleapis.com/user/firestore_denied\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 50,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["CHANNEL_ID_HERE"],
  "documentation": {
    "content": "Elevated Firestore security rule denial rate. Could indicate a misconfigured client or unauthorized access probe. Review logs: INCIDENT_RESPONSE_PLAN.md §3.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 3.4 Alert: Cloud Function Error Rate Elevated

```bash
gcloud alpha monitoring policies create --policy-from-file=- <<'EOF'
{
  "displayName": "[GIGTOS-OPS] Cloud Function Error Rate > 5%",
  "conditions": [
    {
      "displayName": "Function error fraction > 5%",
      "conditionThreshold": {
        "filter": "metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" AND metric.labels.status!=\"ok\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.05,
        "duration": "120s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["CHANNEL_ID_HERE"],
  "documentation": {
    "content": "Cloud Function error rate has exceeded 5%. Check function logs for root cause. Common causes: missing secrets, Firestore permission errors, Twilio/Gmail API issues.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 3.5 Alert: Backup Job Failure

```bash
gcloud alpha monitoring policies create --policy-from-file=- <<'EOF'
{
  "displayName": "[GIGTOS-OPS] Firestore Backup Failed",
  "conditions": [
    {
      "displayName": "Backup success count < 1 in 25 hours",
      "conditionAbsent": {
        "filter": "metric.type=\"logging.googleapis.com/user/backup_success\"",
        "duration": "90000s",
        "aggregations": [
          {
            "alignmentPeriod": "86400s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["CHANNEL_ID_HERE"],
  "documentation": {
    "content": "No Firestore backup success logged in 25 hours. Check Cloud Scheduler job and backup service account permissions.",
    "mimeType": "text/markdown"
  }
}
EOF
```

### 3.6 Alert: Uptime / Availability Check

```bash
# Create uptime check
gcloud monitoring uptime create \
  --display-name="Gigtos Web App Availability" \
  --resource-type=uptime-url \
  --hostname=your-production-domain.com \
  --path=/ \
  --port=443 \
  --use-ssl \
  --period=60 \
  --timeout=10 \
  --regions=asia-east1,us-east4 \
  --project=<PROJECT_ID>
```

Alert on uptime failure: configure via Console under **Monitoring → Uptime Checks → Alerts** and connect to the notification channel created in §3.1.

---

## 4. Log Aggregation Setup

### 4.1 Log Router — Sink to GCS for Long-term Retention

```bash
BUCKET_NAME="${PROJECT_ID}-audit-logs"
gsutil mb -l asia-south1 gs://${BUCKET_NAME}
gsutil retention set 2y gs://${BUCKET_NAME}   # 2-year retention

gcloud logging sinks create gigtos-audit-sink \
  storage.googleapis.com/${BUCKET_NAME} \
  --log-filter='protoPayload.serviceName="firestore.googleapis.com" OR \
                protoPayload.serviceName="cloudfunctions.googleapis.com" OR \
                protoPayload.serviceName="firebase.googleapis.com"' \
  --project=<PROJECT_ID>

# Grant the sink's service account write access to the bucket
SINK_SA=$(gcloud logging sinks describe gigtos-audit-sink --format='value(writerIdentity)' --project=<PROJECT_ID>)
gsutil iam ch "${SINK_SA}:roles/storage.objectCreator" gs://${BUCKET_NAME}
```

### 4.2 Log-Based Metric: Authentication Failures

```bash
gcloud logging metrics create auth_failures \
  --description="Count of Firebase Authentication failures" \
  --log-filter='resource.type="firebase_project" \
    severity>=WARNING \
    (textPayload=~"SIGN_IN_FAILED" OR textPayload=~"TOO_MANY_ATTEMPTS")' \
  --project=<PROJECT_ID>
```

### 4.3 Log-Based Metric: Firestore Security Rule Denials

```bash
gcloud logging metrics create firestore_denied \
  --description="Firestore security rule denied requests" \
  --log-filter='protoPayload.serviceName="firestore.googleapis.com" \
    protoPayload.status.code=7' \
  --project=<PROJECT_ID>
```

### 4.4 Log-Based Metric: Backup Success

```bash
gcloud logging metrics create backup_success \
  --description="Firestore export job completed successfully" \
  --log-filter='resource.type="cloud_scheduler_job" \
    resource.labels.job_id="gigtos-firestore-daily-backup" \
    textPayload=~"Export.*completed"' \
  --project=<PROJECT_ID>
```

### 4.5 Log-Based Metric: Unauthorized Callable Function Access

```bash
gcloud logging metrics create callable_auth_errors \
  --description="Unauthorized calls to secured Cloud Functions" \
  --log-filter='resource.type="cloud_function" \
    textPayload=~"UNAUTHENTICATED|PERMISSION_DENIED"' \
  --project=<PROJECT_ID>
```

### 4.6 Log Explorer — Common Queries

Save these as **Saved Queries** in the GCP Console → Log Explorer:

```
# All Cloud Function errors (last 24h)
resource.type="cloud_function"
severity>=ERROR
timestamp >= "now-24h"

# Firestore write operations by collection
protoPayload.serviceName="firestore.googleapis.com"
protoPayload.methodName="google.firestore.v1.Firestore.Commit"

# Authentication events
resource.type="firebase_project"
(textPayload=~"SIGN_IN" OR textPayload=~"SIGN_UP")

# Booking status change activities
resource.type="cloud_function"
resource.labels.function_name="secureUpdateBookingStatus"
```

---

## 5. Performance Metrics Tracking

### 5.1 Firebase Performance Monitoring (Web SDK)

Add to `react-app/src/firebase.js`:
```javascript
import { getPerformance } from "firebase/performance";
const perf = getPerformance(app);
```

Key automatically collected traces:
- `_wt_` — web page load time
- `_fcp_` — First Contentful Paint
- `_lcp_` — Largest Contentful Paint

Custom traces to add for critical operations:
```javascript
import { trace } from "firebase/performance";

// In Service.js — booking creation flow
const bookingTrace = trace(perf, "create_booking");
bookingTrace.start();
// ... booking creation code ...
bookingTrace.stop();
```

### 5.2 Cloud Function Duration SLOs

Set latency SLOs for critical functions:

| Function | p50 Target | p95 Target | p99 Target |
|---|---|---|---|
| `onBookingCreated` | < 500 ms | < 2 s | < 5 s |
| `secureUpdateBookingStatus` | < 300 ms | < 1 s | < 3 s |
| `secureLogActivity` | < 200 ms | < 800 ms | < 2 s |
| `computeRegionScore` | < 2 s | < 5 s | < 10 s |

Monitor via: **Monitoring → Dashboards → Gigtos Production Overview → Function latency widget**

### 5.3 Firestore Read/Write Budget

Alert if operations exceed the following thresholds (adjust based on actual usage):

| Metric | Warning | Critical |
|---|---|---|
| Reads / day | 50,000 | 80,000 |
| Writes / day | 20,000 | 40,000 |
| Deletes / day | 1,000 | 5,000 |

---

## 6. Incident Detection Rules

### 6.1 Detection Rule Summary

| Rule Name | Trigger Condition | Severity | Response |
|---|---|---|---|
| Auth failure spike | > 10 failures/min | HIGH | Block IP, notify security team |
| Firestore denial spike | > 50 denials/5 min | MEDIUM | Review access logs, check rules |
| Function error rate | > 5% over 2 min | HIGH | Check function logs, roll back if needed |
| Backup missing | No success in 25 h | MEDIUM | Re-trigger backup, investigate |
| Uptime degradation | Site down > 2 min | CRITICAL | Immediate incident response |
| Secret access anomaly | Access from unexpected SA | HIGH | Rotate secret, audit access |

### 6.2 Anomaly Detection

Enable GCP's built-in anomaly detection:
1. **Monitoring → Alerting → Create Policy → Metric Threshold**
2. Select metric → **Configure trigger → Metric absence** for backup jobs
3. For security: use **Conditions → Metric Threshold** with a **sliding window** of 15 min

### 6.3 Security Command Center Integration (Optional)

```bash
# Enable Security Command Center if on Standard/Premium tier
gcloud services enable securitycenter.googleapis.com --project=<PROJECT_ID>
```

Connect findings to Monitoring alerts via Pub/Sub:
```bash
gcloud scc notifications create gigtos-scc-alerts \
  --organization=<ORG_ID> \
  --pubsub-topic=projects/<PROJECT_ID>/topics/scc-alerts \
  --filter="state=\"ACTIVE\""
```

---

## 7. Verification Checklist

- [ ] `Gigtos Production Overview` dashboard visible in Cloud Console
- [ ] All 4 log-based metrics (`auth_failures`, `firestore_denied`, `backup_success`, `callable_auth_errors`) created
- [ ] All 5 alert policies created and connected to the security team notification channel
- [ ] Uptime check running every 60 seconds from multiple regions
- [ ] GCS log sink configured with 2-year retention
- [ ] Firebase Performance Monitoring SDK initialized in React app
- [ ] Test alert fired successfully (trigger manually → confirm email received)

---

## Troubleshooting

| Symptom | Resolution |
|---|---|
| Log-based metric shows no data | Verify `--log-filter` matches actual log entries via Log Explorer |
| Alert policy not triggering | Check metric has data points; confirm threshold unit matches metric unit |
| Uptime check failing despite site being up | Verify firewall/CDN is not blocking GCP health check IPs |
| Dashboard widgets show "No data" | Confirm metric APIs are enabled; wait up to 5 min for data to appear |
| Backup success metric never increments | Verify the log-based metric filter matches the actual scheduler log message |
