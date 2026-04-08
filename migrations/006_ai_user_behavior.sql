-- ============================================================
-- Migration 006 — AI User Behavior Tracking
-- Gigtos — Stores user interaction data for AI-powered
-- recommendations, personalized search, and smarter assistant
-- Run after: 005_future_service_categories.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- TABLE 1: user_search_history
-- Tracks what users search for in the app.
-- Used by AI to suggest services, auto-fill, and rank results.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_search_history (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  query_text      TEXT         NOT NULL,               -- raw search string
  matched_service_type_id INTEGER REFERENCES service_types(id),  -- NULL if no match
  result_count    SMALLINT     DEFAULT 0,              -- how many results shown
  clicked         BOOLEAN      NOT NULL DEFAULT FALSE, -- did user click a result?
  source          VARCHAR(30)  NOT NULL DEFAULT 'search_bar',  -- 'search_bar', 'ai_chat', 'home_page', 'voice'
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_user     ON user_search_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_service  ON user_search_history (matched_service_type_id) WHERE matched_service_type_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- TABLE 2: user_behavior_events
-- Generic event tracking table for AI training data.
-- Captures page views, clicks, time-on-page, etc.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_behavior_events (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_type      VARCHAR(50)  NOT NULL,    -- 'page_view', 'service_click', 'booking_started',
                                            -- 'booking_abandoned', 'quote_viewed', 'chat_opened',
                                            -- 'worker_profile_viewed', 'rating_submitted',
                                            -- 'cashback_redeemed', 'app_open', 'app_background'
  event_data      JSONB,                    -- flexible payload per event type
  service_type_id INTEGER      REFERENCES service_types(id),  -- context: which service, if any
  booking_id      UUID         REFERENCES bookings(booking_id),  -- context: which booking, if any
  session_id      VARCHAR(64),              -- client-generated session ID for grouping
  device_type     VARCHAR(20),              -- 'android', 'ios', 'web'
  app_version     VARCHAR(20),              -- e.g. '1.2.3'
  screen_name     VARCHAR(60),              -- e.g. 'home', 'service_detail', 'my_bookings'
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behavior_user       ON user_behavior_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_event_type ON user_behavior_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_session    ON user_behavior_events (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_behavior_service    ON user_behavior_events (service_type_id) WHERE service_type_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- TABLE 3: ai_recommendations_log
-- Logs every AI recommendation made to a user.
-- Tracks whether the user acted on it (accepted/ignored/dismissed).
-- Enables feedback loop for model improvement.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_recommendations_log (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recommendation_type VARCHAR(40)  NOT NULL,  -- 'service_suggestion', 'worker_recommendation',
                                              -- 'time_slot_suggestion', 'price_insight',
                                              -- 'reorder_prompt', 'upsell', 'cross_sell'
  recommended_items   JSONB        NOT NULL,  -- array of items recommended (service IDs, worker IDs, etc.)
  context             JSONB,                  -- input context used to generate recommendation
  model_version       VARCHAR(30),            -- AI model/version that produced this
  score               FLOAT,                  -- confidence score 0.0–1.0
  user_action         VARCHAR(20)  DEFAULT 'pending',  -- 'accepted', 'ignored', 'dismissed', 'pending'
  acted_at            TIMESTAMPTZ,            -- when user took action
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_rec_user     ON ai_recommendations_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rec_type     ON ai_recommendations_log (recommendation_type);
CREATE INDEX IF NOT EXISTS idx_ai_rec_action   ON ai_recommendations_log (user_action) WHERE user_action <> 'pending';

-- ────────────────────────────────────────────────────────────
-- TABLE 4: user_preferences
-- Stores user's learned/explicit preferences for AI.
-- Updated by AI pipeline based on behavior patterns.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_preferences (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE UNIQUE,
  preferred_services  JSONB        DEFAULT '[]'::jsonb,  -- array of service_type_ids ranked by frequency
  preferred_time_slots JSONB       DEFAULT '[]'::jsonb,  -- array of time_slot_ids ranked by frequency
  preferred_areas     JSONB        DEFAULT '[]'::jsonb,  -- areas the user often books in
  price_sensitivity   VARCHAR(20)  DEFAULT 'medium',     -- 'low', 'medium', 'high'
  avg_booking_frequency_days INT,                        -- average gap between bookings
  last_active_at      TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_pref_user ON user_preferences (user_id);
