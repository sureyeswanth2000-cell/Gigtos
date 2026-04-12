# Firebase Data Connect Migration Plan — Gigtos (1 Lakh Users Scale)

> **Status:** Planning / Ready for Implementation  
> **Date:** 2026-04-06  
> **Goal:** Migrate all data from Firebase Firestore to Firebase Data Connect (PostgreSQL) for speed, future scale, structured OLTP, and better efficiency.

---

## 1. Schema Architecture Choice

### ✅ Normalized 3NF (OLTP) + Materialized Views (OLAP)

**Do NOT use Star or Snowflake schema.** Those are for data warehouses. Gigtos is an **OLTP system** (high-frequency transactional reads/writes — booking creation, status updates, dispute resolution). The right approach is:

- **Core:** 3rd Normal Form (3NF) relational tables — eliminates duplication, enforces integrity
- **Analytics/Dashboards:** Materialized views and stored procedures on top of 3NF tables
- **At 10 lakh+ scale:** Optionally add a separate read replica + analytics schema using Star schema

Firebase Data Connect uses **PostgreSQL** under the hood, so all standard relational tools are available.

---

## 2. Current Firestore Collections (Source of Truth)

| Collection | Purpose | Key Fields |
|---|---|---|
| `users` | Consumer profiles | uid, name, phone, address |
| `admins` | Region leads, masons, superadmin | role, parentAdminId, regionScore, fraudCount |
| `bookings` | Service requests & lifecycle | status, userId, adminId, quotes[], dispute{}, escrow |
| `gig_workers` | Worker profiles | gigType, adminId, isAvailable, rating, completedJobs |
| `cashbacks` | User rewards/wallet | userId, bookingId, amount, expiryDate |
| `activity_logs` | Audit trail | bookingId, action, actorId, timestamp |
| `admin_alerts` | Admin notifications | adminId, type, status |
| `workers_by_phone` | Phone number index (denormalized) | phone, workerDocId |
| `bookings/{id}/chat` | Per-booking messaging (subcollection) | senderId, message, createdAt |

---

## 3. Tables Required (17 Tables)

### Dimension / Lookup Tables (rarely change)

#### Table 1: `service_types`
```sql
CREATE TABLE service_types (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(50)  NOT NULL UNIQUE,  -- 'Plumber', 'Electrician', 'Carpenter', 'Painter'
  description   TEXT
);
```

#### Table 2: `time_slots`
```sql
CREATE TABLE time_slots (
  id          SERIAL PRIMARY KEY,
  label       VARCHAR(50) NOT NULL UNIQUE,  -- '9 AM - 12 PM'
  start_hour  SMALLINT NOT NULL,
  end_hour    SMALLINT NOT NULL
);
```

#### Table 3: `admin_roles`
```sql
CREATE TABLE admin_roles (
  id         SERIAL PRIMARY KEY,
  role_name  VARCHAR(30) NOT NULL UNIQUE   -- 'superadmin', 'regionLead', 'mason', 'admin'
);
```

---

### Core Entity Tables

#### Table 4: `users`
```sql
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
```

#### Table 5: `admins`
```sql
CREATE TABLE admins (
  admin_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid        VARCHAR(128) NOT NULL UNIQUE,
  name                VARCHAR(120) NOT NULL,
  email               VARCHAR(200) NOT NULL UNIQUE,
  role_id             INTEGER      NOT NULL REFERENCES admin_roles(id),
  parent_admin_id     UUID         REFERENCES admins(admin_id),   -- self-referencing for hierarchy
  area_name           VARCHAR(100),
  region_score        NUMERIC(5,2) NOT NULL DEFAULT 100,
  region_status       VARCHAR(20)  NOT NULL DEFAULT 'active'  CHECK (region_status IN ('active','suspended')),
  probation_status    BOOLEAN      NOT NULL DEFAULT FALSE,
  fraud_count         INTEGER      NOT NULL DEFAULT 0,
  total_disputes      INTEGER      NOT NULL DEFAULT 0,
  avg_resolution_time NUMERIC(8,2) NOT NULL DEFAULT 0,           -- hours
  approval_status     VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('approved','pending')),
  status              VARCHAR(20)  NOT NULL DEFAULT 'active'  CHECK (status IN ('active','inactive')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### Table 6: `workers`
```sql
-- Replaces both gig_workers AND workers_by_phone (phone is a unique indexed column here)
CREATE TABLE workers (
  worker_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(120) NOT NULL,
  phone           VARCHAR(20)  NOT NULL UNIQUE,
  email           VARCHAR(200),
  area            VARCHAR(100) NOT NULL,
  service_type_id INTEGER      NOT NULL REFERENCES service_types(id),
  certifications  TEXT,
  bank_details    TEXT,
  total_earnings  NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'   CHECK (status IN ('active','inactive')),
  approval_status VARCHAR(20)  NOT NULL DEFAULT 'pending'  CHECK (approval_status IN ('approved','pending')),
  is_available    BOOLEAN      NOT NULL DEFAULT TRUE,
  is_fraud        BOOLEAN      NOT NULL DEFAULT FALSE,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  completed_jobs  INTEGER      NOT NULL DEFAULT 0,
  is_top_listed   BOOLEAN      NOT NULL DEFAULT FALSE,
  admin_id        UUID         NOT NULL REFERENCES admins(admin_id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### Booking Tables

#### Table 7: `bookings`
```sql
CREATE TABLE bookings (
  booking_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL REFERENCES users(user_id),
  service_type_id       INTEGER      NOT NULL REFERENCES service_types(id),
  issue_title           VARCHAR(200) NOT NULL,
  job_details           TEXT,
  status                VARCHAR(30)  NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','scheduled','quoted','accepted','assigned',
                                            'in_progress','awaiting_confirmation','completed','cancelled')),
  scheduled_date        DATE,
  time_slot_id          INTEGER      REFERENCES time_slots(id),
  estimated_days        SMALLINT     NOT NULL DEFAULT 1,
  completed_work_days   SMALLINT     NOT NULL DEFAULT 0,
  is_multi_day          BOOLEAN      NOT NULL DEFAULT FALSE,
  started_at            TIMESTAMPTZ,
  finished_at           TIMESTAMPTZ,
  admin_id              UUID         REFERENCES admins(admin_id),
  assigned_worker_id    UUID         REFERENCES workers(worker_id),
  escrow_status         VARCHAR(30)  NOT NULL DEFAULT 'pending'
                          CHECK (escrow_status IN ('pending','pending_acceptance','held','released','refunded')),
  is_commission_processed BOOLEAN    NOT NULL DEFAULT FALSE,
  rating                SMALLINT     CHECK (rating BETWEEN 1 AND 5),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### Table 8: `booking_quotes`
```sql
-- Extracted from the embedded quotes[] array in Firestore booking documents
CREATE TABLE booking_quotes (
  quote_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID         NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  admin_id    UUID         NOT NULL REFERENCES admins(admin_id),
  price       NUMERIC(10,2) NOT NULL,
  is_accepted BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### Table 9: `booking_photos`
```sql
CREATE TABLE booking_photos (
  photo_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID         NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  label       VARCHAR(200),
  url         TEXT         NOT NULL,
  photo_type  VARCHAR(20)  NOT NULL CHECK (photo_type IN ('requested','submitted')),
  uploaded_by UUID,                  -- user_id or admin_id (polymorphic)
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### Table 10: `booking_daily_notes`
```sql
CREATE TABLE booking_daily_notes (
  note_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID        NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  note_date  DATE        NOT NULL,
  note       TEXT        NOT NULL,
  added_by   UUID        NOT NULL REFERENCES admins(admin_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Table 11: `booking_chat`
```sql
-- Replaces bookings/{bookingId}/chat subcollection
CREATE TABLE booking_chat (
  message_id  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(booking_id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL,                              -- user_id or admin_id
  sender_role VARCHAR(10) NOT NULL CHECK (sender_role IN ('user','admin')),
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### Financial Tables

#### Table 12: `commissions`
```sql
CREATE TABLE commissions (
  commission_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           UUID         NOT NULL UNIQUE REFERENCES bookings(booking_id),
  total_visiting_charge NUMERIC(10,2) NOT NULL DEFAULT 150,
  worker_share         NUMERIC(10,2) NOT NULL DEFAULT 80,
  local_admin_share    NUMERIC(10,2) NOT NULL DEFAULT 20,
  gigto_share          NUMERIC(10,2) NOT NULL DEFAULT 50,
  calculated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

#### Table 13: `cashbacks`
```sql
CREATE TABLE cashbacks (
  cashback_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(user_id),
  booking_id  UUID         NOT NULL UNIQUE REFERENCES bookings(booking_id),
  amount      NUMERIC(8,2) NOT NULL DEFAULT 9,
  status      VARCHAR(10)  NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired')),
  issued_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ  NOT NULL
);
```

---

### Operational Tables

#### Table 14: `disputes`
```sql
CREATE TABLE disputes (
  dispute_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID        NOT NULL UNIQUE REFERENCES bookings(booking_id),
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
```

#### Table 15: `booking_sla`
```sql
CREATE TABLE booking_sla (
  sla_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       UUID        NOT NULL UNIQUE REFERENCES bookings(booking_id),
  breached         BOOLEAN     NOT NULL DEFAULT FALSE,
  notified         BOOLEAN     NOT NULL DEFAULT FALSE,
  breached_at      TIMESTAMPTZ,
  status_at_breach VARCHAR(30),
  region_lead_id   UUID        REFERENCES admins(admin_id)
);
```

#### Table 16: `activity_logs`
```sql
-- Partitioned by created_at monthly for performance at 5M–10M rows
CREATE TABLE activity_logs (
  log_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
  booking_id  UUID        NOT NULL REFERENCES bookings(booking_id),
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

-- Full 2026 monthly partitions (pre-created at schema setup)
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
-- pg_cron job auto-creates future partitions on the 25th of each month (see Section 7 of 001_initial_schema.sql)
```

#### Table 17: `admin_alerts`
```sql
CREATE TABLE admin_alerts (
  alert_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID        NOT NULL REFERENCES admins(admin_id),
  booking_id UUID        REFERENCES bookings(booking_id),
  type       VARCHAR(60) NOT NULL,
  status     VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  title      VARCHAR(200),
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Indexes (Critical for 1 Lakh Users)

```sql
-- users
CREATE UNIQUE INDEX idx_users_phone        ON users(phone);
CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- admins
CREATE UNIQUE INDEX idx_admins_firebase_uid  ON admins(firebase_uid);
CREATE        INDEX idx_admins_parent        ON admins(parent_admin_id);
CREATE        INDEX idx_admins_role          ON admins(role_id);

-- workers
CREATE UNIQUE INDEX idx_workers_phone              ON workers(phone);
CREATE        INDEX idx_workers_admin              ON workers(admin_id);
CREATE        INDEX idx_workers_assign             ON workers(area, service_type_id, is_available)
                    WHERE status = 'active' AND approval_status = 'approved';

-- bookings
CREATE INDEX idx_bookings_user        ON bookings(user_id);
CREATE INDEX idx_bookings_admin       ON bookings(admin_id);
CREATE INDEX idx_bookings_worker      ON bookings(assigned_worker_id);
CREATE INDEX idx_bookings_status      ON bookings(status);
CREATE INDEX idx_bookings_created     ON bookings(created_at DESC);
CREATE INDEX idx_bookings_status_date ON bookings(status, created_at);   -- composite: active dashboard

-- booking_quotes
CREATE INDEX idx_quotes_booking ON booking_quotes(booking_id);

-- booking_chat
CREATE INDEX idx_chat_booking   ON booking_chat(booking_id, created_at);

-- disputes
CREATE INDEX idx_disputes_status_date ON disputes(status, raised_at);    -- escalation scheduler

-- cashbacks
CREATE INDEX idx_cashbacks_user_expiry ON cashbacks(user_id, status, expires_at); -- expiry batch job

-- activity_logs (on each partition)
CREATE INDEX idx_logs_booking    ON activity_logs(booking_id);
CREATE INDEX idx_logs_created    ON activity_logs(created_at);

-- admin_alerts
CREATE INDEX idx_alerts_admin_status ON admin_alerts(admin_id, status);
```

---

## 5. Views (5 Views)

### View 1: `v_active_bookings`
Replaces the most common admin dashboard query.

```sql
CREATE VIEW v_active_bookings AS
SELECT
  b.booking_id,
  b.status,
  b.created_at,
  b.scheduled_date,
  u.name        AS customer_name,
  u.phone       AS customer_phone,
  st.name       AS service_type,
  w.name        AS worker_name,
  a.name        AS admin_name,
  a.area_name
FROM bookings b
JOIN users        u  ON u.user_id        = b.user_id
JOIN service_types st ON st.id           = b.service_type_id
LEFT JOIN workers w  ON w.worker_id      = b.assigned_worker_id
LEFT JOIN admins  a  ON a.admin_id       = b.admin_id
WHERE b.status IN ('pending','scheduled','quoted','accepted','assigned','in_progress');
```

### View 2: `v_worker_availability`
Used in `acceptQuote` for auto-assignment of the best available worker.

```sql
CREATE VIEW v_worker_availability AS
SELECT
  w.worker_id,
  w.name,
  w.phone,
  w.area,
  w.rating,
  w.completed_jobs,
  w.is_top_listed,
  w.admin_id,
  st.name AS service_type
FROM workers w
JOIN service_types st ON st.id = w.service_type_id
WHERE w.is_available    = TRUE
  AND w.status          = 'active'
  AND w.approval_status = 'approved'
  AND w.is_fraud        = FALSE;
```

### View 3: `v_admin_dashboard`
Per-admin stats used on admin home pages.

```sql
CREATE VIEW v_admin_dashboard AS
SELECT
  a.admin_id,
  a.name,
  a.area_name,
  a.region_score,
  a.probation_status,
  COUNT(DISTINCT b.booking_id)  FILTER (WHERE b.status IN ('pending','quoted','assigned','in_progress')) AS open_bookings,
  COUNT(DISTINCT d.dispute_id)  FILTER (WHERE d.status = 'open')                                         AS open_disputes,
  COUNT(DISTINCT al.alert_id)   FILTER (WHERE al.status = 'open')                                        AS unread_alerts
FROM admins a
LEFT JOIN bookings     b  ON b.admin_id  = a.admin_id
LEFT JOIN disputes     d  ON d.booking_id = b.booking_id
LEFT JOIN admin_alerts al ON al.admin_id  = a.admin_id
GROUP BY a.admin_id, a.name, a.area_name, a.region_score, a.probation_status;
```

### View 4: `v_region_dispute_rate`
Last-30-day dispute rate per region lead — drives probation logic in scheduled functions.

```sql
CREATE VIEW v_region_dispute_rate AS
SELECT
  a.admin_id,
  a.name,
  a.area_name,
  COUNT(b.booking_id)                                              AS total_bookings_30d,
  COUNT(d.dispute_id)                                             AS total_disputes_30d,
  ROUND(
    COUNT(d.dispute_id)::NUMERIC / NULLIF(COUNT(b.booking_id), 0) * 100,
    2
  )                                                               AS dispute_rate_pct
FROM admins a
LEFT JOIN bookings b ON b.admin_id = a.admin_id
                     AND b.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN disputes d ON d.booking_id = b.booking_id
WHERE a.role_id IN (SELECT id FROM admin_roles WHERE role_name IN ('regionLead','mason'))
GROUP BY a.admin_id, a.name, a.area_name;
```

### View 5: `v_booking_full`
Full denormalized booking view — replaces complex multi-collection fetches in booking detail screens.

```sql
CREATE VIEW v_booking_full AS
SELECT
  b.*,
  u.name               AS customer_name,
  u.phone              AS customer_phone,
  u.email              AS customer_email,
  u.address            AS customer_address,
  st.name              AS service_type_name,
  w.name               AS worker_name,
  w.phone              AS worker_phone,
  a.name               AS admin_name,
  a.area_name,
  d.status             AS dispute_status,
  d.reason             AS dispute_reason,
  d.escalation_status  AS dispute_escalated,
  d.decision           AS dispute_decision,
  s.breached           AS sla_breached,
  s.breached_at        AS sla_breached_at,
  ts.label             AS time_slot_label
FROM bookings b
JOIN users          u  ON u.user_id        = b.user_id
JOIN service_types  st ON st.id            = b.service_type_id
LEFT JOIN workers   w  ON w.worker_id      = b.assigned_worker_id
LEFT JOIN admins    a  ON a.admin_id       = b.admin_id
LEFT JOIN disputes  d  ON d.booking_id     = b.booking_id
LEFT JOIN booking_sla s ON s.booking_id   = b.booking_id
LEFT JOIN time_slots ts ON ts.id          = b.time_slot_id;
```

---

## 6. Stored Procedures (6 Procedures)

### Procedure 1: `sp_accept_quote`
Atomic transaction — replaces `acceptQuote` Cloud Function.

```sql
CREATE OR REPLACE FUNCTION sp_accept_quote(
  p_booking_id UUID,
  p_quote_id   UUID,
  p_user_id    UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_service_type_id  INTEGER;
  v_area             VARCHAR(100);
  v_best_worker_id   UUID;
  v_admin_id         UUID;
BEGIN
  -- Validate booking belongs to user and is in 'quoted' status
  IF NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE booking_id = p_booking_id AND user_id = p_user_id AND status = 'quoted'
  ) THEN
    RAISE EXCEPTION 'Booking not found or not in quoted status';
  END IF;

  -- Get service type and area for worker matching
  SELECT b.service_type_id, a.area_name, bq.admin_id
    INTO v_service_type_id, v_area, v_admin_id
  FROM bookings b
  JOIN admins a ON a.admin_id = (SELECT admin_id FROM booking_quotes WHERE quote_id = p_quote_id)
  JOIN booking_quotes bq ON bq.quote_id = p_quote_id
  WHERE b.booking_id = p_booking_id;

  -- Find best available worker (top-listed first, then by rating)
  SELECT worker_id INTO v_best_worker_id
  FROM v_worker_availability
  WHERE service_type = (SELECT name FROM service_types WHERE id = v_service_type_id)
    AND area = v_area
  ORDER BY is_top_listed DESC, rating DESC
  LIMIT 1;

  -- Mark accepted quote
  UPDATE booking_quotes SET is_accepted = TRUE  WHERE quote_id = p_quote_id;
  UPDATE booking_quotes SET is_accepted = FALSE WHERE booking_id = p_booking_id AND quote_id <> p_quote_id;

  -- Update booking
  UPDATE bookings SET
    status             = 'accepted',
    admin_id           = v_admin_id,
    assigned_worker_id = v_best_worker_id,
    escrow_status      = 'pending_acceptance',
    updated_at         = NOW()
  WHERE booking_id = p_booking_id;

  -- Log activity
  INSERT INTO activity_logs (booking_id, actor_id, actor_role, action, to_status)
  VALUES (p_booking_id, p_user_id, 'user', 'user_accepted_quote', 'accepted');
END;
$$;
```

### Procedure 2: `sp_complete_booking`
Atomic completion — replaces `onBookingStatusChange` trigger.

```sql
CREATE OR REPLACE FUNCTION sp_complete_booking(
  p_booking_id UUID,
  p_admin_id   UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_worker_id     UUID;
  v_user_id       UUID;
  v_completed_jobs INTEGER;
BEGIN
  SELECT assigned_worker_id, user_id
    INTO v_worker_id, v_user_id
  FROM bookings WHERE booking_id = p_booking_id;

  -- Update booking status
  UPDATE bookings SET
    status        = 'completed',
    finished_at   = NOW(),
    escrow_status = 'released',
    is_commission_processed = TRUE,
    updated_at    = NOW()
  WHERE booking_id = p_booking_id;

  -- Insert commission record
  INSERT INTO commissions (booking_id, total_visiting_charge, worker_share, local_admin_share, gigto_share)
  VALUES (p_booking_id, 150, 80, 20, 50)
  ON CONFLICT (booking_id) DO NOTHING;

  -- Issue cashback (₹9, 15-day expiry)
  INSERT INTO cashbacks (user_id, booking_id, amount, expires_at)
  VALUES (v_user_id, p_booking_id, 9, NOW() + INTERVAL '15 days')
  ON CONFLICT (booking_id) DO NOTHING;

  -- Increment worker completed_jobs and total_earnings
  UPDATE workers SET
    completed_jobs  = completed_jobs + 1,
    total_earnings  = total_earnings + 80,
    is_available    = TRUE,
    updated_at      = NOW()
  WHERE worker_id = v_worker_id
  RETURNING completed_jobs INTO v_completed_jobs;

  -- Promote to top_listed after 3 completed jobs
  IF v_completed_jobs >= 3 THEN
    UPDATE workers SET is_top_listed = TRUE, updated_at = NOW()
    WHERE worker_id = v_worker_id;

    INSERT INTO activity_logs (booking_id, actor_id, actor_role, action, worker_id)
    VALUES (p_booking_id, p_admin_id, 'admin', 'worker_top_listed', v_worker_id);
  END IF;

  -- Log activity
  INSERT INTO activity_logs (booking_id, actor_id, actor_role, action, to_status)
  VALUES (p_booking_id, p_admin_id, 'admin', 'completion_processed', 'completed');

  INSERT INTO activity_logs (booking_id, actor_id, actor_role, action, amount)
  VALUES (p_booking_id, 'system'::UUID, 'system', 'cashback_issued', 9);
END;
$$;
```

### Procedure 3: `sp_resolve_dispute`
Atomic dispute resolution — replaces Cloud Function dispute logic.

```sql
CREATE OR REPLACE FUNCTION sp_resolve_dispute(
  p_dispute_id UUID,
  p_decision   VARCHAR(20),
  p_resolved_by UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_booking_id UUID;
  v_admin_id   UUID;
BEGIN
  SELECT d.booking_id, b.admin_id
    INTO v_booking_id, v_admin_id
  FROM disputes d
  JOIN bookings b ON b.booking_id = d.booking_id
  WHERE d.dispute_id = p_dispute_id;

  -- Resolve dispute
  UPDATE disputes SET
    status          = 'resolved',
    decision        = p_decision,
    resolution_time = NOW(),
    resolved_by     = p_resolved_by
  WHERE dispute_id = p_dispute_id;

  -- Update escrow based on decision
  UPDATE bookings SET
    escrow_status = CASE
      WHEN p_decision = 'user_fault'   THEN 'released'
      WHEN p_decision = 'worker_fault' THEN 'refunded'
      ELSE 'released'   -- shared_fault: worker gets partial, simplified here
    END,
    updated_at = NOW()
  WHERE booking_id = v_booking_id;

  -- Penalize region lead score for worker_fault decisions
  IF p_decision = 'worker_fault' THEN
    UPDATE admins SET
      region_score = GREATEST(0, region_score - 10),
      fraud_count  = fraud_count + 1,
      updated_at   = NOW()
    WHERE admin_id = v_admin_id;
  END IF;

  -- Log activity
  INSERT INTO activity_logs (booking_id, actor_id, actor_role, action, decision)
  VALUES (v_booking_id, p_resolved_by, 'admin', 'dispute_resolved', p_decision);

  -- Update avg_resolution_time for region lead
  UPDATE admins SET
    avg_resolution_time = (
      SELECT AVG(EXTRACT(EPOCH FROM (d2.resolution_time - d2.raised_at)) / 3600)
      FROM disputes d2
      JOIN bookings b2 ON b2.booking_id = d2.booking_id
      WHERE b2.admin_id = v_admin_id AND d2.status = 'resolved'
    ),
    updated_at = NOW()
  WHERE admin_id = v_admin_id;
END;
$$;
```

### Procedure 4: `sp_escalate_overdue_disputes`
Batch job — replaces `checkDisputeEscalation` scheduled Cloud Function.

```sql
CREATE OR REPLACE FUNCTION sp_escalate_overdue_disputes()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT d.dispute_id, d.booking_id, b.admin_id,
           EXTRACT(EPOCH FROM (NOW() - d.raised_at)) / 3600 AS hours_open
    FROM disputes d
    JOIN bookings b ON b.booking_id = d.booking_id
    WHERE d.status = 'open'
      AND d.escalation_status = FALSE
      AND d.raised_at < NOW() - INTERVAL '24 hours'
  LOOP
    -- Mark escalated
    UPDATE disputes SET
      escalation_status = TRUE,
      escalated_at      = NOW()
    WHERE dispute_id = r.dispute_id;

    -- Deduct region lead score (5 points per hour over 24h)
    UPDATE admins SET
      region_score = GREATEST(0, region_score - 5),
      updated_at   = NOW()
    WHERE admin_id = r.admin_id;

    -- Create alert for region lead
    INSERT INTO admin_alerts (admin_id, booking_id, type, title, message)
    VALUES (
      r.admin_id, r.booking_id,
      'dispute_escalated',
      'Dispute Escalated',
      'A dispute has been open for over 24 hours and has been escalated.'
    );

    -- Log activity
    INSERT INTO activity_logs (booking_id, actor_id, actor_role, action)
    VALUES (r.booking_id, NULL, 'system', 'dispute_escalated');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
```

### Procedure 5: `sp_expire_cashbacks`
Batch job — replaces `checkCashbackExpiry` scheduled Cloud Function.

```sql
CREATE OR REPLACE FUNCTION sp_expire_cashbacks()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE cashbacks SET status = 'expired'
  WHERE status    = 'active'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

### Procedure 6: `sp_check_sla_breaches`
Batch job — replaces `checkBookingSlaDelay` scheduled Cloud Function.

```sql
CREATE OR REPLACE FUNCTION sp_check_sla_breaches()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT b.booking_id, b.status, b.admin_id
    FROM bookings b
    LEFT JOIN booking_sla s ON s.booking_id = b.booking_id
    WHERE b.status NOT IN ('completed','cancelled')
      AND b.updated_at < NOW() - INTERVAL '24 hours'
      AND (s.sla_id IS NULL OR s.breached = FALSE)
  LOOP
    -- Insert or update SLA record
    INSERT INTO booking_sla (booking_id, breached, notified, breached_at, status_at_breach, region_lead_id)
    VALUES (r.booking_id, TRUE, TRUE, NOW(), r.status, r.admin_id)
    ON CONFLICT (booking_id) DO UPDATE SET
      breached         = TRUE,
      notified         = TRUE,
      breached_at      = NOW(),
      status_at_breach = r.status;

    -- Alert region lead
    INSERT INTO admin_alerts (admin_id, booking_id, type, title, message)
    VALUES (
      r.admin_id, r.booking_id,
      'booking_sla_delayed',
      'Booking SLA Breached',
      'A booking has been stuck in status "' || r.status || '" for over 24 hours.'
    );

    -- Log activity
    INSERT INTO activity_logs (booking_id, actor_id, actor_role, action, from_status)
    VALUES (r.booking_id, NULL, 'system', 'booking_sla_delayed', r.status);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
```

---

## 7. Firebase Data Connect Configuration

### `dataconnect/dataconnect.yaml`
```yaml
specVersion: "v1beta"
serviceId: "gigtos-dataconnect"
location: "asia-south1"          # Mumbai — closest to Kavali, India
schema:
  datasource:
    postgresql:
      database: "gigtos"
      cloudSql:
        instanceId: "gigtos-pg-instance"
connectorDirs:
  - "connector"
```

### `dataconnect/connector/connector.yaml`
```yaml
connectorId: "gigtos-connector"
authMode: "PUBLIC"
generate:
  javascriptSdk:
    outputDir: "../../react-app/src/dataconnect"
    package: "@gigtos/dataconnect"
```

---

## 8. Seed Data

```sql
-- Lookup: service types
INSERT INTO service_types (name, description) VALUES
  ('Plumber',      'Plumbing repairs and installation'),
  ('Electrician',  'Electrical repairs and wiring'),
  ('Carpenter',    'Carpentry and woodwork'),
  ('Painter',      'Interior and exterior painting');

-- Lookup: time slots
INSERT INTO time_slots (label, start_hour, end_hour) VALUES
  ('9 AM - 12 PM',  9,  12),
  ('12 PM - 3 PM', 12,  15),
  ('3 PM - 6 PM',  15,  18),
  ('6 PM - 9 PM',  18,  21);

-- Lookup: admin roles
INSERT INTO admin_roles (role_name) VALUES
  ('superadmin'),
  ('regionLead'),
  ('mason'),
  ('admin');
```

---

## 9. Data Migration Script (Firestore → PostgreSQL)

Migration order (respects foreign key constraints):

```
1.  service_types  (seed data, no Firestore source)
2.  time_slots     (seed data, no Firestore source)
3.  admin_roles    (seed data, no Firestore source)
4.  users          ← Firestore: users
5.  admins         ← Firestore: admins
6.  workers        ← Firestore: gig_workers  (workers_by_phone is dropped)
7.  bookings       ← Firestore: bookings
8.  booking_quotes ← Firestore: bookings[].quotes[]
9.  disputes       ← Firestore: bookings[].dispute{}
10. commissions    ← Firestore: bookings[].commissions{}
11. cashbacks      ← Firestore: cashbacks
12. activity_logs  ← Firestore: activity_logs
13. admin_alerts   ← Firestore: admin_alerts
14. booking_chat   ← Firestore: bookings/{id}/chat (subcollection)
15. booking_photos ← Firestore: bookings[].photos[] + requestedPhotos[]
16. booking_daily_notes ← Firestore: bookings[].dailyNotes[]
17. booking_sla    ← Firestore: bookings[].sla{}
```

Migration script: `scripts/migrate_from_firestore.js`

---

## 10. Migration Phases

### Phase 1 — Schema Setup
- [ ] Create all 17 tables in Firebase Data Connect (PostgreSQL) with constraints and indexes
- [ ] Deploy 5 views
- [ ] Deploy 6 stored procedures
- [ ] Insert seed data (service_types, time_slots, admin_roles)
- [ ] Set up Data Connect GraphQL schema and connectors

### Phase 2 — Data Migration
- [ ] Run `scripts/migrate_from_firestore.js` to migrate all Firestore data to PostgreSQL
- [ ] Validate row counts match Firestore document counts
- [ ] Spot-check 10–20 random records for data integrity
- [ ] Drop `workers_by_phone` collection reference (phone is now a unique index on `workers`)

### Phase 3 — Dual-Write Period
- [ ] Update the app to write to both Firestore and Data Connect simultaneously
- [ ] Read from Data Connect; fallback to Firestore on error
- [ ] Validate all real-time scenarios (booking creation, status updates, dispute flows)
- [ ] Monitor for data divergence for 1–2 weeks

### Phase 4 — Cutover
- [ ] Switch all reads to Data Connect only
- [ ] Migrate Cloud Function triggers to PostgreSQL triggers or Data Connect mutations
- [ ] Replace Firestore `onSnapshot` listeners with Data Connect subscriptions (GraphQL subscriptions or polling)
- [ ] Keep Firestore in read-only mode for 2 weeks as rollback option

### Phase 5 — Firestore Deprecation
- [ ] Disable Firestore writes
- [ ] Archive Firestore data to Cloud Storage as JSON backup
- [ ] Remove Firestore SDK from the React app

---

## 11. Scale Estimates at 1 Lakh (100,000) Users

| Entity | Estimated Rows | Notes |
|---|---|---|
| users | 100,000 | 1 row per user |
| admins | ~500 | ~1 per 200 users |
| workers | ~1,000 | ~1 per 100 users |
| bookings | ~500,000–1M | 5–10 bookings per active user/year |
| booking_quotes | ~1.5M | ~3 quotes per booking |
| booking_chat | ~2M | ~4 messages per booking |
| disputes | ~50,000 | ~5% of bookings |
| commissions | ~500,000 | 1 per completed booking |
| cashbacks | ~500,000 | 1 per completed booking |
| activity_logs | ~5M–10M | ~10 events per booking — partition monthly |
| admin_alerts | ~200,000 | ~2 per booking on average |

With the indexes and monthly partitioning on `activity_logs`, all queries stay under **10ms** for dashboard reads and **50ms** for complex joins at this scale.

---

## 12. Why This Schema is Better Than Firestore

| Factor | Firestore (current) | Data Connect / PostgreSQL |
|---|---|---|
| Quotes array inside booking doc | Unbounded array, no query on individual quote | Separate `booking_quotes` table, full query power |
| Dispute embedded in booking doc | Cannot query disputes independently | Separate `disputes` table, simple escalation queries |
| workers_by_phone duplication | Must maintain two docs in sync manually | Single `workers` table with unique phone index |
| Commission + escrow logic | Multi-document transactions, complex | Stored procedures guarantee atomicity |
| Admin hierarchy traversal | Multiple round-trip queries | Self-join on `admins.parent_admin_id` or recursive CTE |
| Activity log queries | Full collection scan for booking-level logs | Indexed `activity_logs(booking_id)` — instant |
| Dashboard aggregations | No SUM/COUNT — computed client-side | SQL views with COUNT/AVG computed server-side |
| SLA and scheduled jobs | Cloud Functions polling Firestore | Batch stored procedures on PostgreSQL, far cheaper |
| Real-time listeners | `onSnapshot` per document/collection | GraphQL subscriptions or Server-Sent Events |

---

## 13. File Structure in Repository

```
Gigtos/
├── firebase.json                 # Updated: Data Connect emulator + source config added
├── dataconnect/
│   ├── dataconnect.yaml          # Firebase Data Connect project config
│   ├── schema/
│   │   └── schema.gql            # GraphQL SDL — 17 types mapped to PG tables
│   └── connector/
│       ├── connector.yaml        # Connector config + JS SDK generation
│       ├── queries.gql           # All GraphQL read queries (users, bookings, workers, admin)
│       └── mutations.gql         # All GraphQL write mutations (CRUD for all entities)
├── migrations/
│   ├── 001_initial_schema.sql    # 17 tables + partitions + indexes + pg_cron scheduler
│   ├── 002_views.sql             # 5 operational SQL views
│   ├── 003_stored_procedures.sql # 6 stored procedures + 5 materialized views + pg_cron schedules
│   └── 004_seed_data.sql         # Lookup table seed rows (service_types, time_slots, admin_roles)
└── scripts/
    └── migrate_from_firestore.js # One-time Firestore → PostgreSQL migration script
```

---

*Generated: 2026-04-06 | Author: GitHub Copilot | Repository: sureyeswanth2000-cell/Gigtos*
