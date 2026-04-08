-- ============================================================
-- Migration 005 — Service Categories & Extended Service Metadata
-- Gigtos — Future-ready expansion for new job types
-- Groups services into categories for UI navigation and search
-- Run after: 004_seed_data.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- ────────────────────────────────────────────────────────────
-- SECTION 1 — Service Categories
-- Groups service types into browsable categories
-- e.g. "Home Repair" → Plumber, Electrician, Carpenter, Painter
--      "Transport"   → Driver with Vehicle, Driver without Vehicle
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS service_categories (
  id          SERIAL       PRIMARY KEY,
  name        VARCHAR(60)  NOT NULL UNIQUE,
  description TEXT,
  icon        VARCHAR(10),                          -- emoji icon for UI
  sort_order  SMALLINT     NOT NULL DEFAULT 0,      -- display order in app
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,   -- soft toggle for unreleased categories
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add category_id FK to existing service_types table
ALTER TABLE service_types
  ADD COLUMN IF NOT EXISTS category_id     INTEGER REFERENCES service_categories(id),
  ADD COLUMN IF NOT EXISTS icon            VARCHAR(10),
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS requires_asset  BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for driver-with-vehicle etc.
  ADD COLUMN IF NOT EXISTS sort_order      SMALLINT NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- SECTION 2 — Seed Categories
-- ────────────────────────────────────────────────────────────

INSERT INTO service_categories (name, description, icon, sort_order) VALUES
  ('Home Repair',     'Plumbing, electrical, carpentry, painting',                      '🔧', 1),
  ('Transport',       'Driver services — with or without own vehicle',                  '🚗', 2),
  ('Household Help',  'Cooking, cleaning, laundry, daily household tasks',              '🏠', 3),
  ('Appliance & AC',  'AC servicing, appliance repair, installation',                   '❄️', 4),
  ('Cleaning',        'Deep cleaning, pest control, sanitization',                      '🧹', 5),
  ('Security',        'Security guards, event security, night patrol',                  '🛡️', 6)
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — Map existing services to categories
-- ────────────────────────────────────────────────────────────

UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '🧰', sort_order = 1 WHERE name = 'Plumber';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '⚡', sort_order = 2 WHERE name = 'Electrician';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '🪛', sort_order = 3 WHERE name = 'Carpenter';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '🎨', sort_order = 4 WHERE name = 'Painter';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🚗', sort_order = 1, requires_asset = TRUE  WHERE name = 'Driver with Vehicle';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🧑‍✈️', sort_order = 2, requires_asset = FALSE WHERE name = 'Driver without Vehicle';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Household Help'),  icon = '🏠', sort_order = 1 WHERE name = 'Home Helper';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '❄️', sort_order = 1 WHERE name = 'AC Technician';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Cleaning'),        icon = '🐛', sort_order = 1 WHERE name = 'Pest Control';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '🔌', sort_order = 2 WHERE name = 'Appliance Repair';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Cleaning'),        icon = '🧹', sort_order = 2 WHERE name = 'Deep Cleaning';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Security'),        icon = '🛡️', sort_order = 1 WHERE name = 'Security Guard';

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — Indexes
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_service_types_category ON service_types (category_id);
CREATE INDEX IF NOT EXISTS idx_service_types_active   ON service_types (is_active) WHERE is_active = TRUE;
