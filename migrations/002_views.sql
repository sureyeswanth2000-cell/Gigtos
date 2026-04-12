-- ============================================================
-- Migration 002 — Views
-- Gigtos @ 1 Lakh Users — Firebase Data Connect (PostgreSQL)
-- 5 operational SQL views over gigtos_oltp tables
-- Run after: 001_initial_schema.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- View 1: v_active_bookings
-- Replaces the most common admin dashboard query.
-- Only scans bookings_active (~5% of total rows).
-- ────────────────────────────────────────────────────────────

CREATE VIEW v_active_bookings AS
SELECT
  b.booking_id,
  b.status,
  b.created_at,
  b.scheduled_date,
  b.escrow_status,
  b.is_multi_day,
  b.estimated_days,
  b.completed_work_days,
  u.name           AS customer_name,
  u.phone          AS customer_phone,
  st.name          AS service_type,
  w.name           AS worker_name,
  w.phone          AS worker_phone,
  a.admin_id,
  a.name           AS admin_name,
  a.area_name
FROM bookings b
JOIN users         u  ON u.user_id         = b.user_id
JOIN service_types st ON st.id             = b.service_type_id
LEFT JOIN workers  w  ON w.worker_id       = b.assigned_worker_id
LEFT JOIN admins   a  ON a.admin_id        = b.admin_id
WHERE b.status IN ('pending','scheduled','quoted','accepted',
                   'assigned','in_progress','awaiting_confirmation');

-- ────────────────────────────────────────────────────────────
-- View 2: v_worker_availability
-- Used in sp_accept_quote for auto-assignment of best worker.
-- Only shows approved, active, available, non-fraud workers.
-- Backed by the partial covering index idx_workers_assign_cover.
-- ────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────
-- View 3: v_admin_dashboard
-- Per-admin stats used on admin and mason home pages.
-- Live counts — used for notification badges.
-- For historical aggregations use mv_admin_stats (materialized).
-- ────────────────────────────────────────────────────────────

CREATE VIEW v_admin_dashboard AS
SELECT
  a.admin_id,
  a.name,
  a.area_name,
  a.region_score,
  a.probation_status,
  COUNT(DISTINCT b.booking_id)
    FILTER (WHERE b.status IN ('pending','quoted','assigned','in_progress')) AS open_bookings,
  COUNT(DISTINCT d.dispute_id)
    FILTER (WHERE d.status = 'open')                                         AS open_disputes,
  COUNT(DISTINCT al.alert_id)
    FILTER (WHERE al.status = 'open')                                        AS unread_alerts
FROM admins a
LEFT JOIN bookings     b  ON b.admin_id   = a.admin_id
LEFT JOIN disputes     d  ON d.booking_id = b.booking_id
LEFT JOIN admin_alerts al ON al.admin_id  = a.admin_id
GROUP BY a.admin_id, a.name, a.area_name, a.region_score, a.probation_status;

-- ────────────────────────────────────────────────────────────
-- View 4: v_region_dispute_rate
-- Last-30-day dispute rate per region lead.
-- Drives probation logic; backed by mv_region_dispute_rate (MV).
-- ────────────────────────────────────────────────────────────

CREATE VIEW v_region_dispute_rate AS
SELECT
  a.admin_id,
  a.name,
  a.area_name,
  COUNT(b.booking_id)                                                AS total_bookings_30d,
  COUNT(d.dispute_id)                                                AS total_disputes_30d,
  ROUND(
    COUNT(d.dispute_id)::NUMERIC / NULLIF(COUNT(b.booking_id), 0) * 100, 2
  )                                                                  AS dispute_rate_pct
FROM admins a
LEFT JOIN bookings b ON b.admin_id = a.admin_id
                     AND b.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN disputes d ON d.booking_id = b.booking_id
WHERE a.role_id IN (
  SELECT id FROM admin_roles WHERE role_name IN ('regionLead','mason')
)
GROUP BY a.admin_id, a.name, a.area_name;

-- ────────────────────────────────────────────────────────────
-- View 5: v_booking_full
-- Full denormalized booking view.
-- Replaces complex multi-collection Firestore fetches in
-- the booking detail screen.
-- ────────────────────────────────────────────────────────────

CREATE VIEW v_booking_full AS
SELECT
  b.booking_id,
  b.status,
  b.issue_title,
  b.job_details,
  b.scheduled_date,
  b.estimated_days,
  b.completed_work_days,
  b.is_multi_day,
  b.started_at,
  b.finished_at,
  b.escrow_status,
  b.is_commission_processed,
  b.rating,
  b.created_at,
  b.updated_at,
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
JOIN users          u   ON u.user_id         = b.user_id
JOIN service_types  st  ON st.id             = b.service_type_id
LEFT JOIN workers   w   ON w.worker_id       = b.assigned_worker_id
LEFT JOIN admins    a   ON a.admin_id        = b.admin_id
LEFT JOIN disputes  d   ON d.booking_id      = b.booking_id
LEFT JOIN booking_sla s ON s.booking_id      = b.booking_id
LEFT JOIN time_slots ts ON ts.id             = b.time_slot_id;
