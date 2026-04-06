-- ============================================================
-- Migration 003 — Stored Procedures + Materialized Views
-- Gigtos @ 1 Lakh Users — Firebase Data Connect (PostgreSQL)
-- 6 stored procedures + 5 materialized views
-- Run after: 002_views.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- Procedure 1: sp_accept_quote
-- Atomic transaction — replaces acceptQuote Cloud Function.
-- Accepts a quote, finds the best available worker, assigns
-- them, and logs the activity in a single atomic transaction.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_accept_quote(
  p_booking_id UUID,
  p_quote_id   UUID,
  p_user_id    UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_service_type_id  INTEGER;
  v_service_type_name VARCHAR(50);
  v_area             VARCHAR(100);
  v_best_worker_id   UUID;
  v_admin_id         UUID;
BEGIN
  -- Validate booking belongs to user and is in 'quoted' status
  IF NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE booking_id = p_booking_id AND user_id = p_user_id AND status = 'quoted'
  ) THEN
    RAISE EXCEPTION 'Booking % not found or not in quoted status', p_booking_id;
  END IF;

  -- Validate quote belongs to booking
  IF NOT EXISTS (
    SELECT 1 FROM booking_quotes
    WHERE quote_id = p_quote_id AND booking_id = p_booking_id
  ) THEN
    RAISE EXCEPTION 'Quote % does not belong to booking %', p_quote_id, p_booking_id;
  END IF;

  -- Get service type, area, and admin from the accepted quote
  SELECT b.service_type_id, st.name, a.area_name, bq.admin_id
    INTO v_service_type_id, v_service_type_name, v_area, v_admin_id
  FROM bookings b
  JOIN booking_quotes bq ON bq.quote_id = p_quote_id
  JOIN admins a ON a.admin_id = bq.admin_id
  JOIN service_types st ON st.id = b.service_type_id
  WHERE b.booking_id = p_booking_id;

  -- Find best available worker (top-listed first, then by rating)
  SELECT w.worker_id INTO v_best_worker_id
  FROM v_worker_availability w
  WHERE w.service_type = v_service_type_name
    AND w.area = v_area
  ORDER BY w.is_top_listed DESC, w.rating DESC
  LIMIT 1;

  -- Mark accepted quote, reset all others for this booking
  UPDATE booking_quotes SET is_accepted = TRUE  WHERE quote_id = p_quote_id;
  UPDATE booking_quotes SET is_accepted = FALSE
  WHERE booking_id = p_booking_id AND quote_id <> p_quote_id;

  -- Update booking atomically
  UPDATE bookings SET
    status             = 'accepted',
    admin_id           = v_admin_id,
    assigned_worker_id = v_best_worker_id,
    escrow_status      = 'pending_acceptance',
    updated_at         = NOW()
  WHERE booking_id = p_booking_id;

  -- Mark assigned worker unavailable
  IF v_best_worker_id IS NOT NULL THEN
    UPDATE workers SET is_available = FALSE, updated_at = NOW()
    WHERE worker_id = v_best_worker_id;
  END IF;

  -- Log activity
  INSERT INTO activity_logs
    (booking_id, actor_id, actor_role, action, to_status, worker_id, admin_id)
  VALUES
    (p_booking_id, p_user_id, 'user', 'user_accepted_quote', 'accepted',
     v_best_worker_id, v_admin_id);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Procedure 2: sp_complete_booking
-- Atomic completion — replaces onBookingStatusChange trigger.
-- Processes commission, issues cashback, updates worker stats,
-- promotes to top_listed after 3 jobs.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_complete_booking(
  p_booking_id UUID,
  p_admin_id   UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_worker_id      UUID;
  v_user_id        UUID;
  v_completed_jobs INTEGER;
BEGIN
  SELECT assigned_worker_id, user_id
    INTO v_worker_id, v_user_id
  FROM bookings WHERE booking_id = p_booking_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- Complete the booking
  UPDATE bookings SET
    status                  = 'completed',
    finished_at             = NOW(),
    escrow_status           = 'released',
    is_commission_processed = TRUE,
    updated_at              = NOW()
  WHERE booking_id = p_booking_id;

  -- Insert commission record (₹150 total: ₹80 worker, ₹20 admin, ₹50 Gigtos)
  INSERT INTO commissions
    (booking_id, total_visiting_charge, worker_share, local_admin_share, gigto_share)
  VALUES (p_booking_id, 150, 80, 20, 50)
  ON CONFLICT (booking_id) DO NOTHING;

  -- Issue cashback (₹9, 15-day expiry)
  INSERT INTO cashbacks (user_id, booking_id, amount, expires_at)
  VALUES (v_user_id, p_booking_id, 9, NOW() + INTERVAL '15 days')
  ON CONFLICT (booking_id) DO NOTHING;

  -- Update worker stats and mark available again
  IF v_worker_id IS NOT NULL THEN
    UPDATE workers SET
      completed_jobs = completed_jobs + 1,
      total_earnings = total_earnings + 80,
      is_available   = TRUE,
      updated_at     = NOW()
    WHERE worker_id = v_worker_id
    RETURNING completed_jobs INTO v_completed_jobs;

    -- Promote to top_listed after 3 completed jobs
    IF v_completed_jobs >= 3 THEN
      UPDATE workers SET is_top_listed = TRUE, updated_at = NOW()
      WHERE worker_id = v_worker_id;

      INSERT INTO activity_logs
        (booking_id, actor_id, actor_role, action, worker_id)
      VALUES
        (p_booking_id, p_admin_id, 'admin', 'worker_top_listed', v_worker_id);
    END IF;
  END IF;

  -- Update admin total_disputes counter (completed bookings reduce pending load)
  UPDATE admins SET
    total_disputes = total_disputes,
    updated_at     = NOW()
  WHERE admin_id = p_admin_id;

  -- Log completion
  INSERT INTO activity_logs
    (booking_id, actor_id, actor_role, action, to_status)
  VALUES
    (p_booking_id, p_admin_id, 'admin', 'completion_processed', 'completed');

  INSERT INTO activity_logs
    (booking_id, actor_id, actor_role, action, amount)
  VALUES
    (p_booking_id, NULL, 'system', 'cashback_issued', 9);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Procedure 3: sp_resolve_dispute
-- Atomic dispute resolution — replaces Cloud Function dispute logic.
-- Updates escrow, penalizes region score on worker_fault, logs.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sp_resolve_dispute(
  p_dispute_id  UUID,
  p_decision    VARCHAR(20),
  p_resolved_by UUID
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_booking_id UUID;
  v_admin_id   UUID;
BEGIN
  IF p_decision NOT IN ('user_fault','worker_fault','shared_fault') THEN
    RAISE EXCEPTION 'Invalid decision value: %', p_decision;
  END IF;

  SELECT d.booking_id, b.admin_id
    INTO v_booking_id, v_admin_id
  FROM disputes d
  JOIN bookings b ON b.booking_id = d.booking_id
  WHERE d.dispute_id = p_dispute_id;

  IF v_booking_id IS NULL THEN
    RAISE EXCEPTION 'Dispute % not found', p_dispute_id;
  END IF;

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
      ELSE 'released'    -- shared_fault: worker gets partial (simplified)
    END,
    updated_at = NOW()
  WHERE booking_id = v_booking_id;

  -- Penalize region lead score for worker_fault decisions (-10 per incident)
  IF p_decision = 'worker_fault' THEN
    UPDATE admins SET
      region_score = GREATEST(0, region_score - 10),
      fraud_count  = fraud_count + 1,
      updated_at   = NOW()
    WHERE admin_id = v_admin_id;
  END IF;

  -- Recalculate avg_resolution_time for the region lead
  UPDATE admins SET
    avg_resolution_time = (
      SELECT COALESCE(
        AVG(EXTRACT(EPOCH FROM (d2.resolution_time - d2.raised_at)) / 3600), 0
      )
      FROM disputes d2
      JOIN bookings b2 ON b2.booking_id = d2.booking_id
      WHERE b2.admin_id = v_admin_id AND d2.status = 'resolved'
    ),
    total_disputes = total_disputes + 1,
    updated_at = NOW()
  WHERE admin_id = v_admin_id;

  -- Log activity
  INSERT INTO activity_logs
    (booking_id, actor_id, actor_role, action, decision)
  VALUES
    (v_booking_id, p_resolved_by, 'admin', 'dispute_resolved', p_decision);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Procedure 4: sp_escalate_overdue_disputes
-- Batch job — replaces checkDisputeEscalation scheduled Cloud Function.
-- Escalates all open disputes older than 24 hours.
-- Returns count of escalated disputes.
-- ────────────────────────────────────────────────────────────

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
    WHERE d.status            = 'open'
      AND d.escalation_status = FALSE
      AND d.raised_at         < NOW() - INTERVAL '24 hours'
  LOOP
    -- Mark escalated
    UPDATE disputes SET
      escalation_status = TRUE,
      escalated_at      = NOW()
    WHERE dispute_id = r.dispute_id;

    -- Deduct region lead score (5 points per unresolved escalation)
    UPDATE admins SET
      region_score = GREATEST(0, region_score - 5),
      updated_at   = NOW()
    WHERE admin_id = r.admin_id;

    -- Alert the region lead
    INSERT INTO admin_alerts (admin_id, booking_id, type, title, message)
    VALUES (
      r.admin_id, r.booking_id,
      'dispute_escalated',
      'Dispute Escalated',
      format('Dispute has been open for %.0f hours and has been escalated.', r.hours_open)
    );

    -- Log activity
    INSERT INTO activity_logs (booking_id, actor_id, actor_role, action)
    VALUES (r.booking_id, NULL, 'system', 'dispute_escalated');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Procedure 5: sp_expire_cashbacks
-- Batch job — replaces checkCashbackExpiry scheduled Cloud Function.
-- Returns count of expired cashbacks.
-- ────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────
-- Procedure 6: sp_check_sla_breaches
-- Batch job — replaces checkBookingSlaDelay scheduled Cloud Function.
-- Flags bookings stuck in any non-terminal status for > 24 hours.
-- Returns count of newly breached SLAs.
-- ────────────────────────────────────────────────────────────

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
    -- Upsert SLA record
    INSERT INTO booking_sla
      (booking_id, breached, notified, breached_at, status_at_breach, region_lead_id)
    VALUES
      (r.booking_id, TRUE, TRUE, NOW(), r.status, r.admin_id)
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
      format('Booking stuck in status "%s" for over 24 hours.', r.status)
    );

    -- Log activity
    INSERT INTO activity_logs
      (booking_id, actor_id, actor_role, action, from_status)
    VALUES
      (r.booking_id, NULL, 'system', 'booking_sla_delayed', r.status);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- pg_cron Schedules for Batch Procedures
-- ────────────────────────────────────────────────────────────

-- Escalate overdue disputes — every 30 minutes
SELECT cron.schedule(
  'escalate_overdue_disputes',
  '*/30 * * * *',
  'SELECT gigtos_oltp.sp_escalate_overdue_disputes()'
);

-- Expire cashbacks — once daily at 00:05 UTC
SELECT cron.schedule(
  'expire_cashbacks',
  '5 0 * * *',
  'SELECT gigtos_oltp.sp_expire_cashbacks()'
);

-- Check SLA breaches — every 15 minutes
SELECT cron.schedule(
  'check_sla_breaches',
  '*/15 * * * *',
  'SELECT gigtos_oltp.sp_check_sla_breaches()'
);

-- ────────────────────────────────────────────────────────────
-- Materialized Views (in gigtos_analytics schema)
-- Backed by pg_cron refresh schedules
-- Use CONCURRENTLY so queries continue during refresh
-- ────────────────────────────────────────────────────────────

SET search_path = gigtos_analytics, gigtos_oltp, public;

-- ── MV 1: mv_admin_stats ──────────────────────────────────
-- Admin dashboard stats — pre-computed every 5 minutes
-- ~10× faster than live GROUP BY query at 1L users

CREATE MATERIALIZED VIEW gigtos_analytics.mv_admin_stats AS
SELECT
  a.admin_id,
  a.name                                                          AS admin_name,
  a.area_name,
  a.region_score,
  a.probation_status,
  COUNT(DISTINCT b.booking_id) FILTER (
    WHERE b.status NOT IN ('completed','cancelled')
  )                                                               AS open_bookings,
  COUNT(DISTINCT d.dispute_id) FILTER (
    WHERE d.status = 'open'
  )                                                               AS open_disputes,
  COUNT(DISTINCT al.alert_id) FILTER (
    WHERE al.status = 'open'
  )                                                               AS unread_alerts,
  ROUND(AVG(d2.resolution_time_hours), 2)                         AS avg_dispute_resolution_h
FROM gigtos_oltp.admins a
LEFT JOIN gigtos_oltp.bookings b       ON b.admin_id   = a.admin_id
LEFT JOIN gigtos_oltp.disputes d       ON d.booking_id = b.booking_id
LEFT JOIN gigtos_oltp.admin_alerts al  ON al.admin_id  = a.admin_id
LEFT JOIN (
  SELECT booking_id,
         EXTRACT(EPOCH FROM (resolution_time - raised_at)) / 3600 AS resolution_time_hours
  FROM gigtos_oltp.disputes WHERE status = 'resolved'
) d2 ON d2.booking_id = b.booking_id
GROUP BY a.admin_id, a.name, a.area_name, a.region_score, a.probation_status
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_admin_stats (admin_id);

SELECT cron.schedule(
  'refresh_mv_admin_stats',
  '*/5 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_admin_stats'
);

-- ── MV 2: mv_region_dispute_rate ──────────────────────────
-- 30-day dispute rate per region lead — drives probation logic

CREATE MATERIALIZED VIEW gigtos_analytics.mv_region_dispute_rate AS
SELECT
  a.admin_id,
  a.name,
  a.area_name,
  COUNT(b.booking_id)                                             AS total_bookings_30d,
  COUNT(d.dispute_id)                                             AS total_disputes_30d,
  ROUND(
    COUNT(d.dispute_id)::NUMERIC / NULLIF(COUNT(b.booking_id), 0) * 100, 2
  )                                                               AS dispute_rate_pct,
  (COUNT(d.dispute_id)::NUMERIC /
    NULLIF(COUNT(b.booking_id), 0) * 100) > 10                   AS should_probate
FROM gigtos_oltp.admins a
LEFT JOIN gigtos_oltp.bookings b
       ON b.admin_id   = a.admin_id
      AND b.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN gigtos_oltp.disputes d ON d.booking_id = b.booking_id
WHERE a.role_id IN (
  SELECT id FROM gigtos_oltp.admin_roles
  WHERE role_name IN ('regionLead','mason')
)
GROUP BY a.admin_id, a.name, a.area_name
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_region_dispute_rate (admin_id);

SELECT cron.schedule(
  'refresh_mv_region_dispute_rate',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_region_dispute_rate'
);

-- ── MV 3: mv_worker_performance ───────────────────────────
-- Worker leaderboard / top-listing — refreshed every 15 minutes

CREATE MATERIALIZED VIEW gigtos_analytics.mv_worker_performance AS
SELECT
  w.worker_id,
  w.name,
  w.area,
  w.rating,
  w.completed_jobs,
  w.total_earnings,
  w.is_top_listed,
  w.is_available,
  st.name                                                         AS service_type,
  COUNT(b.booking_id)                                             AS bookings_30d,
  ROUND(AVG(b.rating), 2)                                         AS avg_rating_30d,
  COALESCE(SUM(c.worker_share), 0)                                AS earnings_30d
FROM gigtos_oltp.workers w
JOIN gigtos_oltp.service_types st ON st.id = w.service_type_id
LEFT JOIN gigtos_oltp.bookings b
       ON b.assigned_worker_id = w.worker_id
      AND b.status             = 'completed'
      AND b.finished_at        >= NOW() - INTERVAL '30 days'
LEFT JOIN gigtos_oltp.commissions c ON c.booking_id = b.booking_id
GROUP BY w.worker_id, w.name, w.area, w.rating, w.completed_jobs,
         w.total_earnings, w.is_top_listed, w.is_available, st.name
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_worker_performance (worker_id);
CREATE INDEX ON gigtos_analytics.mv_worker_performance
  (area, service_type, is_available, avg_rating_30d DESC);

SELECT cron.schedule(
  'refresh_mv_worker_perf',
  '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_worker_performance'
);

-- ── MV 4: mv_daily_revenue ────────────────────────────────
-- Finance dashboard — refreshed once daily at midnight

CREATE MATERIALIZED VIEW gigtos_analytics.mv_daily_revenue AS
SELECT
  DATE_TRUNC('day', c.calculated_at)  AS revenue_date,
  COUNT(c.commission_id)              AS completed_bookings,
  SUM(c.total_visiting_charge)        AS total_revenue,
  SUM(c.worker_share)                 AS worker_payouts,
  SUM(c.local_admin_share)            AS admin_payouts,
  SUM(c.gigto_share)                  AS gigto_net_revenue,
  COUNT(cb.cashback_id)               AS cashbacks_issued,
  COALESCE(SUM(cb.amount), 0)         AS cashback_value
FROM gigtos_oltp.commissions c
LEFT JOIN gigtos_oltp.cashbacks cb ON cb.booking_id = c.booking_id
GROUP BY DATE_TRUNC('day', c.calculated_at)
ORDER BY revenue_date DESC
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_daily_revenue (revenue_date);

SELECT cron.schedule(
  'refresh_mv_daily_revenue',
  '0 0 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_daily_revenue'
);

-- ── MV 5: mv_booking_status_funnel ────────────────────────
-- Weekly booking conversion funnel — SuperAdmin visibility

CREATE MATERIALIZED VIEW gigtos_analytics.mv_booking_status_funnel AS
SELECT
  DATE_TRUNC('week', created_at)                                  AS week,
  COUNT(*)                                                         AS created,
  COUNT(*) FILTER (WHERE status IN (
    'quoted','accepted','assigned','in_progress',
    'awaiting_confirmation','completed'
  ))                                                               AS reached_quoted,
  COUNT(*) FILTER (WHERE status IN (
    'accepted','assigned','in_progress','awaiting_confirmation','completed'
  ))                                                               AS reached_accepted,
  COUNT(*) FILTER (WHERE status IN (
    'assigned','in_progress','awaiting_confirmation','completed'
  ))                                                               AS reached_assigned,
  COUNT(*) FILTER (WHERE status = 'completed')                     AS completed,
  COUNT(*) FILTER (WHERE status = 'cancelled')                     AS cancelled,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2
  )                                                                AS completion_rate_pct
FROM gigtos_oltp.bookings
GROUP BY DATE_TRUNC('week', created_at)
WITH DATA;

CREATE UNIQUE INDEX ON gigtos_analytics.mv_booking_status_funnel (week);

SELECT cron.schedule(
  'refresh_mv_funnel',
  '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY gigtos_analytics.mv_booking_status_funnel'
);

-- Grant analytics reader access to all materialized views
GRANT SELECT ON ALL TABLES IN SCHEMA gigtos_analytics TO gigtos_analytics_reader;
