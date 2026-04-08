-- ============================================================
-- Migration 004 — Seed Data
-- Gigtos @ 1 Lakh Users — Firebase Data Connect (PostgreSQL)
-- Inserts all required lookup / dimension table rows
-- Run after: 003_stored_procedures.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- Service Types (existing + future)
INSERT INTO service_types (name, description) VALUES
  ('Plumber',              'Plumbing repairs, pipe fitting, and installation'),
  ('Electrician',          'Electrical repairs, wiring, and fixture installation'),
  ('Carpenter',            'Carpentry, woodwork, furniture repair and assembly'),
  ('Painter',              'Interior and exterior painting services'),
  ('Driver with Vehicle',  'Driver who brings their own car/bike for transport, delivery, or ride services'),
  ('Driver without Vehicle','Driver available for hire to drive the customer''s vehicle'),
  ('Home Helper',          'General household assistance — cleaning, cooking, laundry, errands'),
  ('AC Technician',        'Air conditioning installation, servicing, gas refill, and repair'),
  ('Pest Control',         'Termite, cockroach, mosquito, and rodent treatment'),
  ('Appliance Repair',     'Washing machine, refrigerator, microwave, geyser repair and servicing'),
  ('Deep Cleaning',        'Full-house or office deep cleaning, sofa/carpet/kitchen cleaning'),
  ('Security Guard',       'Trained security personnel for events, homes, or offices')
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
