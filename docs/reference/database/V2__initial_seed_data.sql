-- Flyway Migration V2: Seed Data for Vehicle Categories, Fare Rules & Super Admin

-- 1. Seed Vehicle Categories
INSERT INTO vehicle_category (id, name, display_name, description, base_seating, sort_order, is_active)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'AUTO', 'Auto Rickshaw', 'Quick and affordable 3-seater city rides', 3, 1, true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'SEDAN', 'Sedan', 'Comfortable 4-seater cars for daily commute', 4, 2, true),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'SUV', 'SUV', 'Spacious 6-seater vehicles for family trips', 6, 3, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Base Fare Rules
INSERT INTO fare_rule (id, vehicle_category_id, distance_type, base_fare, per_km_rate, per_minute_rate, minimum_fare, min_distance_km, waiting_charge_per_min, scheduled_ride_fee, commission_percentage, tax_percentage)
VALUES
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'SHORT', 30.00, 12.00, 1.50, 50.00, 2.00, 2.00, 0.00, 20.00, 5.00),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'SHORT', 50.00, 14.00, 2.00, 80.00, 2.00, 2.50, 0.00, 20.00, 5.00),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f33', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'SHORT', 80.00, 18.00, 2.50, 120.00, 2.00, 3.00, 0.00, 20.00, 5.00),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f44', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'LONG', 150.00, 12.00, 1.00, 500.00, 0.00, 0.00, 50.00, 15.00, 5.00),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f55', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'LONG', 250.00, 15.00, 1.50, 800.00, 0.00, 0.00, 75.00, 15.00, 5.00)
ON CONFLICT DO NOTHING;

-- 3. Seed Default Super Admin Account (Password: Admin@12345)
INSERT INTO admin_user (id, email, password_hash, full_name, role, is_active)
VALUES
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'admin@ridenow.com', '$2a$12$e/3Kz7L9w1y3zV9e/7kM3.J1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b', 'Super Admin', 'SUPER_ADMIN', true)
ON CONFLICT (email) DO NOTHING;
