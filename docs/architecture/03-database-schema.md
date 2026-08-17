# 📊 RideNow — Complete Database Schema

> **30 Tables · PostgreSQL 16 · PostGIS Enabled**  
> All timestamps are `TIMESTAMP WITH TIME ZONE` stored in UTC  
> All primary keys are `UUID` (v7, time-sortable)  
> All monetary values use `DECIMAL(10,2)` or `DECIMAL(12,2)`

---

## Table 1: `user` (Rider Accounts)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `phone` | VARCHAR(15) | NO | — | UNIQUE | E.164 format (+919876543210) |
| `email` | VARCHAR(255) | YES | — | UNIQUE (nullable) | Optional email |
| `full_name` | VARCHAR(100) | NO | — | — | Display name |
| `profile_photo_url` | TEXT | YES | — | — | S3 URL |
| `phone_verified` | BOOLEAN | NO | `FALSE` | — | OTP verified |
| `email_verified` | BOOLEAN | NO | `FALSE` | — | Email verified |
| `fcm_token` | TEXT | YES | — | — | Push notification token |
| `device_id` | VARCHAR(255) | YES | — | — | For session management |
| `average_rating` | DECIMAL(3,2) | NO | `5.00` | CHECK(0-5) | Calculated average |
| `total_rides` | INTEGER | NO | `0` | — | Ride count |
| `is_blocked` | BOOLEAN | NO | `FALSE` | — | Admin block |
| `blocked_reason` | TEXT | YES | — | — | Why blocked |
| `is_deleted` | BOOLEAN | NO | `FALSE` | — | Soft delete |
| `last_login_at` | TIMESTAMPTZ | YES | — | — | Last login time |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Registration time |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last update |

**Indexes:**
- `idx_user_phone` UNIQUE on `phone`
- `idx_user_email` UNIQUE on `email` WHERE `email IS NOT NULL`
- `idx_user_active` on `is_deleted, is_blocked`

---

## Table 2: `driver` (Driver Accounts)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `phone` | VARCHAR(15) | NO | — | UNIQUE | E.164 format |
| `email` | VARCHAR(255) | YES | — | UNIQUE (nullable) | Optional email |
| `full_name` | VARCHAR(100) | NO | — | Display name |
| `profile_photo_url` | TEXT | YES | — | — | S3 URL |
| `date_of_birth` | DATE | YES | — | — | Age verification |
| `gender` | VARCHAR(10) | YES | — | CHECK(MALE, FEMALE, OTHER) | — |
| `address` | TEXT | YES | — | — | Permanent address |
| `phone_verified` | BOOLEAN | NO | `FALSE` | — | OTP verified |
| `email_verified` | BOOLEAN | NO | `FALSE` | — | Email verified |
| `fcm_token` | TEXT | YES | — | — | Push notification token |
| `device_id` | VARCHAR(255) | YES | — | — | Device tracking |
| `approval_status` | VARCHAR(20) | NO | `PENDING` | CHECK | PENDING, APPROVED, REJECTED, SUSPENDED |
| `approved_by` | UUID | YES | — | FK → admin_user | Admin who approved |
| `approved_at` | TIMESTAMPTZ | YES | — | — | Approval timestamp |
| `rejection_reason` | TEXT | YES | — | — | Why rejected |
| `suspension_reason` | TEXT | YES | — | — | Why suspended |
| `is_online` | BOOLEAN | NO | `FALSE` | — | Online/offline status |
| `current_ride_id` | UUID | YES | — | FK → ride | Active ride (null if free) |
| `long_distance_eligible` | BOOLEAN | NO | `FALSE` | — | Can accept long trips |
| `average_rating` | DECIMAL(3,2) | NO | `5.00` | CHECK(0-5) | Average rating |
| `total_rides` | INTEGER | NO | `0` | — | Completed rides |
| `acceptance_rate` | DECIMAL(5,2) | NO | `100.00` | — | Accept % (last 7 days) |
| `cancellation_rate` | DECIMAL(5,2) | NO | `0.00` | — | Cancel % (last 7 days) |
| `is_deleted` | BOOLEAN | NO | `FALSE` | — | Soft delete |
| `last_login_at` | TIMESTAMPTZ | YES | — | — | Last login |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Registration |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last update |
| `version` | INTEGER | NO | `0` | — | Optimistic locking |

**Indexes:**
- `idx_driver_phone` UNIQUE on `phone`
- `idx_driver_approval` on `approval_status`
- `idx_driver_online` on `is_online` WHERE `is_online = TRUE AND approval_status = 'APPROVED'`
- `idx_driver_current_ride` on `current_ride_id`

---

## Table 3: `driver_document`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `driver_id` | UUID | NO | — | FK → driver | Owner |
| `document_type` | VARCHAR(30) | NO | — | CHECK | DRIVING_LICENCE, AADHAAR, PAN, VEHICLE_RC, INSURANCE, PERMIT, POLLUTION, PHOTO |
| `document_number` | VARCHAR(50) | YES | — | — | Document number (encrypted) |
| `file_url` | TEXT | NO | — | — | S3 URL (private bucket) |
| `file_name` | VARCHAR(255) | NO | — | — | Original filename |
| `file_size` | INTEGER | NO | — | — | Size in bytes |
| `mime_type` | VARCHAR(50) | NO | — | — | File MIME type |
| `expiry_date` | DATE | YES | — | — | Document expiry |
| `verification_status` | VARCHAR(20) | NO | `PENDING` | CHECK | PENDING, APPROVED, REJECTED |
| `verified_by` | UUID | YES | — | FK → admin_user | Admin who verified |
| `verified_at` | TIMESTAMPTZ | YES | — | — | Verification time |
| `rejection_reason` | TEXT | YES | — | — | Why rejected |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Upload time |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last update |

**Indexes:**
- `idx_doc_driver` on `driver_id`
- `idx_doc_type` on `driver_id, document_type`
- `idx_doc_expiry` on `expiry_date` WHERE `verification_status = 'APPROVED'`

---

## Table 4: `driver_location`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `driver_id` | UUID | NO | — | FK → driver, UNIQUE | One row per driver |
| `location` | GEOGRAPHY(Point, 4326) | NO | — | — | PostGIS point |
| `latitude` | DECIMAL(10,7) | NO | — | — | Lat (for quick read) |
| `longitude` | DECIMAL(10,7) | NO | — | — | Lng (for quick read) |
| `heading` | DECIMAL(5,2) | YES | — | — | Direction in degrees |
| `speed` | DECIMAL(6,2) | YES | — | — | Speed in km/h |
| `accuracy` | DECIMAL(6,2) | YES | — | — | GPS accuracy in meters |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last GPS update |

**Indexes:**
- `idx_driver_loc_geo` GIST on `location` (spatial index)
- `idx_driver_loc_driver` UNIQUE on `driver_id`

> **Note:** Primary live location is in **Redis GEO** for speed. This table is a PostgreSQL fallback and for queries that need ACID.

---

## Table 5: `driver_availability`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `driver_id` | UUID | NO | — | FK → driver, UNIQUE | One row per driver |
| `is_online` | BOOLEAN | NO | `FALSE` | — | Current status |
| `went_online_at` | TIMESTAMPTZ | YES | — | — | When went online |
| `went_offline_at` | TIMESTAMPTZ | YES | — | — | When went offline |
| `offline_reason` | VARCHAR(30) | YES | — | — | MANUAL, HEARTBEAT_TIMEOUT, ADMIN, COOLDOWN |
| `last_heartbeat` | TIMESTAMPTZ | YES | — | — | Last heartbeat received |
| `battery_level` | INTEGER | YES | — | — | Driver's phone battery % |
| `app_version` | VARCHAR(20) | YES | — | — | Current app version |
| `cooldown_until` | TIMESTAMPTZ | YES | — | — | Cannot go online until |
| `total_online_minutes_today` | INTEGER | NO | `0` | — | Fatigue tracking |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last update |

**Indexes:**
- `idx_avail_driver` UNIQUE on `driver_id`
- `idx_avail_heartbeat` on `last_heartbeat` WHERE `is_online = TRUE`

---

## Table 6: `vehicle`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `driver_id` | UUID | NO | — | FK → driver, UNIQUE | Owner (one vehicle per driver for MVP) |
| `vehicle_category_id` | UUID | NO | — | FK → vehicle_category | Category |
| `make` | VARCHAR(50) | NO | — | — | e.g., Maruti |
| `model` | VARCHAR(50) | NO | — | — | e.g., Dzire |
| `year` | INTEGER | NO | — | CHECK(>2000) | Manufacturing year |
| `color` | VARCHAR(30) | NO | — | — | Vehicle color |
| `registration_number` | VARCHAR(20) | NO | — | UNIQUE | e.g., TN-07-AB-1234 |
| `seating_capacity` | INTEGER | NO | `4` | — | Passenger seats |
| `fuel_type` | VARCHAR(15) | YES | — | CHECK | PETROL, DIESEL, CNG, ELECTRIC, HYBRID |
| `is_verified` | BOOLEAN | NO | `FALSE` | — | Admin verified |
| `photo_urls` | JSONB | YES | — | — | Array of photo URLs |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Currently in use |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Added time |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last update |

**Indexes:**
- `idx_vehicle_driver` UNIQUE on `driver_id`
- `idx_vehicle_reg` UNIQUE on `registration_number`
- `idx_vehicle_category` on `vehicle_category_id`

---

## Table 7: `vehicle_category`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `name` | VARCHAR(30) | NO | — | UNIQUE | AUTO, SEDAN, SUV, PREMIUM, BIKE |
| `display_name` | VARCHAR(50) | NO | — | — | "Auto Rickshaw", "Sedan" |
| `description` | TEXT | YES | — | — | Category description |
| `icon_url` | TEXT | YES | — | — | Category icon |
| `base_seating` | INTEGER | NO | `4` | — | Default seating |
| `sort_order` | INTEGER | NO | `0` | — | Display order |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Available for booking |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

---

## Table 8: `ride` (Central Entity)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_number` | VARCHAR(20) | NO | — | UNIQUE | Human-readable: RN-20260808-0001 |
| `rider_id` | UUID | NO | — | FK → user | Who booked |
| `driver_id` | UUID | YES | — | FK → driver | Assigned driver (null until assigned) |
| `vehicle_category_id` | UUID | NO | — | FK → vehicle_category | Selected category |
| `ride_type` | VARCHAR(20) | NO | — | CHECK(IMMEDIATE, SCHEDULED) | Ride type |
| `distance_type` | VARCHAR(20) | NO | — | CHECK(SHORT, LONG) | Distance classification |
| `status` | VARCHAR(30) | NO | `'REQUESTED'` | CHECK (see state machine) | Current status |
| `pickup_lat` | DECIMAL(10,7) | NO | — | — | Pickup latitude |
| `pickup_lng` | DECIMAL(10,7) | NO | — | — | Pickup longitude |
| `pickup_address` | TEXT | NO | — | — | Pickup address text |
| `drop_lat` | DECIMAL(10,7) | NO | — | — | Drop latitude |
| `drop_lng` | DECIMAL(10,7) | NO | — | — | Drop longitude |
| `drop_address` | TEXT | NO | — | — | Drop address text |
| `estimated_distance_km` | DECIMAL(10,2) | NO | — | — | Maps API estimate |
| `estimated_duration_min` | INTEGER | NO | — | — | Maps API estimate |
| `estimated_fare` | DECIMAL(10,2) | NO | — | — | Pre-booking estimate |
| `actual_distance_km` | DECIMAL(10,2) | YES | — | — | Actual (from GPS) |
| `actual_duration_min` | INTEGER | YES | — | — | Actual trip time |
| `extra_amount` | DECIMAL(10,2) | NO | `0.00` | — | Rider-added boost |
| `final_fare` | DECIMAL(10,2) | YES | — | — | Final calculated fare |
| `payment_method` | VARCHAR(20) | NO | `'ONLINE'` | CHECK(ONLINE, CASH) | Payment method |
| `ride_otp` | VARCHAR(6) | YES | — | — | Verification OTP |
| `otp_verified` | BOOLEAN | NO | `FALSE` | — | OTP checked |
| `waiting_time_min` | INTEGER | YES | — | — | Waiting at pickup (min) |
| `toll_amount` | DECIMAL(10,2) | YES | `0.00` | — | Toll charges |
| `parking_amount` | DECIMAL(10,2) | YES | `0.00` | — | Parking charges |
| `matching_attempts` | INTEGER | NO | `0` | — | How many drivers tried |
| `requested_at` | TIMESTAMPTZ | NO | `NOW()` | — | When requested |
| `driver_assigned_at` | TIMESTAMPTZ | YES | — | — | When assigned |
| `driver_arrived_at` | TIMESTAMPTZ | YES | — | — | When arrived |
| `trip_started_at` | TIMESTAMPTZ | YES | — | — | When started |
| `trip_completed_at` | TIMESTAMPTZ | YES | — | — | When completed |
| `cancelled_at` | TIMESTAMPTZ | YES | — | — | When cancelled |
| `idempotency_key` | VARCHAR(64) | YES | — | UNIQUE | Prevent duplicate creation |
| `is_deleted` | BOOLEAN | NO | `FALSE` | — | Soft delete |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |
| `version` | INTEGER | NO | `0` | — | Optimistic locking |

**Indexes:**
- `idx_ride_rider` on `rider_id`
- `idx_ride_driver` on `driver_id`
- `idx_ride_status` on `status`
- `idx_ride_type` on `ride_type`
- `idx_ride_created` on `created_at`
- `idx_ride_number` UNIQUE on `ride_number`
- `idx_ride_idempotency` UNIQUE on `idempotency_key`
- `idx_ride_active_rider` on `rider_id` WHERE `status IN ('REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED')` (concurrent ride prevention)

---

## Table 9: `ride_request` (Driver Matching Requests)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride | Which ride |
| `driver_id` | UUID | NO | — | FK → driver | Which driver |
| `status` | VARCHAR(20) | NO | `'PENDING'` | CHECK | PENDING, ACCEPTED, REJECTED, EXPIRED, CANCELLED |
| `sent_at` | TIMESTAMPTZ | NO | `NOW()` | — | When sent to driver |
| `expires_at` | TIMESTAMPTZ | NO | — | — | Request expiry time |
| `responded_at` | TIMESTAMPTZ | YES | — | — | When driver responded |
| `response_time_ms` | INTEGER | YES | — | — | Response time in ms |
| `driver_distance_km` | DECIMAL(6,2) | YES | — | — | Distance at time of request |
| `estimated_earnings` | DECIMAL(10,2) | YES | — | — | Shown to driver |
| `rejection_reason` | TEXT | YES | — | — | If rejected, why |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `idx_request_ride_driver` UNIQUE on `(ride_id, driver_id)` — prevent duplicate requests
- `idx_request_ride` on `ride_id`
- `idx_request_driver` on `driver_id`
- `idx_request_pending` on `driver_id` WHERE `status = 'PENDING'`

---

## Table 10: `ride_assignment` (Race-Condition Prevention)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride, **UNIQUE** | **Only ONE driver per ride** |
| `driver_id` | UUID | NO | — | FK → driver | Assigned driver |
| `assigned_at` | TIMESTAMPTZ | NO | `NOW()` | — | Assignment time |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Active assignment |
| `version` | INTEGER | NO | `1` | — | Optimistic locking |

**Indexes:**
- `uq_ride_assignment_ride` UNIQUE on `ride_id` — **THE critical constraint**
- `idx_assignment_driver_active` UNIQUE on `driver_id` WHERE `is_active = TRUE` — one active ride per driver

---

## Table 11: `ride_status_history`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride | Which ride |
| `from_status` | VARCHAR(30) | YES | — | — | Previous status (null for initial) |
| `to_status` | VARCHAR(30) | NO | — | — | New status |
| `changed_by` | UUID | YES | — | — | User/Driver/System ID |
| `changed_by_role` | VARCHAR(20) | YES | — | — | RIDER, DRIVER, SYSTEM, ADMIN |
| `reason` | TEXT | YES | — | — | Why changed |
| `metadata` | JSONB | YES | — | — | Additional context |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | When changed |

**Indexes:**
- `idx_status_hist_ride` on `ride_id`
- `idx_status_hist_time` on `created_at`

---

## Table 12: `ride_location` (GPS Breadcrumbs)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride | Which ride |
| `latitude` | DECIMAL(10,7) | NO | — | — | GPS lat |
| `longitude` | DECIMAL(10,7) | NO | — | — | GPS lng |
| `heading` | DECIMAL(5,2) | YES | — | — | Direction |
| `speed` | DECIMAL(6,2) | YES | — | — | km/h |
| `recorded_at` | TIMESTAMPTZ | NO | — | — | GPS timestamp |
| `source` | VARCHAR(10) | NO | `'DRIVER'` | CHECK(DRIVER, RIDER) | Who sent |

**Indexes:**
- `idx_ride_loc_ride` on `ride_id`
- `idx_ride_loc_time` on `ride_id, recorded_at`

> **Note:** Store every 30 seconds during active trip. Purge after 90 days (keep only for dispute resolution).

---

## Table 13: `ride_financial` (Immutable Financial Record)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride, **UNIQUE** | One record per ride |
| `base_fare` | DECIMAL(10,2) | NO | — | — | Base fare |
| `distance_fare` | DECIMAL(10,2) | NO | — | — | Per-km charge |
| `time_fare` | DECIMAL(10,2) | NO | — | — | Per-minute charge |
| `waiting_charge` | DECIMAL(10,2) | NO | `0.00` | — | Waiting time charge |
| `toll_charge` | DECIMAL(10,2) | NO | `0.00` | — | Toll pass-through |
| `parking_charge` | DECIMAL(10,2) | NO | `0.00` | — | Parking pass-through |
| `scheduled_fee` | DECIMAL(10,2) | NO | `0.00` | — | Scheduled ride fee |
| `extra_amount` | DECIMAL(10,2) | NO | `0.00` | — | Rider boost |
| `surge_multiplier` | DECIMAL(3,2) | NO | `1.00` | — | Surge pricing (1.0 = none) |
| `subtotal` | DECIMAL(10,2) | NO | — | — | Before tax/discount |
| `tax_percentage` | DECIMAL(5,2) | NO | — | — | GST % |
| `tax_amount` | DECIMAL(10,2) | NO | — | — | Tax amount |
| `discount_amount` | DECIMAL(10,2) | NO | `0.00` | — | Discount |
| `promo_code` | VARCHAR(50) | YES | — | — | Applied promo |
| `total_fare` | DECIMAL(10,2) | NO | — | — | Final amount charged |
| `commission_percentage` | DECIMAL(5,2) | NO | — | — | Platform % |
| `platform_commission` | DECIMAL(10,2) | NO | — | — | Platform's share |
| `driver_earnings` | DECIMAL(10,2) | NO | — | — | Driver's share |
| `commission_gst_pct` | DECIMAL(5,2) | NO | `18.00` | — | GST on commission |
| `commission_gst_amount` | DECIMAL(10,2) | NO | `0.00` | — | GST amount |
| `fare_rule_snapshot` | JSONB | NO | — | — | Fare rules at time of ride |
| `is_finalized` | BOOLEAN | NO | `FALSE` | — | Locked after settlement |
| `finalized_at` | TIMESTAMPTZ | YES | — | — | When finalized |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `idx_financial_ride` UNIQUE on `ride_id`

---

## Table 14: `scheduled_ride`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride, UNIQUE | Associated ride |
| `scheduled_date` | DATE | NO | — | — | Ride date |
| `scheduled_time` | TIME | NO | — | — | Ride time |
| `scheduled_at` | TIMESTAMPTZ | NO | — | — | Combined datetime (UTC) |
| `rider_timezone` | VARCHAR(50) | NO | — | — | e.g., Asia/Kolkata |
| `status` | VARCHAR(20) | NO | `'CONFIRMED'` | CHECK | CONFIRMED, MATCHING, MATCHED, CANCELLED, EXPIRED |
| `matching_started_at` | TIMESTAMPTZ | YES | — | — | When matching began |
| `reminders_sent` | JSONB | NO | `'[]'` | — | Array of sent reminder types |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

**Indexes:**
- `idx_sched_ride` UNIQUE on `ride_id`
- `idx_sched_time` on `scheduled_at` WHERE `status IN ('CONFIRMED', 'MATCHING')`

---

## Table 15: `payment`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride, **UNIQUE** | One payment per ride |
| `rider_id` | UUID | NO | — | FK → user | Who pays |
| `amount` | DECIMAL(10,2) | NO | — | — | Payment amount |
| `currency` | VARCHAR(3) | NO | `'INR'` | — | Currency code |
| `payment_method` | VARCHAR(20) | NO | — | CHECK | ONLINE, CASH |
| `gateway` | VARCHAR(30) | YES | — | — | RAZORPAY, etc. |
| `gateway_order_id` | VARCHAR(100) | YES | — | UNIQUE (nullable) | Razorpay order ID |
| `gateway_payment_id` | VARCHAR(100) | YES | — | UNIQUE (nullable) | Razorpay payment ID |
| `status` | VARCHAR(20) | NO | `'CREATED'` | CHECK | CREATED, PROCESSING, COMPLETED, FAILED, CASH_PENDING, CASH_COLLECTED |
| `paid_at` | TIMESTAMPTZ | YES | — | — | When confirmed |
| `failure_reason` | TEXT | YES | — | — | If failed |
| `retry_count` | INTEGER | NO | `0` | — | Retry attempts |
| `idempotency_key` | VARCHAR(100) | YES | — | UNIQUE | Prevent duplicates |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |
| `version` | INTEGER | NO | `0` | — | Optimistic locking |

**Indexes:**
- `idx_payment_ride` UNIQUE on `ride_id`
- `idx_payment_gateway_id` UNIQUE on `gateway_payment_id`
- `idx_payment_status` on `status`
- `idx_payment_idempotency` UNIQUE on `idempotency_key`

---

## Table 16: `payment_transaction` (Gateway Interactions Log)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `payment_id` | UUID | NO | — | FK → payment | Parent payment |
| `gateway_transaction_id` | VARCHAR(100) | YES | — | **UNIQUE** | Idempotent webhook processing |
| `type` | VARCHAR(20) | NO | — | CHECK | AUTHORIZE, CAPTURE, REFUND, WEBHOOK |
| `status` | VARCHAR(20) | NO | — | CHECK | INITIATED, COMPLETED, FAILED |
| `amount` | DECIMAL(10,2) | NO | — | — | Transaction amount |
| `gateway_response` | JSONB | YES | — | — | Raw gateway response |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `idx_ptxn_payment` on `payment_id`
- `idx_ptxn_gateway_id` UNIQUE on `gateway_transaction_id`

---

## Table 17: `refund`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `payment_id` | UUID | NO | — | FK → payment | Original payment |
| `ride_id` | UUID | NO | — | FK → ride | Associated ride |
| `amount` | DECIMAL(10,2) | NO | — | — | Refund amount |
| `reason` | TEXT | NO | — | — | Refund reason |
| `status` | VARCHAR(20) | NO | `'INITIATED'` | CHECK | INITIATED, PROCESSING, COMPLETED, FAILED |
| `gateway_refund_id` | VARCHAR(100) | YES | — | UNIQUE | Gateway refund ID |
| `initiated_by` | UUID | YES | — | FK → admin_user | Admin (null = automatic) |
| `processed_at` | TIMESTAMPTZ | YES | — | — | When processed |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `idx_refund_payment` on `payment_id`
- `idx_refund_ride` on `ride_id`

---

## Table 18: `driver_wallet`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `driver_id` | UUID | NO | — | FK → driver, **UNIQUE** | One wallet per driver |
| `balance` | DECIMAL(12,2) | NO | `0.00` | — | Current available balance |
| `pending_amount` | DECIMAL(12,2) | NO | `0.00` | — | Pending settlement |
| `total_earned` | DECIMAL(12,2) | NO | `0.00` | — | Lifetime earnings |
| `total_paid_out` | DECIMAL(12,2) | NO | `0.00` | — | Lifetime payouts |
| `total_commission_paid` | DECIMAL(12,2) | NO | `0.00` | — | Lifetime commission |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Last update |
| `version` | INTEGER | NO | `0` | — | **Optimistic locking** |

**Indexes:**
- `idx_wallet_driver` UNIQUE on `driver_id`

---

## Table 19: `wallet_transaction`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `wallet_id` | UUID | NO | — | FK → driver_wallet | Which wallet |
| `driver_id` | UUID | NO | — | FK → driver | Driver (denormalized for query) |
| `ride_id` | UUID | YES | — | FK → ride | Associated ride (null for adjustments) |
| `type` | VARCHAR(30) | NO | — | CHECK | RIDE_EARNING, COMMISSION_DEDUCT, PAYOUT, ADJUSTMENT, REFUND_DEDUCT, BONUS, CANCELLATION_FEE, CASH_COMMISSION |
| `amount` | DECIMAL(10,2) | NO | — | — | Transaction amount |
| `direction` | VARCHAR(10) | NO | — | CHECK(CREDIT, DEBIT) | Credit or debit |
| `balance_before` | DECIMAL(12,2) | NO | — | — | Balance before this txn |
| `balance_after` | DECIMAL(12,2) | NO | — | — | Balance after this txn |
| `description` | TEXT | YES | — | — | Human-readable description |
| `reference_id` | VARCHAR(100) | YES | — | — | External reference |
| `idempotency_key` | VARCHAR(100) | NO | — | **UNIQUE** | Prevent duplicate transactions |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `idx_wtxn_wallet` on `wallet_id`
- `idx_wtxn_driver` on `driver_id`
- `idx_wtxn_ride` on `ride_id`
- `idx_wtxn_idempotency` UNIQUE on `idempotency_key`
- `idx_wtxn_created` on `driver_id, created_at`

---

## Table 20: `payout`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `driver_id` | UUID | NO | — | FK → driver | Driver |
| `amount` | DECIMAL(10,2) | NO | — | — | Payout amount |
| `status` | VARCHAR(20) | NO | `'INITIATED'` | CHECK | INITIATED, PROCESSING, COMPLETED, FAILED, REVERSED |
| `bank_account_last4` | VARCHAR(4) | YES | — | — | Last 4 digits |
| `gateway_payout_id` | VARCHAR(100) | YES | — | UNIQUE | Razorpay Payout ID |
| `processed_at` | TIMESTAMPTZ | YES | — | — | When completed |
| `failure_reason` | TEXT | YES | — | — | If failed |
| `idempotency_key` | VARCHAR(100) | NO | — | UNIQUE | Prevent duplicates |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

---

## Table 21: `fare_rule` (Admin-Configurable)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `vehicle_category_id` | UUID | NO | — | FK → vehicle_category | Which vehicle type |
| `distance_type` | VARCHAR(20) | NO | — | CHECK(SHORT, LONG) | Distance category |
| `base_fare` | DECIMAL(10,2) | NO | — | — | Base fare |
| `per_km_rate` | DECIMAL(10,2) | NO | — | — | Per kilometer |
| `per_minute_rate` | DECIMAL(10,2) | NO | — | — | Per minute |
| `minimum_fare` | DECIMAL(10,2) | NO | — | — | Minimum charge |
| `min_distance_km` | DECIMAL(6,2) | NO | `0.00` | — | Included km in base fare |
| `waiting_charge_per_min` | DECIMAL(6,2) | NO | `0.00` | — | Waiting charge |
| `free_waiting_min` | INTEGER | NO | `3` | — | Free waiting minutes |
| `scheduled_ride_fee` | DECIMAL(10,2) | NO | `0.00` | — | Additional fee |
| `commission_percentage` | DECIMAL(5,2) | NO | `20.00` | — | Platform commission % |
| `tax_percentage` | DECIMAL(5,2) | NO | `5.00` | — | GST % |
| `long_distance_threshold_km` | DECIMAL(6,2) | NO | `50.00` | — | Short/Long boundary |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Currently active |
| `effective_from` | TIMESTAMPTZ | NO | `NOW()` | — | When rule becomes effective |
| `effective_until` | TIMESTAMPTZ | YES | — | — | When rule expires (null = forever) |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

**Indexes:**
- `idx_fare_rule_lookup` on `vehicle_category_id, distance_type` WHERE `is_active = TRUE`

---

## Table 22: `fare_modifier` (Surge, Night, Holiday)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `name` | VARCHAR(50) | NO | — | — | "Night Surge", "Diwali Special" |
| `modifier_type` | VARCHAR(20) | NO | — | CHECK | SURGE, NIGHT, HOLIDAY, RAIN, CUSTOM |
| `multiplier` | DECIMAL(3,2) | NO | `1.00` | CHECK(>= 1.0) | Fare multiplier |
| `flat_addition` | DECIMAL(10,2) | NO | `0.00` | — | Flat amount to add |
| `applies_to_category` | UUID | YES | — | FK → vehicle_category | Null = all categories |
| `start_time` | TIME | YES | — | — | Time range start |
| `end_time` | TIME | YES | — | — | Time range end |
| `valid_from` | TIMESTAMPTZ | YES | — | — | Date range start |
| `valid_until` | TIMESTAMPTZ | YES | — | — | Date range end |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Active |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

---

## Table 23: `cancellation`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride, UNIQUE | One cancellation per ride |
| `cancelled_by` | UUID | NO | — | — | User/Driver ID |
| `cancelled_by_role` | VARCHAR(20) | NO | — | CHECK(RIDER, DRIVER, SYSTEM, ADMIN) | Who cancelled |
| `reason` | TEXT | YES | — | — | Cancellation reason |
| `reason_code` | VARCHAR(50) | YES | — | — | Structured reason code |
| `cancellation_fee` | DECIMAL(10,2) | NO | `0.00` | — | Fee charged |
| `ride_status_at_cancellation` | VARCHAR(30) | NO | — | — | Status when cancelled |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Cancelled at |

**Indexes:**
- `idx_cancel_ride` UNIQUE on `ride_id`
- `idx_cancel_user` on `cancelled_by`

---

## Table 24: `cancellation_rule` (Admin-Configurable)

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `vehicle_category_id` | UUID | YES | — | FK → vehicle_category | Null = all |
| `ride_type` | VARCHAR(20) | YES | — | CHECK | IMMEDIATE, SCHEDULED, null = all |
| `cancelled_by_role` | VARCHAR(20) | NO | — | CHECK | RIDER, DRIVER |
| `ride_status` | VARCHAR(30) | NO | — | — | Status at which cancel happens |
| `min_minutes_after_assignment` | INTEGER | YES | — | — | Time threshold (min) |
| `max_minutes_after_assignment` | INTEGER | YES | — | — | Time threshold (max) |
| `cancellation_fee` | DECIMAL(10,2) | NO | — | — | Fee amount |
| `fee_type` | VARCHAR(10) | NO | `'FLAT'` | CHECK(FLAT, PERCENTAGE) | Fee type |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Active |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

---

## Table 25: `rating`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ride_id` | UUID | NO | — | FK → ride | Which ride |
| `rater_id` | UUID | NO | — | — | Who rated |
| `rater_role` | VARCHAR(20) | NO | — | CHECK(RIDER, DRIVER) | Role of rater |
| `ratee_id` | UUID | NO | — | — | Who was rated |
| `ratee_role` | VARCHAR(20) | NO | — | CHECK(RIDER, DRIVER) | Role of ratee |
| `rating` | INTEGER | NO | — | CHECK(1-5) | Star rating |
| `review` | TEXT | YES | — | — | Optional review text |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `uq_rating_ride_rater` UNIQUE on `(ride_id, rater_id)` — **prevent duplicate ratings**
- `idx_rating_ratee` on `ratee_id`

---

## Table 26: `notification`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `recipient_id` | UUID | NO | — | — | User/Driver ID |
| `recipient_role` | VARCHAR(20) | NO | — | CHECK | RIDER, DRIVER, ADMIN |
| `type` | VARCHAR(50) | NO | — | — | RIDE_ASSIGNED, PAYMENT_COMPLETED, etc. |
| `title` | VARCHAR(200) | NO | — | — | Notification title |
| `body` | TEXT | NO | — | — | Notification body |
| `data` | JSONB | YES | — | — | Additional payload |
| `channel` | VARCHAR(20) | NO | — | CHECK | PUSH, EMAIL, SMS, IN_APP |
| `status` | VARCHAR(20) | NO | `'PENDING'` | CHECK | PENDING, SENT, DELIVERED, FAILED |
| `sent_at` | TIMESTAMPTZ | YES | — | — | When sent |
| `read_at` | TIMESTAMPTZ | YES | — | — | When read (in-app) |
| `is_read` | BOOLEAN | NO | `FALSE` | — | Read flag |
| `retry_count` | INTEGER | NO | `0` | — | Retry attempts |
| `error_message` | TEXT | YES | — | — | If failed |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |

**Indexes:**
- `idx_notif_recipient` on `recipient_id, recipient_role`
- `idx_notif_unread` on `recipient_id` WHERE `is_read = FALSE AND channel = 'IN_APP'`

---

## Table 27: `saved_address`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `user_id` | UUID | NO | — | FK → user | Owner |
| `label` | VARCHAR(50) | NO | — | — | "Home", "Work", "Gym" |
| `address` | TEXT | NO | — | — | Full address |
| `latitude` | DECIMAL(10,7) | NO | — | — | Lat |
| `longitude` | DECIMAL(10,7) | NO | — | — | Lng |
| `is_default` | BOOLEAN | NO | `FALSE` | — | Default address |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

**Indexes:**
- `idx_saved_addr_user` on `user_id`

---

## Table 28: `support_ticket`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `ticket_number` | VARCHAR(20) | NO | — | UNIQUE | SUP-20260808-0001 |
| `created_by` | UUID | NO | — | — | User/Driver ID |
| `created_by_role` | VARCHAR(20) | NO | — | CHECK | RIDER, DRIVER |
| `ride_id` | UUID | YES | — | FK → ride | Related ride |
| `category` | VARCHAR(50) | NO | — | — | PAYMENT, DRIVER, SAFETY, LOST_ITEM, etc. |
| `subject` | VARCHAR(200) | NO | — | — | Ticket subject |
| `description` | TEXT | NO | — | — | Detailed description |
| `status` | VARCHAR(20) | NO | `'OPEN'` | CHECK | OPEN, IN_PROGRESS, RESOLVED, CLOSED |
| `priority` | VARCHAR(10) | NO | `'MEDIUM'` | CHECK | LOW, MEDIUM, HIGH, URGENT |
| `assigned_to` | UUID | YES | — | FK → admin_user | Assigned admin |
| `resolution` | TEXT | YES | — | — | Resolution notes |
| `resolved_at` | TIMESTAMPTZ | YES | — | — | When resolved |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

**Indexes:**
- `idx_ticket_number` UNIQUE on `ticket_number`
- `idx_ticket_status` on `status`
- `idx_ticket_creator` on `created_by`

---

## Table 29: `admin_user`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `email` | VARCHAR(255) | NO | — | UNIQUE | Admin email |
| `password_hash` | VARCHAR(255) | NO | — | — | BCrypt hash |
| `full_name` | VARCHAR(100) | NO | — | — | Display name |
| `role` | VARCHAR(20) | NO | `'ADMIN'` | CHECK | ADMIN, SUPER_ADMIN |
| `is_active` | BOOLEAN | NO | `TRUE` | — | Account active |
| `last_login_at` | TIMESTAMPTZ | YES | — | — | Last login |
| `last_login_ip` | VARCHAR(45) | YES | — | — | Last login IP |
| `two_factor_enabled` | BOOLEAN | NO | `FALSE` | — | 2FA enabled |
| `two_factor_secret` | VARCHAR(100) | YES | — | — | TOTP secret (encrypted) |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | Created |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | — | Updated |

---

## Table 30: `audit_log`

| Column | Type | Nullable | Default | Constraints | Purpose |
|--------|------|----------|---------|-------------|---------|
| `id` | UUID | NO | `gen_random_uuid()` | PK | Primary key |
| `admin_id` | UUID | YES | — | FK → admin_user | Who performed action (null = system) |
| `action` | VARCHAR(100) | NO | — | — | DRIVER_APPROVED, COMMISSION_CHANGED, etc. |
| `entity_type` | VARCHAR(50) | NO | — | — | DRIVER, RIDE, FARE_RULE, etc. |
| `entity_id` | UUID | YES | — | — | ID of affected entity |
| `previous_value` | JSONB | YES | — | — | Before change |
| `new_value` | JSONB | YES | — | — | After change |
| `ip_address` | VARCHAR(45) | YES | — | — | Admin's IP |
| `user_agent` | TEXT | YES | — | — | Browser/device info |
| `description` | TEXT | YES | — | — | Human-readable description |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | — | When action occurred |

**Indexes:**
- `idx_audit_admin` on `admin_id`
- `idx_audit_entity` on `entity_type, entity_id`
- `idx_audit_action` on `action`
- `idx_audit_created` on `created_at`

---

## Relationships Summary

```
user ──1:N──► ride (rider_id)
user ──1:N──► saved_address
user ──1:N──► rating (rater_id)
user ──1:N──► support_ticket

driver ──1:N──► driver_document
driver ──1:1──► vehicle
driver ──1:1──► driver_location
driver ──1:1──► driver_availability
driver ──1:1──► driver_wallet
driver ──1:N──► ride (driver_id)
driver ──1:N──► wallet_transaction
driver ──1:N──► payout
driver ──1:N──► rating (ratee_id)

vehicle ──N:1──► vehicle_category

ride ──1:N──► ride_request
ride ──1:1──► ride_assignment
ride ──1:N──► ride_status_history
ride ──1:N──► ride_location
ride ──1:1──► ride_financial
ride ──1:1──► payment
ride ──0:1──► cancellation
ride ──1:N──► rating
ride ──0:1──► scheduled_ride

payment ──1:N──► payment_transaction
payment ──0:1──► refund

driver_wallet ──1:N──► wallet_transaction

fare_rule ──N:1──► vehicle_category
cancellation_rule ──N:1──► vehicle_category

admin_user ──1:N──► audit_log
```
