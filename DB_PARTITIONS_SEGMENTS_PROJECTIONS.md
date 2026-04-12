# Gigtos — PostgreSQL Partitions, Segments & Projections

> **Companion to:** `DATA_CONNECT_MIGRATION_PLAN.md`  
> **Date:** 2026-04-06  
> **Scope:** Advanced PostgreSQL performance strategies for Firebase Data Connect (PostgreSQL backend) at 1 lakh users and beyond.

---

## Overview

| Technique | PostgreSQL Mechanism | Purpose in Gigtos |
|---|---|---|
| **Partitions** | `PARTITION BY RANGE / LIST / HASH` | Split large tables across time or category boundaries so queries touch only relevant slices |
| **Segments** | Logical data segments via tablespaces + schemas | Isolate hot vs cold data, archive vs live, OLTP vs analytics on separate storage |
| **Projections** | Covering indexes + Materialized Views | Pre-compute and store commonly queried column subsets to eliminate table heap reads |

---

## Part 1 — Partitions

### 1.1 Why Partition?

At 1 lakh users, `activity_logs` alone is projected at **5M–10M rows**. Without partitioning:
- `VACUUM` on a 10M-row table locks the whole table
- A monthly date-range query scans all rows even with a `created_at` index
- Dropping old data requires a slow `DELETE` with full table scan

With range partitioning by month, each query touches only the relevant month partition (~100K rows), `DROP TABLE` on an old partition is instant, and `VACUUM` runs per-partition.

---

### 1.2 `activity_logs` — Monthly Range Partition

This is the highest-volume table (~10M rows/year). Partition by `created_at` monthly.

```sql
-- Parent table (no data stored here directly)
CREATE TABLE activity_logs (
  log_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL,
  actor_id    UUID,
  actor_role  VARCHAR(20),
  action      VARCHAR(60) NOT NULL,
  from_status VARCHAR(30),
  to_status   VARCHAR(30),
  reason      TEXT,
  rating      SMALLINT,
  amount      NUMERIC(10,2),
  worker_id   UUID,
  admin_id    UUID,
  price       NUMERIC(10,2),
  decision    VARCHAR(20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (log_id, created_at)           -- partition key must be in PK
) PARTITION BY RANGE (created_at);

-- ── Monthly child partitions ──────────────────────────────────────────────
CREATE TABLE activity_logs_2026_01 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE activity_logs_2026_02 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE activity_logs_2026_03 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE activity_logs_2026_04 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE activity_logs_2026_05 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE activity_logs_2026_06 PARTITION OF activity_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- ... create new partition at the START of each month before it is needed
-- Automate with pg_cron (see Section 1.6)

-- ── Indexes on each partition ─────────────────────────────────────────────
-- PostgreSQL automatically creates local indexes on each partition when
-- you create an index on the parent:
CREATE INDEX idx_actlogs_booking   ON activity_logs (booking_id);
CREATE INDEX idx_actlogs_created   ON activity_logs (created_at DESC);
CREATE INDEX idx_actlogs_actor     ON activity_logs (actor_id, created_at);
```

**Partition pruning in action:**
```sql
-- Planner touches only activity_logs_2026_04 — not all 10M rows
SELECT * FROM activity_logs
WHERE booking_id = $1
  AND created_at >= '2026-04-01'
  AND created_at <  '2026-05-01';
```

---

### 1.3 `booking_chat` — Monthly Range Partition

Chat is the second-largest table (~2M rows/year). Same strategy.

```sql
CREATE TABLE booking_chat (
  message_id  UUID        NOT NULL DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL,
  sender_id   UUID        NOT NULL,
  sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user','admin')),
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE booking_chat_2026_01 PARTITION OF booking_chat FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE booking_chat_2026_02 PARTITION OF booking_chat FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE booking_chat_2026_03 PARTITION OF booking_chat FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE booking_chat_2026_04 PARTITION OF booking_chat FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
-- ... continue monthly

CREATE INDEX idx_chat_booking_date ON booking_chat (booking_id, created_at);
```

---

### 1.4 `bookings` — List Partition by Status (Active vs Archived)

After a booking reaches `completed` or `cancelled`, it is never updated again. Segregating it speeds up dashboard queries that only need active bookings.

```sql
CREATE TABLE bookings (
  booking_id              UUID         NOT NULL DEFAULT gen_random_uuid(),
  user_id                 UUID         NOT NULL,
  service_type_id         INTEGER      NOT NULL,
  issue_title             VARCHAR(200) NOT NULL,
  job_details             TEXT,
  status                  VARCHAR(30)  NOT NULL DEFAULT 'pending',
  scheduled_date          DATE,
  time_slot_id            INTEGER,
  estimated_days          SMALLINT     NOT NULL DEFAULT 1,
  completed_work_days     SMALLINT     NOT NULL DEFAULT 0,
  is_multi_day            BOOLEAN      NOT NULL DEFAULT FALSE,
  started_at              TIMESTAMPTZ,
  finished_at             TIMESTAMPTZ,
  admin_id                UUID,
  assigned_worker_id      UUID,
  escrow_status           VARCHAR(30)  NOT NULL DEFAULT 'pending',
  is_commission_processed BOOLEAN      NOT NULL DEFAULT FALSE,
  rating                  SMALLINT,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, status)         -- status is the partition key
) PARTITION BY LIST (status);

-- Active partition — all live, in-flight bookings
CREATE TABLE bookings_active PARTITION OF bookings
  FOR VALUES IN ('pending','scheduled','quoted','accepted','assigned','in_progress','awaiting_confirmation');

-- Closed partition — immutable, cold storage, can live on cheaper tablespace
CREATE TABLE bookings_closed PARTITION OF bookings
  FOR VALUES IN ('completed','cancelled');

-- Indexes on parent (applied to both partitions automatically)
CREATE INDEX idx_bookings_user        ON bookings (user_id);
CREATE INDEX idx_bookings_admin       ON bookings (admin_id);
CREATE INDEX idx_bookings_worker      ON bookings (assigned_worker_id);
CREATE INDEX idx_bookings_created     ON bookings (created_at DESC);
CREATE INDEX idx_bookings_status_date ON bookings (status, created_at);
```

> **Dashboard query benefit:** `v_active_bookings` only scans `bookings_active` (~5% of total rows), not the 500K–1M completed bookings.

---

### 1.5 `admin_alerts` — Hash Partition by `admin_id`

Each admin only ever queries their own alerts. Hash partitioning on `admin_id` distributes rows evenly across 4 buckets — each admin's query only hits one partition.

```sql
CREATE TABLE admin_alerts (
  alert_id   UUID        NOT NULL DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL,
  booking_id UUID,
  type       VARCHAR(60) NOT NULL,
  status     VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  title      VARCHAR(200),
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (alert_id, admin_id)
) PARTITION BY HASH (admin_id);

CREATE TABLE admin_alerts_p0 PARTITION OF admin_alerts FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE admin_alerts_p1 PARTITION OF admin_alerts FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE admin_alerts_p2 PARTITION OF admin_alerts FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE admin_alerts_p3 PARTITION OF admin_alerts FOR VALUES WITH (MODULUS 4, REMAINDER 3);

CREATE INDEX idx_alerts_admin_status ON admin_alerts (admin_id, status);
```

---

### 1.6 Automated Monthly Partition Creation (pg_cron)

Never let a month start without its partition already existing. Use `pg_cron` (supported on Cloud SQL for PostgreSQL):

```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run on the 25th of every month at 00:00 UTC — creates next month's partitions
SELECT cron.schedule(
  'create_monthly_partitions',
  '0 0 25 * *',
  $$
  DO $$
  DECLARE
    next_month_start DATE := date_trunc('month', NOW() + INTERVAL '1 month');
    next_month_end   DATE := next_month_start + INTERVAL '1 month';
    suffix           TEXT := to_char(next_month_start, 'YYYY_MM');
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS activity_logs_%s PARTITION OF activity_logs FOR VALUES FROM (%L) TO (%L)',
      suffix, next_month_start, next_month_end
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS booking_chat_%s PARTITION OF booking_chat FOR VALUES FROM (%L) TO (%L)',
      suffix, next_month_start, next_month_end
    );
  END;
  $$ LANGUAGE plpgsql;
  $$
);
```

---

### 1.7 Partition Retention / Archival Policy

| Table | Keep Live | Archive to Cold Storage | Drop |
|---|---|---|---|
| `activity_logs` | Last 6 months | Months 7–24 (dump to GCS) | After 24 months |
| `booking_chat` | Last 12 months | Months 13–36 | After 36 months |
| `bookings_closed` | Always (legal) | N/A | Never |

```sql
-- Archive a partition: dump to GCS with pg_dump, then detach + drop
ALTER TABLE activity_logs DETACH PARTITION activity_logs_2024_01;
-- (run pg_dump on the detached table, upload to GCS)
DROP TABLE activity_logs_2024_01;
```

---

## Part 2 — Segments

### 2.1 What Are Segments in This Context?

"Segments" in PostgreSQL means **tablespaces** — logical storage locations that map to different physical directories or disks. This lets you place hot (frequently read/written) data on fast SSD storage and cold (archived, rarely accessed) data on cheaper HDD or Cloud Storage.

In Firebase Data Connect (Cloud SQL for PostgreSQL), you can configure multiple disks per instance and assign tablespaces to them.

---

### 2.2 Tablespace Definitions

```sql
-- Hot tablespace: NVMe SSD for OLTP tables (bookings, users, workers)
CREATE TABLESPACE ts_hot
  OWNER postgres
  LOCATION '/mnt/ssd/gigtos_hot';

-- Warm tablespace: Standard SSD for medium-frequency tables
CREATE TABLESPACE ts_warm
  OWNER postgres
  LOCATION '/mnt/ssd_standard/gigtos_warm';

-- Cold tablespace: HDD / cheaper disk for archived partitions
CREATE TABLESPACE ts_cold
  OWNER postgres
  LOCATION '/mnt/hdd/gigtos_cold';

-- Analytics tablespace: separate disk for materialized views (read-heavy)
CREATE TABLESPACE ts_analytics
  OWNER postgres
  LOCATION '/mnt/ssd_read/gigtos_analytics';
```

---

### 2.3 Table-to-Tablespace Assignment

```sql
-- ── HOT segment (SSD, fast random I/O) ────────────────────────────────────
CREATE TABLE bookings_active   (...) TABLESPACE ts_hot;
CREATE TABLE users             (...) TABLESPACE ts_hot;
CREATE TABLE workers           (...) TABLESPACE ts_hot;
CREATE TABLE admins            (...) TABLESPACE ts_hot;
CREATE TABLE disputes          (...) TABLESPACE ts_hot;
CREATE TABLE booking_quotes    (...) TABLESPACE ts_hot;

-- ── WARM segment (standard SSD, sequential I/O) ───────────────────────────
CREATE TABLE activity_logs_2026_04 (...) TABLESPACE ts_warm;  -- current month
CREATE TABLE activity_logs_2026_03 (...) TABLESPACE ts_warm;  -- last month
CREATE TABLE booking_chat_2026_04  (...) TABLESPACE ts_warm;
CREATE TABLE commissions           (...) TABLESPACE ts_warm;
CREATE TABLE cashbacks             (...) TABLESPACE ts_warm;

-- ── COLD segment (HDD, bulk sequential scans only) ────────────────────────
CREATE TABLE bookings_closed       (...) TABLESPACE ts_cold;
-- Old partitions moved here after 6 months:
-- ALTER TABLE activity_logs_2025_10 SET TABLESPACE ts_cold;

-- ── ANALYTICS segment (read-optimized SSD) ────────────────────────────────
-- Materialized views live here (see Part 3 — Projections)
```

---

### 2.4 Schema Segmentation (Logical Isolation)

Beyond physical tablespaces, split the database into **PostgreSQL schemas** to logically isolate OLTP from analytics:

```sql
-- OLTP schema: all transactional tables (default search_path for app)
CREATE SCHEMA gigtos_oltp;

-- Analytics schema: materialized views, aggregation tables
CREATE SCHEMA gigtos_analytics;

-- Archive schema: detached old partitions before final drop
CREATE SCHEMA gigtos_archive;

-- Set search path for app connections (only see OLTP tables by default)
ALTER ROLE gigtos_app_user SET search_path = gigtos_oltp, public;

-- Analytics role (read-only on analytics schema)
CREATE ROLE gigtos_analytics_reader;
GRANT USAGE ON SCHEMA gigtos_analytics TO gigtos_analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA gigtos_analytics TO gigtos_analytics_reader;
```

---

### 2.5 Data Segmentation by Region (Multi-Tenant Sharding — Future Scale)

At 10 lakh+ users across multiple states/regions, you can add a **region_code** column and partition by `LIST (region_code)`:

```sql
-- Future: bookings segmented by region
CREATE TABLE bookings_active_ap PARTITION OF bookings_active
  FOR VALUES IN ('AP');    -- Andhra Pradesh

CREATE TABLE bookings_active_ts PARTITION OF bookings_active
  FOR VALUES IN ('TS');    -- Telangana

CREATE TABLE bookings_active_ka PARTITION OF bookings_active
  FOR VALUES IN ('KA');    -- Karnataka
```

This means a region lead in AP only ever scans `bookings_active_ap` — query planner eliminates all other regions automatically.

---

## Part 3 — Projections

### 3.1 What Are Projections in This Context?

**Projections** are a Vertica/columnar DB concept, but in PostgreSQL they translate to two equivalent mechanisms:

| Projection Type | PostgreSQL Equivalent | Use Case |
|---|---|---|
| Column projection (subset of columns) | **Covering index** (`INCLUDE`) | Avoid heap fetch for frequent read queries |
| Aggregation projection | **Materialized View** | Pre-compute `COUNT`, `SUM`, `AVG` results |
| Partial projection (filtered subset) | **Partial index** | Index only active/relevant rows |

All three are used below.

---

### 3.2 Covering Indexes (Column Projections)

A covering index stores extra columns alongside the key so the query engine never needs to fetch the actual table row ("index-only scan").

```sql
-- ── Booking list screen: user opens app → sees their bookings ─────────────
-- Query: SELECT booking_id, status, issue_title, created_at FROM bookings WHERE user_id = $1
CREATE INDEX idx_bookings_user_cover
  ON bookings_active (user_id)
  INCLUDE (booking_id, status, issue_title, created_at);
-- → Index-only scan: zero heap I/O for this common query

-- ── Admin dashboard: list bookings assigned to admin ──────────────────────
-- Query: SELECT booking_id, status, created_at, user_id FROM bookings WHERE admin_id = $1
CREATE INDEX idx_bookings_admin_cover
  ON bookings_active (admin_id)
  INCLUDE (booking_id, status, created_at, user_id, assigned_worker_id);

-- ── Worker assignment: find available workers by area + type ──────────────
-- Query: SELECT worker_id, name, rating, is_top_listed FROM workers
--        WHERE area = $1 AND service_type_id = $2 AND is_available = TRUE ...
CREATE INDEX idx_workers_assign_cover
  ON workers (area, service_type_id, is_available)
  INCLUDE (worker_id, name, rating, is_top_listed, admin_id)
  WHERE status = 'active' AND approval_status = 'approved' AND is_fraud = FALSE;
-- → Partial covering index: only indexes active, approved, non-fraud workers
--   Dramatically smaller index (maybe 300 rows vs 1000)

-- ── Dispute escalation check ──────────────────────────────────────────────
-- Query: SELECT dispute_id, booking_id, raised_at FROM disputes WHERE status = 'open'
CREATE INDEX idx_disputes_open_cover
  ON disputes (status, raised_at)
  INCLUDE (dispute_id, booking_id, escalation_status)
  WHERE status = 'open';
-- → Partial: only open disputes (closed disputes never queried here)

-- ── Cashback expiry batch job ─────────────────────────────────────────────
-- Query: UPDATE cashbacks SET status='expired' WHERE status='active' AND expires_at < NOW()
CREATE INDEX idx_cashbacks_expiry_cover
  ON cashbacks (status, expires_at)
  INCLUDE (cashback_id, user_id, booking_id)
  WHERE status = 'active';

-- ── Alert feed: admin opens notification tray ─────────────────────────────
-- Query: SELECT alert_id, type, title, created_at FROM admin_alerts
--        WHERE admin_id = $1 AND status = 'open' ORDER BY created_at DESC
CREATE INDEX idx_alerts_admin_cover
  ON admin_alerts (admin_id, status, created_at DESC)
  INCLUDE (alert_id, type, title, booking_id)
  WHERE status = 'open';

-- ── Activity log: booking detail screen loads audit trail ─────────────────
-- Query: SELECT action, actor_role, from_status, to_status, created_at
--        FROM activity_logs WHERE booking_id = $1 ORDER BY created_at
CREATE INDEX idx_actlogs_booking_cover
  ON activity_logs (booking_id, created_at)
  INCLUDE (action, actor_role, from_status, to_status, reason);
```

---

### 3.3 Partial Indexes (Filtered Projections)

Partial indexes only index rows matching a `WHERE` condition — much smaller, faster to maintain.

```sql
-- Only index bookings that are NOT yet completed/cancelled (~5% of total)
-- Used by all "active dashboard" queries
CREATE INDEX idx_bookings_active_only
  ON bookings (admin_id, created_at DESC)
  WHERE status NOT IN ('completed','cancelled');

-- Only index workers that are currently available (used in auto-assignment)
CREATE UNIQUE INDEX idx_workers_phone
  ON workers (phone);

CREATE INDEX idx_workers_available
  ON workers (area, service_type_id)
  WHERE is_available = TRUE AND status = 'active' AND approval_status = 'approved';

-- Only index open disputes (closed ones are never scanned by scheduler)
CREATE INDEX idx_disputes_open_raised
  ON disputes (raised_at)
  WHERE status = 'open' AND escalation_status = FALSE;

-- Only index unresolved SLA breaches
CREATE INDEX idx_sla_unnotified
  ON booking_sla (booking_id)
  WHERE breached = TRUE AND notified = FALSE;
```

---

### 3.4 Materialized Views (Aggregation Projections)

Materialized views pre-compute expensive `JOIN + GROUP BY + COUNT` queries and store the result as a real table. Refresh on a schedule or after bulk writes.

#### MV 1: `mv_admin_stats` — Admin Dashboard Stats
```sql
CREATE MATERIALIZED VIEW gigtos_analytics.mv_admin_stats
TABLESPACE ts_analytics
AS
SELECT
  a.admin_id,
  a.name                                                         AS admin_name,
  a.area_name,
  a.region_score,
  a.probation_status,
  COUNT(DISTINCT b.booking_id) FILTER (
    WHERE b.status NOT IN ('completed','cancelled')
  )                                                              AS open_bookings,
  COUNT(DISTINCT d.dispute_id) FILTER (
    WHERE d.status = 'open'
  )                                                              AS open_disputes,
  COUNT(DISTINCT al.alert_id)  FILTER (
    WHERE al.status = 'open'
  )                                                              AS unread_alerts,
  ROUND(AVG(d2.resolution_time_hours), 2)                        AS avg_dispute_resolution_h
FROM gigtos_oltp.admins a
LEFT JOIN gigtos_oltp.bookings       b  ON b.admin_id  = a.admin_id
LEFT JOIN gigtos_oltp.disputes       d  ON d.booking_id = b.booking_id
LEFT JOIN gigtos_oltp.admin_alerts   al ON al.admin_id  = a.admin_id
LEFT JOIN (
  SELECT booking_id,
         EXTRACT(EPOCH FROM (resolution_time - raised_at)) / 3600 AS resolution_time_hours
  FROM gigtos_oltp.disputes WHERE status = 'resolved'
) d2 ON d2.booking_id = b.booking_id
GROUP BY a.admin_id, a.name, a.area_name, a.region_score, a.probation_status
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_admin_stats (admin_id);

-- Refresh every 5 minutes (fast because underlying tables are indexed)
SELECT cron.schedule('refresh_mv_admin_stats', '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_admin_stats');
```

#### MV 2: `mv_region_dispute_rate` — Probation Trigger
```sql
CREATE MATERIALIZED VIEW gigtos_analytics.mv_region_dispute_rate
TABLESPACE ts_analytics
AS
SELECT
  a.admin_id,
  a.name,
  a.area_name,
  COUNT(b.booking_id)                                            AS total_bookings_30d,
  COUNT(d.dispute_id)                                           AS total_disputes_30d,
  ROUND(
    COUNT(d.dispute_id)::NUMERIC /
    NULLIF(COUNT(b.booking_id), 0) * 100, 2
  )                                                             AS dispute_rate_pct,
  -- Flag for probation: >10% dispute rate
  (COUNT(d.dispute_id)::NUMERIC /
    NULLIF(COUNT(b.booking_id), 0) * 100) > 10                 AS should_probate
FROM gigtos_oltp.admins a
LEFT JOIN gigtos_oltp.bookings b
       ON b.admin_id = a.admin_id
      AND b.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN gigtos_oltp.disputes d ON d.booking_id = b.booking_id
WHERE a.role_id IN (
  SELECT id FROM gigtos_oltp.admin_roles
  WHERE role_name IN ('regionLead','mason')
)
GROUP BY a.admin_id, a.name, a.area_name
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_region_dispute_rate (admin_id);

-- Refresh once per hour (drives probation checks)
SELECT cron.schedule('refresh_mv_region_dispute_rate', '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_region_dispute_rate');
```

#### MV 3: `mv_worker_performance` — Worker Leaderboard / Top-Listing
```sql
CREATE MATERIALIZED VIEW gigtos_analytics.mv_worker_performance
TABLESPACE ts_analytics
AS
SELECT
  w.worker_id,
  w.name,
  w.area,
  w.rating,
  w.completed_jobs,
  w.total_earnings,
  w.is_top_listed,
  w.is_available,
  st.name                                                        AS service_type,
  COUNT(b.booking_id)                                           AS bookings_30d,
  ROUND(AVG(b.rating), 2)                                       AS avg_rating_30d,
  SUM(c.worker_share)                                           AS earnings_30d
FROM gigtos_oltp.workers w
JOIN gigtos_oltp.service_types st ON st.id = w.service_type_id
LEFT JOIN gigtos_oltp.bookings b
       ON b.assigned_worker_id = w.worker_id
      AND b.status = 'completed'
      AND b.finished_at >= NOW() - INTERVAL '30 days'
LEFT JOIN gigtos_oltp.commissions c ON c.booking_id = b.booking_id
GROUP BY w.worker_id, w.name, w.area, w.rating, w.completed_jobs,
         w.total_earnings, w.is_top_listed, w.is_available, st.name
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_worker_performance (worker_id);
CREATE INDEX ON gigtos_analytics.mv_worker_performance (area, service_type, is_available, avg_rating_30d DESC);

-- Refresh every 15 minutes
SELECT cron.schedule('refresh_mv_worker_perf', '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_worker_performance');
```

#### MV 4: `mv_daily_revenue` — Finance Dashboard
```sql
CREATE MATERIALIZED VIEW gigtos_analytics.mv_daily_revenue
TABLESPACE ts_analytics
AS
SELECT
  DATE_TRUNC('day', c.calculated_at)    AS revenue_date,
  COUNT(c.commission_id)                AS completed_bookings,
  SUM(c.total_visiting_charge)          AS total_revenue,
  SUM(c.worker_share)                   AS worker_payouts,
  SUM(c.local_admin_share)              AS admin_payouts,
  SUM(c.gigto_share)                    AS gigto_net_revenue,
  COUNT(cb.cashback_id)                 AS cashbacks_issued,
  SUM(cb.amount)                        AS cashback_value
FROM gigtos_oltp.commissions c
LEFT JOIN gigtos_oltp.cashbacks cb ON cb.booking_id = c.booking_id
GROUP BY DATE_TRUNC('day', c.calculated_at)
ORDER BY revenue_date DESC
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_daily_revenue (revenue_date);

-- Refresh once per day at midnight
SELECT cron.schedule('refresh_mv_daily_revenue', '0 0 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_daily_revenue');
```

#### MV 5: `mv_booking_status_funnel` — Conversion Funnel (Superadmin)
```sql
CREATE MATERIALIZED VIEW gigtos_analytics.mv_booking_status_funnel
TABLESPACE ts_analytics
AS
SELECT
  DATE_TRUNC('week', created_at)        AS week,
  COUNT(*) FILTER (WHERE status IN ('pending','scheduled','quoted','accepted','assigned','in_progress','awaiting_confirmation','completed','cancelled')) AS created,
  COUNT(*) FILTER (WHERE status IN ('quoted','accepted','assigned','in_progress','awaiting_confirmation','completed'))                AS reached_quoted,
  COUNT(*) FILTER (WHERE status IN ('accepted','assigned','in_progress','awaiting_confirmation','completed'))                        AS reached_accepted,
  COUNT(*) FILTER (WHERE status IN ('assigned','in_progress','awaiting_confirmation','completed'))                                   AS reached_assigned,
  COUNT(*) FILTER (WHERE status = 'completed')                                                                                       AS completed,
  COUNT(*) FILTER (WHERE status = 'cancelled')                                                                                       AS cancelled,
  ROUND(COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2)                               AS completion_rate_pct
FROM gigtos_oltp.bookings
GROUP BY DATE_TRUNC('week', created_at)
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_booking_status_funnel (week);

-- Refresh once per hour
SELECT cron.schedule('refresh_mv_funnel', '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_booking_status_funnel');
```

---

### 3.5 Projection Refresh Strategy

| Materialized View | Refresh Frequency | Method | Trigger |
|---|---|---|---|
| `mv_admin_stats` | Every 5 min | `CONCURRENTLY` | pg_cron schedule |
| `mv_region_dispute_rate` | Every 1 hour | `CONCURRENTLY` | pg_cron schedule |
| `mv_worker_performance` | Every 15 min | `CONCURRENTLY` | pg_cron schedule |
| `mv_daily_revenue` | Once per day at midnight | `CONCURRENTLY` | pg_cron schedule |
| `mv_booking_status_funnel` | Every 1 hour | `CONCURRENTLY` | pg_cron schedule |

`CONCURRENTLY` means the refresh does not lock the view — queries against it continue to work during refresh using the old snapshot.

---

## Part 4 — Combined Performance Summary

### Query Performance at 1 Lakh Users

| Query | Without Optimization | With Partitions + Projections | Improvement |
|---|---|---|---|
| Admin dashboard stats | Full scan on 200K alerts + bookings | Read from `mv_admin_stats` (500 rows) | ~1000× |
| User booking list | Full scan on 1M bookings | Index-only scan on `bookings_active` (50K rows) | ~50× |
| Activity log for a booking | Full scan on 10M logs | Partition prune to 100K + covering index | ~100× |
| Worker auto-assignment | Full scan on 1K workers | Partial covering index (~300 rows) | ~10× |
| Dispute escalation check | Full scan on 50K disputes | Partial index on open disputes only (~2K rows) | ~25× |
| Region probation check | Full scan + aggregation | Read from `mv_region_dispute_rate` (500 rows) | ~500× |
| Admin chat history | Scan all 2M chat messages | Partition prune to 200K current month | ~10× |

---

## Part 5 — Full Implementation Checklist

### Partitions
- [ ] Create `activity_logs` parent table with `PARTITION BY RANGE (created_at)`
- [ ] Create monthly partitions for `activity_logs` from project start through end of current year
- [ ] Create `booking_chat` parent table with `PARTITION BY RANGE (created_at)`
- [ ] Create monthly partitions for `booking_chat`
- [ ] Create `bookings` with `PARTITION BY LIST (status)` — `bookings_active` + `bookings_closed`
- [ ] Create `admin_alerts` with `PARTITION BY HASH (admin_id)` — 4 partitions
- [ ] Set up `pg_cron` job to auto-create next month's partitions on the 25th of each month
- [ ] Document retention policy and archival process to GCS

### Segments
- [ ] Create tablespaces `ts_hot`, `ts_warm`, `ts_cold`, `ts_analytics`
- [ ] Create schemas `gigtos_oltp`, `gigtos_analytics`, `gigtos_archive`
- [ ] Assign all core entity tables to `ts_hot`
- [ ] Assign current-month partitions to `ts_warm`
- [ ] Assign closed/old partitions to `ts_cold`
- [ ] Create roles `gigtos_app_user` (OLTP only) and `gigtos_analytics_reader` (analytics read-only)
- [ ] Design region-level sub-partition strategy (future: `LIST (region_code)`)

### Projections
- [ ] Create covering indexes on `bookings_active(user_id) INCLUDE (...)`
- [ ] Create covering index on `bookings_active(admin_id) INCLUDE (...)`
- [ ] Create partial covering index on `workers(area, service_type_id, is_available) INCLUDE (...)`
- [ ] Create partial covering index on `disputes(status, raised_at) INCLUDE (...)` WHERE open
- [ ] Create partial covering index on `cashbacks(status, expires_at) INCLUDE (...)` WHERE active
- [ ] Create covering index on `admin_alerts(admin_id, status, created_at) INCLUDE (...)`
- [ ] Create covering index on `activity_logs(booking_id, created_at) INCLUDE (...)`
- [ ] Create materialized view `mv_admin_stats` in `gigtos_analytics` schema
- [ ] Create materialized view `mv_region_dispute_rate`
- [ ] Create materialized view `mv_worker_performance`
- [ ] Create materialized view `mv_daily_revenue`
- [ ] Create materialized view `mv_booking_status_funnel`
- [ ] Schedule all `REFRESH MATERIALIZED VIEW CONCURRENTLY` jobs via pg_cron
- [ ] Verify index-only scans using `EXPLAIN (ANALYZE, BUFFERS)` on key queries

---

*Generated: 2026-04-06 | Author: GitHub Copilot | Repository: sureyeswanth2000-cell/Gigtos*  
*See also: `DATA_CONNECT_MIGRATION_PLAN.md` for the full table schemas, views, and stored procedures.*
