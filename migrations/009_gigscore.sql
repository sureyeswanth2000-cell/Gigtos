-- ============================================================
-- Migration 009 - GigScore Reputation Ledger
-- Adds durable score fields and append-only GigScore events.
-- ============================================================

SET search_path = gigtos_oltp, public;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS gig_score INTEGER NOT NULL DEFAULT 0 CHECK (gig_score BETWEEN 0 AND 1000),
  ADD COLUMN IF NOT EXISTS gig_score_tier VARCHAR(20) NOT NULL DEFAULT 'Copper',
  ADD COLUMN IF NOT EXISTS gig_score_status VARCHAR(30) NOT NULL DEFAULT 'active';

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS gig_score INTEGER NOT NULL DEFAULT 450 CHECK (gig_score BETWEEN 0 AND 1000),
  ADD COLUMN IF NOT EXISTS gig_score_tier VARCHAR(20) NOT NULL DEFAULT 'Bronze',
  ADD COLUMN IF NOT EXISTS gig_score_status VARCHAR(30) NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS gigscore_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id VARCHAR(128) NOT NULL,
  actor_role VARCHAR(20) NOT NULL CHECK (actor_role IN ('consumer','worker','guild','system')),
  booking_id VARCHAR(128) NOT NULL,
  guild_id VARCHAR(128),
  pair_key VARCHAR(260),
  reason_code VARCHAR(80) NOT NULL,
  reason_text TEXT NOT NULL,
  improvement_advice TEXT,
  old_score INTEGER NOT NULL CHECK (old_score BETWEEN 0 AND 1000),
  delta INTEGER NOT NULL,
  new_score INTEGER NOT NULL CHECK (new_score BETWEEN 0 AND 1000),
  old_tier VARCHAR(20) NOT NULL,
  new_tier VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','finalized','reversed')),
  fraud_review_state VARCHAR(30) NOT NULL DEFAULT 'not_required',
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gigscore_events_actor_created
  ON gigscore_events(actor_role, actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gigscore_events_booking
  ON gigscore_events(booking_id);

CREATE INDEX IF NOT EXISTS idx_gigscore_events_pair_created
  ON gigscore_events(pair_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gigscore_events_status_review
  ON gigscore_events(status, fraud_review_state, created_at DESC);
