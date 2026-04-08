-- ============================================================
-- Migration 007 — Worker Assets
-- Gigtos — Tracks worker-owned assets (vehicles, tools, equipment)
-- Required for new job types like "Driver with Vehicle"
-- Run after: 006_ai_user_behavior.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- TABLE 1: worker_assets
-- Tracks physical assets that workers bring to jobs.
-- Examples: car, bike, cleaning machine, tool kit
-- Required for "Driver with Vehicle" to verify vehicle ownership.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS worker_assets (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id         UUID         NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  asset_type        VARCHAR(40)  NOT NULL,    -- 'car', 'bike', 'auto_rickshaw', 'van',
                                              -- 'cleaning_machine', 'tool_kit', 'spray_equipment'
  asset_name        VARCHAR(100),             -- e.g. 'Maruti Swift Dzire', 'Hero Splendor'
  registration_no   VARCHAR(30),              -- vehicle registration number (for vehicles)
  is_verified       BOOLEAN      NOT NULL DEFAULT FALSE,   -- admin has verified document proof
  verified_by       UUID         REFERENCES admins(admin_id),
  verified_at       TIMESTAMPTZ,
  document_url      TEXT,                     -- photo/scan of RC, insurance, etc.
  expiry_date       DATE,                     -- insurance/permit expiry
  status            VARCHAR(20)  NOT NULL DEFAULT 'active',  -- 'active', 'expired', 'removed'
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_assets_worker ON worker_assets (worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_assets_type   ON worker_assets (asset_type);
CREATE INDEX IF NOT EXISTS idx_worker_assets_active ON worker_assets (worker_id, status) WHERE status = 'active';

-- ────────────────────────────────────────────────────────────
-- TABLE 2: worker_service_areas
-- Future: workers can serve multiple areas and multiple service types.
-- Currently workers have a single area + service_type_id.
-- This table enables multi-area, multi-service workers.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS worker_service_areas (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID         NOT NULL REFERENCES workers(worker_id) ON DELETE CASCADE,
  service_type_id INTEGER      NOT NULL REFERENCES service_types(id),
  area            VARCHAR(100) NOT NULL,
  is_primary      BOOLEAN      NOT NULL DEFAULT FALSE,   -- primary area shown first
  status          VARCHAR(20)  NOT NULL DEFAULT 'active', -- 'active', 'paused'
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (worker_id, service_type_id, area)              -- prevent duplicates
);

CREATE INDEX IF NOT EXISTS idx_wsa_worker  ON worker_service_areas (worker_id);
CREATE INDEX IF NOT EXISTS idx_wsa_area    ON worker_service_areas (area, service_type_id) WHERE status = 'active';
