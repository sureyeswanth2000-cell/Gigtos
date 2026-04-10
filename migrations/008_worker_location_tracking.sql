-- ============================================================
-- Migration 008 — Worker Location Tracking
-- Gigtos — Firebase Data Connect (PostgreSQL)
--
-- Tracks worker location sessions while they are active/working.
-- Records reach time, left time, duration at work location,
-- and handles "Location closed" when worker stops sharing.
-- ============================================================

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- Worker Location Sessions
-- One row per tracking session (worker goes Active → Offline).
-- ────────────────────────────────────────────────────────────

CREATE TABLE worker_location_sessions (
  session_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id        UUID          NOT NULL,
  booking_id       UUID,                           -- optional reference to a specific booking
  work_location_lat NUMERIC(10,7),                 -- expected work site latitude
  work_location_lng NUMERIC(10,7),                 -- expected work site longitude
  last_lat          NUMERIC(10,7),                 -- last known worker latitude
  last_lng          NUMERIC(10,7),                 -- last known worker longitude
  reach_time        TIMESTAMPTZ,                   -- when worker arrived at work location
  left_time         TIMESTAMPTZ,                   -- when worker left work location
  duration_minutes  INTEGER,                       -- total minutes at work location
  location_status   VARCHAR(30) NOT NULL DEFAULT 'tracking'
                      CHECK (location_status IN (
                        'tracking',        -- actively tracking, not yet at location
                        'at_location',     -- worker is within proximity radius
                        'left_location',   -- worker left the work location
                        'closed',          -- worker stopped sharing location
                        'stopped'          -- worker went offline normally
                      )),
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up sessions by worker
CREATE INDEX idx_wls_worker_id ON worker_location_sessions (worker_id);

-- Index for active sessions (non-terminal statuses)
CREATE INDEX idx_wls_active ON worker_location_sessions (location_status)
  WHERE location_status IN ('tracking', 'at_location');

-- Index for sessions linked to a booking
CREATE INDEX idx_wls_booking_id ON worker_location_sessions (booking_id)
  WHERE booking_id IS NOT NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE ON worker_location_sessions TO gigtos_app_user;
