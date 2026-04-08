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
  ('Home Repair',           'Plumbing, electrical, carpentry, painting',                      '🔧', 1),
  ('Transport',             'Driver services — with or without own vehicle',                  '🚗', 2),
  ('Household Help',        'Cooking, cleaning, laundry, daily household tasks',              '🏠', 3),
  ('Appliance & AC',        'AC servicing, appliance repair, installation',                   '❄️', 4),
  ('Cleaning',              'Deep cleaning, pest control, sanitization',                      '🧹', 5),
  ('Security',              'Security guards, event security, night patrol',                  '🛡️', 6),
  ('Construction',          'Masonry, steel work, surveying, quality testing',                '🏗️', 7),
  ('Automotive',            'Vehicle mechanics, servicing, denting, and repairs',             '🔧', 8),
  ('Hotel & Hospitality',   'Cooks, waiters, cleaners, and front-desk staff for hotels',     '🏨', 9),
  ('Industrial',            'Elevators, escalators, welding, electric equipment repair',      '⚙️', 10),
  ('Event & Warehouse',     'Event helpers, warehouse labour, farm workers',                  '📦', 11),
  ('Education',             'Driving instructors and skill-based teaching',                   '📚', 12),
  ('Outdoor & Garden',      'Gardening, landscaping, roof coating',                           '🌿', 13)
ON CONFLICT (name) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SECTION 3 — Map existing services to categories
-- ────────────────────────────────────────────────────────────

-- Home Repair
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '🧰', sort_order = 1 WHERE name = 'Plumber';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '⚡', sort_order = 2 WHERE name = 'Electrician';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '🪛', sort_order = 3 WHERE name = 'Carpenter';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Home Repair'),     icon = '🎨', sort_order = 4 WHERE name = 'Painter';

-- Transport
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🚗', sort_order = 1, requires_asset = TRUE  WHERE name = 'Driver with Vehicle';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🧑‍✈️', sort_order = 2                       WHERE name = 'Driver without Vehicle';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🚛', sort_order = 3                       WHERE name = 'Heavy Vehicle Driver';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🏍️', sort_order = 4, requires_asset = TRUE  WHERE name = 'Two Wheeler Driver';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Transport'),       icon = '🎩', sort_order = 5                       WHERE name = 'Executive Driver';

-- Construction
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '🧱', sort_order = 1 WHERE name = 'Mason';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '👷', sort_order = 2 WHERE name = 'Construction Helper';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '🔩', sort_order = 3 WHERE name = 'Steel Worker';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '📐', sort_order = 4 WHERE name = 'Land Surveyor';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '🔬', sort_order = 5 WHERE name = 'Construction Quality Tester';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '🏠', sort_order = 6 WHERE name = 'Roof Coating Specialist';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Construction'),    icon = '🔥', sort_order = 7 WHERE name = 'Welding';

-- Household Help
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Household Help'),  icon = '🏠', sort_order = 1 WHERE name = 'Home Helper';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Household Help'),  icon = '🧹', sort_order = 2 WHERE name = 'Maid';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Outdoor & Garden'), icon = '🌿', sort_order = 1 WHERE name = 'Gardener';

-- Cleaning
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Cleaning'),        icon = '🧹', sort_order = 1 WHERE name = 'Deep Cleaning';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Cleaning'),        icon = '🐛', sort_order = 2 WHERE name = 'Pest Control';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Cleaning'),        icon = '🧴', sort_order = 3 WHERE name = 'Sanitizer';

-- Appliance & AC
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '❄️', sort_order = 1 WHERE name = 'AC Technician';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '🔌', sort_order = 2 WHERE name = 'Appliance Repair';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '🌀', sort_order = 3 WHERE name = 'AC & Washing Machine Service';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '🔧', sort_order = 4 WHERE name = 'Electric Equipment Repair';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Appliance & AC'),  icon = '💧', sort_order = 5 WHERE name = 'Water Purifier Service';

-- Security
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Security'),        icon = '🛡️', sort_order = 1 WHERE name = 'Security Guard';

-- Automotive
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Automotive'),      icon = '🔧', sort_order = 1 WHERE name = 'Mechanic';

-- Industrial
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Industrial'),      icon = '🛗', sort_order = 1 WHERE name = 'Elevator Installer';

-- Hotel & Hospitality
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Hotel & Hospitality'), icon = '👨‍🍳', sort_order = 1 WHERE name = 'Hotel Cook';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Hotel & Hospitality'), icon = '🍽️', sort_order = 2 WHERE name = 'Food Service Staff';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Hotel & Hospitality'), icon = '🧹', sort_order = 3 WHERE name = 'Hotel Sanitizer';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Hotel & Hospitality'), icon = '🙏', sort_order = 4 WHERE name = 'Hotel Welcome Staff';

-- Event & Warehouse
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Event & Warehouse'), icon = '🎪', sort_order = 1 WHERE name = 'Event Helper';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Event & Warehouse'), icon = '📦', sort_order = 2 WHERE name = 'Warehouse Helper';
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Event & Warehouse'), icon = '🌾', sort_order = 3 WHERE name = 'Farm Helper';

-- Education
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Education'),       icon = '📚', sort_order = 1 WHERE name = 'Driving Instructor';

-- Outdoor & Garden
UPDATE service_types SET category_id = (SELECT id FROM service_categories WHERE name = 'Outdoor & Garden'), icon = '☀️', sort_order = 2 WHERE name = 'Roof Sun Protection Painter';

-- ────────────────────────────────────────────────────────────
-- SECTION 4 — Indexes
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_service_types_category ON service_types (category_id);
CREATE INDEX IF NOT EXISTS idx_service_types_active   ON service_types (is_active) WHERE is_active = TRUE;
