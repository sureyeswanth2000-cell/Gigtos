-- ============================================================
-- Migration 004 — Seed Data
-- Gigtos @ 1 Lakh Users — Firebase Data Connect (PostgreSQL)
-- Inserts all required lookup / dimension table rows
-- Run after: 003_stored_procedures.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- Service Types
INSERT INTO service_types (name, description) VALUES
  ('Plumber',      'Plumbing repairs, pipe fitting, and installation'),
  ('Electrician',  'Electrical repairs, wiring, and fixture installation'),
  ('Carpenter',    'Carpentry, woodwork, furniture repair and assembly'),
  ('Painter',      'Interior and exterior painting services')
ON CONFLICT (name) DO NOTHING;

-- Time Slots
INSERT INTO time_slots (label, start_hour, end_hour) VALUES
  ('9 AM - 12 PM',  9,  12),
  ('12 PM - 3 PM', 12,  15),
  ('3 PM - 6 PM',  15,  18),
  ('6 PM - 9 PM',  18,  21)
ON CONFLICT (label) DO NOTHING;

-- Admin Roles
INSERT INTO admin_roles (role_name) VALUES
  ('superadmin'),
  ('regionLead'),
  ('mason'),
  ('admin')
ON CONFLICT (role_name) DO NOTHING;
