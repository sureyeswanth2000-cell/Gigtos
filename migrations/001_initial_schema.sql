-- ============================================================
-- Migration 001 — Initial Schema
-- Gigtos @ 1 Lakh Users — Firebase Data Connect (PostgreSQL)
-- Uses partitioned tables for activity_logs, booking_chat,
-- bookings (list by status), and admin_alerts (hash by admin_id)
-- Run ORDER: 001 → 002 → 003 → 004
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_cron";    -- automated partition creation

-- Schemas
CREATE SCHEMA IF NOT EXISTS gigtos_oltp;
CREATE SCHEMA IF NOT EXISTS gigtos_analytics;
CREATE SCHEMA IF NOT EXISTS gigtos_archive;

-- App-level roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gigtos_app_user') THEN
    CREATE ROLE gigtos_app_user;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gigtos_analytics_reader') THEN
    CREATE ROLE gigtos_analytics_reader;
  END IF;
END $$;

GRANT USAGE ON SCHEMA gigtos_oltp      TO gigtos_app_user;
GRANT USAGE ON SCHEMA gigtos_analytics TO gigtos_analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA gigtos_analytics TO gigtos_analytics_reader;

-- Default search path for app connections
ALTER ROLE gigtos_app_user SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- Tablespaces (adjust paths for your Cloud SQL instance)
-- ────────────────────────────────────────────────────────────
-- In Cloud SQL for PostgreSQL, tablespaces map to the default
-- data directory unless you configure additional disks.
-- Uncomment and adjust when using dedicated disks:
--
-- CREATE TABLESPACE ts_hot       OWNER postgres LOCATION '/mnt/ssd/gigtos_hot';
-- CREATE TABLESPACE ts_warm      OWNER postgres LOCATION '/mnt/ssd_standard/gigtos_warm';
-- CREATE TABLESPACE ts_cold      OWNER postgres LOCATION '/mnt/hdd/gigtos_cold';
-- CREATE TABLESPACE ts_analytics OWNER postgres LOCATION '/mnt/ssd_read/gigtos_analytics';

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — Lookup / Dimension Tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE service_types (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE time_slots (
  id          SERIAL       PRIMARY KEY,
  label       VARCHAR(50)  NOT NULL UNIQUE,
  start_hour  SMALLINT     NOT NULL,
  end_hour    SMALLINT     NOT NULL
);

CREATE TABLE admin_roles (
  id         SERIAL       PRIMARY KEY,
  role_name  VARCHAR(30)  NOT NULL UNIQUE
);

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — Core Entity Tables (HOT — most frequently read)
-- ────────────────────────────────────────────────────────────

CREATE TABLE users (
  user_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) NOT NULL UNIQUE,
  name         VARCHAR(120) NOT NULL,
  email        VARCHAR(200),
  phone        VARCHAR(20)  NOT NULL UNIQUE,
  address      TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE admins (
  admin_id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid         VARCHAR(128) NOT NULL UNIQUE,
  name                 VARCHAR(120) NOT NULL,
  email                VARCHAR(200) NOT NULL UNIQUE,
  role_id              INTEGER      NOT NULL REFERENCES admin_roles(id),
  parent_admin_id      UUID         REFERENCES admins(admin_id),
  area_name            VARCHAR(100),
  region_score         NUMERIC(5,2) NOT NULL DEFAULT 100,
  region_status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                         CHECK (region_status IN ('active','suspended')),
  probation_status     BOOLEAN      NOT NULL DEFAULT FALSE,
  fraud_count          INTEGER      NOT NULL DEFAULT 0,
  total_disputes       INTEGER      NOT NULL DEFAULT 0,
  avg_resolution_time  NUMERIC(8,2) NOT NULL DEFAULT 0,
  approval_status      VARCHAR(20)  NOT NULL DEFAULT 'pending'
                         CHECK (approval_status IN ('approved','pending')),
  status               VARCHAR(20)  NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','inactive')),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE workers (
  worker_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120)  NOT NULL,
  phone           VARCHAR(20)   NOT NULL UNIQUE,
  email           VARCHAR(200),
  area            VARCHAR(100)  NOT NULL,
  service_type_id INTEGER       NOT NULL REFERENCES service_types(id),
  certifications  TEXT,
  bank_details    TEXT,
  total_earnings  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20)   NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended')),
  approval_status VARCHAR(20)   NOT NULL DEFAULT 'pending'
                    CHECK (approval_status IN ('approved','pending','rejected')),
  is_available    BOOLEAN       NOT NULL DEFAULT TRUE,
  is_fraud        BOOLEAN       NOT NULL DEFAULT FALSE,
  rating          NUMERIC(3,2)  NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  completed_jobs  INTEGER       NOT NULL DEFAULT 0,
  is_top_listed   BOOLEAN       NOT NULL DEFAULT FALSE,
  admin_id        UUID          NOT NULL REFERENCES admins(admin_id),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — Booking Tables
-- bookings is LIST-partitioned by status:
--   bookings_active  → in-flight statuses
--   bookings_closed  → completed / cancelled (immutable, cold)
-- ────────────────────────────────────────────────────────────

CREATE TABLE bookings (
  booking_id              UUID         NOT NULL DEFAULT gen_random_uuid(),
  user_id                 UUID         NOT NULL,   -- FK enforced at app level; partitioned tables
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
  escrow_status           VARCHAR(30)  NOT NULL DEFAULT 'pending'
                            CHECK (escrow_status IN ('pending','pending_acceptance','held','released','refunded')),
  is_commission_processed BOOLEAN      NOT NULL DEFAULT FALSE,
  rating                  SMALLINT     CHECK (rating BETWEEN 1 AND 5),
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, status)
) PARTITION BY LIST (status);

-- Active partition — all in-flight bookings (~5% of total rows)
CREATE TABLE bookings_active PARTITION OF bookings
  FOR VALUES IN ('pending','scheduled','quoted','accepted','assigned',
                 'in_progress','awaiting_confirmation');

-- Closed partition — immutable completed/cancelled records
CREATE TABLE bookings_closed PARTITION OF bookings
  FOR VALUES IN ('completed','cancelled');

CREATE TABLE booking_quotes (
  quote_id    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID          NOT NULL,
  admin_id    UUID          NOT NULL REFERENCES admins(admin_id),
  price       NUMERIC(10,2) NOT NULL,
  is_accepted BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_photos (
  photo_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL,
  label       VARCHAR(200),
  url         TEXT        NOT NULL,
  photo_type  VARCHAR(20) NOT NULL CHECK (photo_type IN ('requested','submitted')),
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE booking_daily_notes (
  note_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL,
  note_date  DATE        NOT NULL,
  note       TEXT        NOT NULL,
  added_by   UUID        NOT NULL REFERENCES admins(admin_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- booking_chat — RANGE-partitioned monthly
-- Estimated 2M rows/year at 1L users
-- ────────────────────────────────────────────────────────────

CREATE TABLE booking_chat (
  message_id  UUID        NOT NULL DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL,
  sender_id   UUID        NOT NULL,
  sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user','admin','worker')),
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, created_at)
) PARTITION BY RANGE (created_at);

-- 2026 monthly partitions
CREATE TABLE booking_chat_2026_01 PARTITION OF booking_chat FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE booking_chat_2026_02 PARTITION OF booking_chat FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE booking_chat_2026_03 PARTITION OF booking_chat FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE booking_chat_2026_04 PARTITION OF booking_chat FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE booking_chat_2026_05 PARTITION OF booking_chat FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE booking_chat_2026_06 PARTITION OF booking_chat FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE booking_chat_2026_07 PARTITION OF booking_chat FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE booking_chat_2026_08 PARTITION OF booking_chat FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE booking_chat_2026_09 PARTITION OF booking_chat FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE booking_chat_2026_10 PARTITION OF booking_chat FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE booking_chat_2026_11 PARTITION OF booking_chat FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE booking_chat_2026_12 PARTITION OF booking_chat FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
-- 2027 Q1 — pre-created so pg_cron just tops up the remaining months
CREATE TABLE booking_chat_2027_01 PARTITION OF booking_chat FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE booking_chat_2027_02 PARTITION OF booking_chat FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE booking_chat_2027_03 PARTITION OF booking_chat FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — Financial Tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE commissions (
  commission_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id            UUID          NOT NULL UNIQUE,
  total_visiting_charge NUMERIC(10,2) NOT NULL DEFAULT 150,
  worker_share          NUMERIC(10,2) NOT NULL DEFAULT 80,
  local_admin_share     NUMERIC(10,2) NOT NULL DEFAULT 20,
  gigto_share           NUMERIC(10,2) NOT NULL DEFAULT 50,
  calculated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE cashbacks (
  cashback_id UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(user_id),
  booking_id  UUID          NOT NULL UNIQUE,
  amount      NUMERIC(8,2)  NOT NULL DEFAULT 9,
  status      VARCHAR(10)   NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  issued_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ   NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- SECTION 5 — Operational Tables
-- ────────────────────────────────────────────────────────────

CREATE TABLE disputes (
  dispute_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID        NOT NULL UNIQUE,
  status              VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  reason              TEXT,
  raised_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raised_by           UUID        NOT NULL REFERENCES users(user_id),
  auto_triggered      BOOLEAN     NOT NULL DEFAULT FALSE,
  escalation_status   BOOLEAN     NOT NULL DEFAULT FALSE,
  escalated_at        TIMESTAMPTZ,
  decision            VARCHAR(20) CHECK (decision IN ('user_fault','worker_fault','shared_fault')),
  resolution_time     TIMESTAMPTZ,
  resolved_by         UUID        REFERENCES admins(admin_id),
  superadmin_override BOOLEAN     NOT NULL DEFAULT FALSE,
  region_call_time    TIMESTAMPTZ,
  call_notes          TEXT,
  visit_time          TIMESTAMPTZ
);

CREATE TABLE booking_sla (
  sla_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID        NOT NULL UNIQUE,
  breached         BOOLEAN     NOT NULL DEFAULT FALSE,
  notified         BOOLEAN     NOT NULL DEFAULT FALSE,
  breached_at      TIMESTAMPTZ,
  status_at_breach VARCHAR(30),
  region_lead_id   UUID        REFERENCES admins(admin_id)
);

-- ────────────────────────────────────────────────────────────
-- activity_logs — RANGE-partitioned monthly
-- Estimated 5M–10M rows/year at 1L users — highest-volume table
-- ────────────────────────────────────────────────────────────

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
  PRIMARY KEY (log_id, created_at)
) PARTITION BY RANGE (created_at);

-- 2026 monthly partitions
CREATE TABLE activity_logs_2026_01 PARTITION OF activity_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE activity_logs_2026_02 PARTITION OF activity_logs FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE activity_logs_2026_03 PARTITION OF activity_logs FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE activity_logs_2026_04 PARTITION OF activity_logs FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE activity_logs_2026_05 PARTITION OF activity_logs FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE activity_logs_2026_06 PARTITION OF activity_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE activity_logs_2026_07 PARTITION OF activity_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE activity_logs_2026_08 PARTITION OF activity_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE activity_logs_2026_09 PARTITION OF activity_logs FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE activity_logs_2026_10 PARTITION OF activity_logs FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE activity_logs_2026_11 PARTITION OF activity_logs FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE activity_logs_2026_12 PARTITION OF activity_logs FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
-- 2027 Q1 pre-created
CREATE TABLE activity_logs_2027_01 PARTITION OF activity_logs FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE activity_logs_2027_02 PARTITION OF activity_logs FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE activity_logs_2027_03 PARTITION OF activity_logs FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- ────────────────────────────────────────────────────────────
-- admin_alerts — HASH-partitioned by admin_id (4 buckets)
-- Each admin's query hits exactly one partition
-- ────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────
-- SECTION 6 — Indexes
-- ────────────────────────────────────────────────────────────

-- users
CREATE UNIQUE INDEX idx_users_phone        ON users(phone);
CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- admins
CREATE UNIQUE INDEX idx_admins_firebase_uid  ON admins(firebase_uid);
CREATE        INDEX idx_admins_parent        ON admins(parent_admin_id);
CREATE        INDEX idx_admins_role          ON admins(role_id);

-- workers — partial covering index (active + approved + non-fraud only)
CREATE UNIQUE INDEX idx_workers_phone ON workers(phone);
CREATE        INDEX idx_workers_admin ON workers(admin_id);
CREATE        INDEX idx_workers_assign_cover
  ON workers(area, service_type_id, is_available)
  INCLUDE (worker_id, name, rating, is_top_listed, admin_id)
  WHERE status = 'active' AND approval_status = 'approved' AND is_fraud = FALSE;
CREATE        INDEX idx_workers_available
  ON workers(area, service_type_id)
  WHERE is_available = TRUE AND status = 'active' AND approval_status = 'approved';

-- bookings (covering indexes for dashboard queries — index-only scans)
CREATE INDEX idx_bookings_user_cover
  ON bookings_active(user_id)
  INCLUDE (booking_id, status, issue_title, created_at);
CREATE INDEX idx_bookings_admin_cover
  ON bookings_active(admin_id)
  INCLUDE (booking_id, status, created_at, user_id, assigned_worker_id);
CREATE INDEX idx_bookings_worker    ON bookings(assigned_worker_id);
CREATE INDEX idx_bookings_status    ON bookings(status);
CREATE INDEX idx_bookings_created   ON bookings(created_at DESC);
CREATE INDEX idx_bookings_status_date ON bookings(status, created_at);
CREATE INDEX idx_bookings_active_only
  ON bookings(admin_id, created_at DESC)
  WHERE status NOT IN ('completed','cancelled');

-- booking_quotes
CREATE INDEX idx_quotes_booking ON booking_quotes(booking_id);

-- booking_chat (on parent — applied to all partitions automatically)
CREATE INDEX idx_chat_booking_date ON booking_chat(booking_id, created_at);

-- disputes — partial covering index (open disputes only)
CREATE INDEX idx_disputes_status_date ON disputes(status, raised_at);
CREATE INDEX idx_disputes_open_cover
  ON disputes(status, raised_at)
  INCLUDE (dispute_id, booking_id, escalation_status)
  WHERE status = 'open';
CREATE INDEX idx_disputes_open_raised
  ON disputes(raised_at)
  WHERE status = 'open' AND escalation_status = FALSE;

-- cashbacks — partial covering index (active only — for expiry batch job)
CREATE INDEX idx_cashbacks_user_expiry ON cashbacks(user_id, status, expires_at);
CREATE INDEX idx_cashbacks_expiry_cover
  ON cashbacks(status, expires_at)
  INCLUDE (cashback_id, user_id, booking_id)
  WHERE status = 'active';

-- activity_logs (on parent — partitions get local copies automatically)
CREATE INDEX idx_actlogs_booking   ON activity_logs(booking_id);
CREATE INDEX idx_actlogs_created   ON activity_logs(created_at DESC);
CREATE INDEX idx_actlogs_actor     ON activity_logs(actor_id, created_at);
CREATE INDEX idx_actlogs_booking_cover
  ON activity_logs(booking_id, created_at)
  INCLUDE (action, actor_role, from_status, to_status, reason);

-- admin_alerts — covering index (admin opens notification tray)
CREATE INDEX idx_alerts_admin_status ON admin_alerts(admin_id, status);
CREATE INDEX idx_alerts_admin_cover
  ON admin_alerts(admin_id, status, created_at DESC)
  INCLUDE (alert_id, type, title, booking_id)
  WHERE status = 'open';

-- booking_sla
CREATE INDEX idx_sla_unnotified ON booking_sla(booking_id)
  WHERE breached = TRUE AND notified = FALSE;

-- ────────────────────────────────────────────────────────────
-- SECTION 7 — Automated Monthly Partition Creation (pg_cron)
-- Runs on the 25th of every month at 00:00 UTC
-- Creates next month's partitions for activity_logs + booking_chat
-- ────────────────────────────────────────────────────────────

SELECT cron.schedule(
  'create_monthly_partitions',
  '0 0 25 * *',
  $cron$
  DO $$
  DECLARE
    next_month_start DATE := date_trunc('month', NOW() + INTERVAL '1 month');
    next_month_end   DATE := next_month_start + INTERVAL '1 month';
    suffix           TEXT := to_char(next_month_start, 'YYYY_MM');
  BEGIN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS gigtos_oltp.activity_logs_%s
       PARTITION OF gigtos_oltp.activity_logs FOR VALUES FROM (%L) TO (%L)',
      suffix, next_month_start, next_month_end
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS gigtos_oltp.booking_chat_%s
       PARTITION OF gigtos_oltp.booking_chat FOR VALUES FROM (%L) TO (%L)',
      suffix, next_month_start, next_month_end
    );
  END;
  $$ LANGUAGE plpgsql;
  $cron$
);
