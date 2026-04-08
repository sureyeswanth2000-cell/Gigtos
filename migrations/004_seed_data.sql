-- ============================================================
-- Migration 004 — Seed Data
-- Gigtos @ 1 Lakh Users — Firebase Data Connect (PostgreSQL)
-- Inserts all required lookup / dimension table rows
-- Run after: 003_stored_procedures.sql
-- ============================================================

SET search_path = gigtos_oltp, public;

-- Service Types (existing + future)
-- Active services (live now)
INSERT INTO service_types (name, description) VALUES
  ('Plumber',                        'Plumbing repairs, pipe fitting, and installation'),
  ('Electrician',                    'Electrical repairs, wiring, and fixture installation'),
  ('Carpenter',                      'Carpentry, woodwork, furniture repair and assembly'),
  ('Painter',                        'Interior and exterior painting services')
ON CONFLICT (name) DO NOTHING;

-- Upcoming / future services
INSERT INTO service_types (name, description) VALUES
  -- Transport
  ('Driver with Vehicle',            'Driver who brings their own car/bike for transport, delivery, or ride services'),
  ('Driver without Vehicle',         'Driver available for hire to drive the customer''s vehicle'),
  ('Heavy Vehicle Driver',           'Driver with heavy driving licence for trucks, buses, and commercial vehicles'),
  ('Two Wheeler Driver',             'Bike/scooter rider for delivery, errands, or personal transport'),
  ('Executive Driver',               'Professional chauffeur for corporate or VIP transport'),
  -- Construction & Building
  ('Mason',                          'Bricklaying, plastering, concrete work, and general masonry'),
  ('Construction Helper',            'Labour assistance at construction sites — loading, mixing, scaffolding'),
  ('Steel Worker',                   'Steel reinforcement, structural steel fabrication, and rebar tying'),
  ('Land Surveyor',                  'Land or field surveying, boundary marking, and topographical mapping'),
  ('Construction Quality Tester',    'Testing and inspecting construction materials and workmanship'),
  ('Roof Coating Specialist',        'White roof painting / cool-roof coating for sun protection'),
  ('Welding',                        'Metal welding, fabrication, grille work, gate repair'),
  -- Household Help
  ('Home Helper',                    'General household assistance — cleaning, cooking, laundry, errands'),
  ('Maid',                           'Daily/weekly domestic help — sweeping, mopping, utensils, laundry'),
  ('Gardener',                       'Garden maintenance, landscaping, plant care, lawn mowing'),
  -- Cleaning & Sanitation
  ('Deep Cleaning',                  'Full-house or office deep cleaning, sofa/carpet/kitchen cleaning'),
  ('Pest Control',                   'Termite, cockroach, mosquito, and rodent treatment'),
  ('Sanitizer',                      'Professional sanitization and disinfection services'),
  -- Appliance & AC
  ('AC Technician',                  'Air conditioning installation, servicing, gas refill, and repair'),
  ('Appliance Repair',               'Washing machine, refrigerator, microwave, geyser repair and servicing'),
  ('AC & Washing Machine Service',   'Combined AC and washing machine repair, maintenance, and servicing'),
  ('Electric Equipment Repair',      'Repair of electric motors, generators, UPS, inverters, and industrial equipment'),
  ('Water Purifier Service',         'Water purifier installation, repair, filter replacement, and AMC'),
  -- Security
  ('Security Guard',                 'Trained security personnel for events, homes, or offices'),
  -- Automotive
  ('Mechanic',                       'Vehicle mechanic — car, bike, auto servicing, engine repair, denting'),
  -- Industrial & Specialist
  ('Elevator Installer',             'Elevator and escalator installation, repair, and maintenance'),
  -- Hotel & Hospitality
  ('Hotel Cook',                     'Professional cook for hotels, restaurants, events, and catering'),
  ('Food Service Staff',             'Waiters, serving staff for hotels, restaurants, and events'),
  ('Hotel Sanitizer',                'Cleaning and sanitation staff for hotels and hospitality'),
  ('Hotel Welcome Staff',            'Front desk, reception, and guest welcoming for hotels and events'),
  -- Event & Warehouse Helpers
  ('Event Helper',                   'Labour and logistics support for events, exhibitions, and functions'),
  ('Warehouse Helper',               'Loading, unloading, packing, and inventory assistance in warehouses'),
  ('Farm Helper',                    'Farming labour — planting, harvesting, irrigation, and field work'),
  -- Education
  ('Driving Instructor',             'Teach driving — car, bike, or commercial vehicle training'),
  -- Outdoor & Garden
  ('Roof Sun Protection Painter',    'White/reflective roof coating for heat and sun protection')
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
