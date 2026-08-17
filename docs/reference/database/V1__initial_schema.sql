-- Flyway Migration V1: Initial Database Schema (30 Tables)
-- Platform: RideNow Ride-Booking Platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Table: user (Riders)
CREATE TABLE "user" (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               VARCHAR(15) NOT NULL UNIQUE,
    email               VARCHAR(255) UNIQUE,
    full_name           VARCHAR(100) NOT NULL,
    profile_photo_url   TEXT,
    phone_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    fcm_token           TEXT,
    device_id           VARCHAR(255),
    average_rating      DECIMAL(3,2) NOT NULL DEFAULT 5.00 CHECK (average_rating BETWEEN 0.00 AND 5.00),
    total_rides         INTEGER NOT NULL DEFAULT 0,
    is_blocked          BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_reason      TEXT,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at       TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Table: admin_user
CREATE TABLE admin_user (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    full_name           VARCHAR(100) NOT NULL,
    role                VARCHAR(20) NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('ADMIN', 'SUPER_ADMIN')),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMP WITH TIME ZONE,
    last_login_ip       VARCHAR(45),
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret   VARCHAR(100),
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 3. Table: driver
CREATE TABLE driver (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone                   VARCHAR(15) NOT NULL UNIQUE,
    email                   VARCHAR(255) UNIQUE,
    full_name               VARCHAR(100) NOT NULL,
    profile_photo_url       TEXT,
    date_of_birth           DATE,
    gender                  VARCHAR(10) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    address                 TEXT,
    phone_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified          BOOLEAN NOT NULL DEFAULT FALSE,
    fcm_token               TEXT,
    device_id               VARCHAR(255),
    approval_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED')),
    approved_by             UUID REFERENCES admin_user(id),
    approved_at             TIMESTAMP WITH TIME ZONE,
    rejection_reason        TEXT,
    suspension_reason       TEXT,
    is_online               BOOLEAN NOT NULL DEFAULT FALSE,
    current_ride_id         UUID,
    long_distance_eligible  BOOLEAN NOT NULL DEFAULT FALSE,
    average_rating          DECIMAL(3,2) NOT NULL DEFAULT 5.00 CHECK (average_rating BETWEEN 0.00 AND 5.00),
    total_rides             INTEGER NOT NULL DEFAULT 0,
    acceptance_rate         DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    cancellation_rate       DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at           TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version                 INTEGER NOT NULL DEFAULT 0
);

-- 4. Table: driver_document
CREATE TABLE driver_document (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id           UUID NOT NULL REFERENCES driver(id) ON DELETE CASCADE,
    document_type       VARCHAR(30) NOT NULL CHECK (document_type IN ('DRIVING_LICENCE', 'AADHAAR', 'PAN', 'VEHICLE_RC', 'INSURANCE', 'PERMIT', 'POLLUTION', 'PHOTO')),
    document_number     VARCHAR(50),
    file_url            TEXT NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    file_size           INTEGER NOT NULL,
    mime_type           VARCHAR(50) NOT NULL,
    expiry_date         DATE,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    verified_by         UUID REFERENCES admin_user(id),
    verified_at         TIMESTAMP WITH TIME ZONE,
    rejection_reason    TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Table: driver_location
CREATE TABLE driver_location (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id   UUID NOT NULL UNIQUE REFERENCES driver(id) ON DELETE CASCADE,
    location    GEOGRAPHY(Point, 4326) NOT NULL,
    latitude    DECIMAL(10,7) NOT NULL,
    longitude   DECIMAL(10,7) NOT NULL,
    heading     DECIMAL(5,2),
    speed       DECIMAL(6,2),
    accuracy    DECIMAL(6,2),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6. Table: driver_availability
CREATE TABLE driver_availability (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id                  UUID NOT NULL UNIQUE REFERENCES driver(id) ON DELETE CASCADE,
    is_online                  BOOLEAN NOT NULL DEFAULT FALSE,
    went_online_at             TIMESTAMP WITH TIME ZONE,
    went_offline_at            TIMESTAMP WITH TIME ZONE,
    offline_reason             VARCHAR(30),
    last_heartbeat             TIMESTAMP WITH TIME ZONE,
    battery_level              INTEGER,
    app_version                VARCHAR(20),
    cooldown_until             TIMESTAMP WITH TIME ZONE,
    total_online_minutes_today INTEGER NOT NULL DEFAULT 0,
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 7. Table: vehicle_category
CREATE TABLE vehicle_category (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(30) NOT NULL UNIQUE,
    display_name    VARCHAR(50) NOT NULL,
    description     TEXT,
    icon_url        TEXT,
    base_seating    INTEGER NOT NULL DEFAULT 4,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 8. Table: vehicle
CREATE TABLE vehicle (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id           UUID NOT NULL UNIQUE REFERENCES driver(id) ON DELETE CASCADE,
    vehicle_category_id UUID NOT NULL REFERENCES vehicle_category(id),
    make                VARCHAR(50) NOT NULL,
    model               VARCHAR(50) NOT NULL,
    year                INTEGER NOT NULL CHECK (year > 2000),
    color               VARCHAR(30) NOT NULL,
    registration_number VARCHAR(20) NOT NULL UNIQUE,
    seating_capacity    INTEGER NOT NULL DEFAULT 4,
    fuel_type           VARCHAR(15) CHECK (fuel_type IN ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID')),
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    photo_urls          JSONB,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 9. Table: ride (Core entity)
CREATE TABLE ride (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_number             VARCHAR(20) NOT NULL UNIQUE,
    rider_id                UUID NOT NULL REFERENCES "user"(id),
    driver_id               UUID REFERENCES driver(id),
    vehicle_category_id     UUID NOT NULL REFERENCES vehicle_category(id),
    ride_type               VARCHAR(20) NOT NULL CHECK (ride_type IN ('IMMEDIATE', 'SCHEDULED')),
    distance_type           VARCHAR(20) NOT NULL CHECK (distance_type IN ('SHORT', 'LONG')),
    status                  VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
                                'REQUESTED', 'SEARCHING_DRIVER', 'NO_DRIVER_FOUND', 'DRIVER_ASSIGNED',
                                'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED',
                                'PAYMENT_PENDING', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'SETTLED',
                                'CANCELLED_BY_RIDER', 'CANCELLED_BY_DRIVER', 'EXPIRED', 'REFUNDED'
                            )),
    pickup_lat              DECIMAL(10,7) NOT NULL,
    pickup_lng              DECIMAL(10,7) NOT NULL,
    pickup_address          TEXT NOT NULL,
    drop_lat                DECIMAL(10,7) NOT NULL,
    drop_lng                DECIMAL(10,7) NOT NULL,
    drop_address            TEXT NOT NULL,
    estimated_distance_km   DECIMAL(10,2) NOT NULL,
    estimated_duration_min  INTEGER NOT NULL,
    estimated_fare          DECIMAL(10,2) NOT NULL,
    actual_distance_km      DECIMAL(10,2),
    actual_duration_min     INTEGER,
    extra_amount            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    final_fare              DECIMAL(10,2),
    payment_method          VARCHAR(20) NOT NULL DEFAULT 'ONLINE' CHECK (payment_method IN ('ONLINE', 'CASH')),
    ride_otp                VARCHAR(6),
    otp_verified            BOOLEAN NOT NULL DEFAULT FALSE,
    waiting_time_min        INTEGER,
    toll_amount             DECIMAL(10,2) DEFAULT 0.00,
    parking_amount          DECIMAL(10,2) DEFAULT 0.00,
    matching_attempts       INTEGER NOT NULL DEFAULT 0,
    requested_at            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    driver_assigned_at      TIMESTAMP WITH TIME ZONE,
    driver_arrived_at       TIMESTAMP WITH TIME ZONE,
    trip_started_at         TIMESTAMP WITH TIME ZONE,
    trip_completed_at       TIMESTAMP WITH TIME ZONE,
    cancelled_at            TIMESTAMP WITH TIME ZONE,
    idempotency_key         VARCHAR(64) UNIQUE,
    is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version                 INTEGER NOT NULL DEFAULT 0
);

-- Foreign key link back to ride for driver's active ride
ALTER TABLE driver ADD CONSTRAINT fk_driver_current_ride FOREIGN KEY (current_ride_id) REFERENCES ride(id);

-- 10. Table: ride_request
CREATE TABLE ride_request (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id             UUID NOT NULL REFERENCES ride(id) ON DELETE CASCADE,
    driver_id           UUID NOT NULL REFERENCES driver(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    sent_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at        TIMESTAMP WITH TIME ZONE,
    response_time_ms    INTEGER,
    driver_distance_km  DECIMAL(6,2),
    estimated_earnings  DECIMAL(10,2),
    rejection_reason    TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ride_request_driver UNIQUE (ride_id, driver_id)
);

-- 11. Table: ride_assignment (Critical Race-Condition Protection)
CREATE TABLE ride_assignment (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id     UUID NOT NULL UNIQUE REFERENCES ride(id) ON DELETE CASCADE,
    driver_id   UUID NOT NULL REFERENCES driver(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    version     INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_ride_assignment_ride UNIQUE (ride_id)
);

-- 12. Table: ride_status_history
CREATE TABLE ride_status_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id         UUID NOT NULL REFERENCES ride(id) ON DELETE CASCADE,
    from_status     VARCHAR(30),
    to_status       VARCHAR(30) NOT NULL,
    changed_by      UUID,
    changed_by_role VARCHAR(20),
    reason          TEXT,
    metadata        JSONB,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 13. Table: ride_location (GPS Breadcrumbs)
CREATE TABLE ride_location (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id     UUID NOT NULL REFERENCES ride(id) ON DELETE CASCADE,
    latitude    DECIMAL(10,7) NOT NULL,
    longitude   DECIMAL(10,7) NOT NULL,
    heading     DECIMAL(5,2),
    speed       DECIMAL(6,2),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source      VARCHAR(10) NOT NULL DEFAULT 'DRIVER' CHECK (source IN ('DRIVER', 'RIDER'))
);

-- 14. Table: ride_financial (Immutable Audit)
CREATE TABLE ride_financial (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id                 UUID NOT NULL UNIQUE REFERENCES ride(id),
    base_fare               DECIMAL(10,2) NOT NULL,
    distance_fare           DECIMAL(10,2) NOT NULL,
    time_fare               DECIMAL(10,2) NOT NULL,
    waiting_charge          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    toll_charge             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    parking_charge          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    scheduled_fee           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    extra_amount            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    surge_multiplier       DECIMAL(3,2) NOT NULL DEFAULT 1.00,
    subtotal                DECIMAL(10,2) NOT NULL,
    tax_percentage          DECIMAL(5,2) NOT NULL,
    tax_amount              DECIMAL(10,2) NOT NULL,
    discount_amount         DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    promo_code              VARCHAR(50),
    total_fare              DECIMAL(10,2) NOT NULL,
    commission_percentage   DECIMAL(5,2) NOT NULL,
    platform_commission     DECIMAL(10,2) NOT NULL,
    driver_earnings         DECIMAL(10,2) NOT NULL,
    commission_gst_pct      DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    commission_gst_amount   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    fare_rule_snapshot      JSONB NOT NULL,
    is_finalized            BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at            TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 15. Table: scheduled_ride
CREATE TABLE scheduled_ride (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id             UUID NOT NULL UNIQUE REFERENCES ride(id) ON DELETE CASCADE,
    scheduled_date      DATE NOT NULL,
    scheduled_time      TIME NOT NULL,
    scheduled_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    rider_timezone      VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'MATCHING', 'MATCHED', 'CANCELLED', 'EXPIRED')),
    matching_started_at TIMESTAMP WITH TIME ZONE,
    reminders_sent      JSONB NOT NULL DEFAULT '[]',
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 16. Table: payment
CREATE TABLE payment (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id             UUID NOT NULL UNIQUE REFERENCES ride(id),
    rider_id            UUID NOT NULL REFERENCES "user"(id),
    amount              DECIMAL(10,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'INR',
    payment_method      VARCHAR(20) NOT NULL CHECK (payment_method IN ('ONLINE', 'CASH')),
    gateway             VARCHAR(30),
    gateway_order_id    VARCHAR(100) UNIQUE,
    gateway_payment_id  VARCHAR(100) UNIQUE,
    status              VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CASH_PENDING', 'CASH_COLLECTED')),
    paid_at             TIMESTAMP WITH TIME ZONE,
    failure_reason      TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    idempotency_key     VARCHAR(100) UNIQUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version             INTEGER NOT NULL DEFAULT 0
);

-- 17. Table: payment_transaction
CREATE TABLE payment_transaction (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id              UUID NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
    gateway_transaction_id  VARCHAR(100) UNIQUE,
    type                    VARCHAR(20) NOT NULL CHECK (type IN ('AUTHORIZE', 'CAPTURE', 'REFUND', 'WEBHOOK')),
    status                  VARCHAR(20) NOT NULL CHECK (status IN ('INITIATED', 'COMPLETED', 'FAILED')),
    amount                  DECIMAL(10,2) NOT NULL,
    gateway_response        JSONB,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 18. Table: refund
CREATE TABLE refund (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id          UUID NOT NULL REFERENCES payment(id),
    ride_id             UUID NOT NULL REFERENCES ride(id),
    amount              DECIMAL(10,2) NOT NULL,
    reason              TEXT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    gateway_refund_id  VARCHAR(100) UNIQUE,
    initiated_by        UUID REFERENCES admin_user(id),
    processed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 19. Table: driver_wallet (Double-Entry Ledger Base)
CREATE TABLE driver_wallet (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id               UUID NOT NULL UNIQUE REFERENCES driver(id) ON DELETE CASCADE,
    balance                 DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pending_amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_earned            DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_paid_out          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_commission_paid   DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version                 INTEGER NOT NULL DEFAULT 0
);

-- 20. Table: wallet_transaction
CREATE TABLE wallet_transaction (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id       UUID NOT NULL REFERENCES driver_wallet(id),
    driver_id       UUID NOT NULL REFERENCES driver(id),
    ride_id         UUID REFERENCES ride(id),
    type            VARCHAR(30) NOT NULL CHECK (type IN ('RIDE_EARNING', 'COMMISSION_DEDUCT', 'PAYOUT', 'ADJUSTMENT', 'REFUND_DEDUCT', 'BONUS', 'CANCELLATION_FEE', 'CASH_COMMISSION')),
    amount          DECIMAL(10,2) NOT NULL,
    direction       VARCHAR(10) NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    balance_before  DECIMAL(12,2) NOT NULL,
    balance_after   DECIMAL(12,2) NOT NULL,
    description     TEXT,
    reference_id    VARCHAR(100),
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 21. Table: payout
CREATE TABLE payout (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id           UUID NOT NULL REFERENCES driver(id),
    amount              DECIMAL(10,2) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED')),
    bank_account_last4  VARCHAR(4),
    gateway_payout_id   VARCHAR(100) UNIQUE,
    processed_at        TIMESTAMP WITH TIME ZONE,
    failure_reason      TEXT,
    idempotency_key     VARCHAR(100) NOT NULL UNIQUE,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 22. Table: fare_rule
CREATE TABLE fare_rule (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_category_id     UUID NOT NULL REFERENCES vehicle_category(id),
    distance_type           VARCHAR(20) NOT NULL CHECK (distance_type IN ('SHORT', 'LONG')),
    base_fare               DECIMAL(10,2) NOT NULL,
    per_km_rate             DECIMAL(10,2) NOT NULL,
    per_minute_rate         DECIMAL(10,2) NOT NULL,
    minimum_fare            DECIMAL(10,2) NOT NULL,
    min_distance_km         DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    waiting_charge_per_min  DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    free_waiting_min        INTEGER NOT NULL DEFAULT 3,
    scheduled_ride_fee      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    commission_percentage   DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    tax_percentage          DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    long_distance_threshold_km DECIMAL(6,2) NOT NULL DEFAULT 50.00,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    effective_until         TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 23. Table: fare_modifier
CREATE TABLE fare_modifier (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(50) NOT NULL,
    modifier_type           VARCHAR(20) NOT NULL CHECK (modifier_type IN ('SURGE', 'NIGHT', 'HOLIDAY', 'RAIN', 'CUSTOM')),
    multiplier              DECIMAL(3,2) NOT NULL DEFAULT 1.00 CHECK (multiplier >= 1.00),
    flat_addition           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    applies_to_category     UUID REFERENCES vehicle_category(id),
    start_time              TIME,
    end_time                TIME,
    valid_from              TIMESTAMP WITH TIME ZONE,
    valid_until             TIMESTAMP WITH TIME ZONE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 24. Table: cancellation
CREATE TABLE cancellation (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id                     UUID NOT NULL UNIQUE REFERENCES ride(id),
    cancelled_by                UUID NOT NULL,
    cancelled_by_role           VARCHAR(20) NOT NULL CHECK (cancelled_by_role IN ('RIDER', 'DRIVER', 'SYSTEM', 'ADMIN')),
    reason                      TEXT,
    reason_code                 VARCHAR(50),
    cancellation_fee            DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ride_status_at_cancellation VARCHAR(30) NOT NULL,
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 25. Table: cancellation_rule
CREATE TABLE cancellation_rule (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_category_id         UUID REFERENCES vehicle_category(id),
    ride_type                   VARCHAR(20) CHECK (ride_type IN ('IMMEDIATE', 'SCHEDULED')),
    cancelled_by_role           VARCHAR(20) NOT NULL CHECK (cancelled_by_role IN ('RIDER', 'DRIVER')),
    ride_status                 VARCHAR(30) NOT NULL,
    min_minutes_after_assignment INTEGER,
    max_minutes_after_assignment INTEGER,
    cancellation_fee            DECIMAL(10,2) NOT NULL,
    fee_type                    VARCHAR(10) NOT NULL DEFAULT 'FLAT' CHECK (fee_type IN ('FLAT', 'PERCENTAGE')),
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 26. Table: rating
CREATE TABLE rating (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id     UUID NOT NULL REFERENCES ride(id),
    rater_id    UUID NOT NULL,
    rater_role  VARCHAR(20) NOT NULL CHECK (rater_role IN ('RIDER', 'DRIVER')),
    ratee_id    UUID NOT NULL,
    ratee_role  VARCHAR(20) NOT NULL CHECK (ratee_role IN ('RIDER', 'DRIVER')),
    rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review      TEXT,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rating_ride_rater UNIQUE (ride_id, rater_id)
);

-- 27. Table: notification
CREATE TABLE notification (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID NOT NULL,
    recipient_role  VARCHAR(20) NOT NULL CHECK (recipient_role IN ('RIDER', 'DRIVER', 'ADMIN')),
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    body            TEXT NOT NULL,
    data            JSONB,
    channel         VARCHAR(20) NOT NULL CHECK (channel IN ('PUSH', 'EMAIL', 'SMS', 'IN_APP')),
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED')),
    sent_at         TIMESTAMP WITH TIME ZONE,
    read_at         TIMESTAMP WITH TIME ZONE,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 28. Table: saved_address
CREATE TABLE saved_address (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    label       VARCHAR(50) NOT NULL,
    address     TEXT NOT NULL,
    latitude    DECIMAL(10,7) NOT NULL,
    longitude   DECIMAL(10,7) NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 29. Table: support_ticket
CREATE TABLE support_ticket (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number   VARCHAR(20) NOT NULL UNIQUE,
    created_by      UUID NOT NULL,
    created_by_role VARCHAR(20) NOT NULL CHECK (created_by_role IN ('RIDER', 'DRIVER')),
    ride_id         UUID REFERENCES ride(id),
    category        VARCHAR(50) NOT NULL,
    subject         VARCHAR(200) NOT NULL,
    description     TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    priority        VARCHAR(10) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    assigned_to     UUID REFERENCES admin_user(id),
    resolution      TEXT,
    resolved_at     TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 30. Table: audit_log
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID REFERENCES admin_user(id),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50) NOT NULL,
    entity_id       UUID,
    previous_value  JSONB,
    new_value       JSONB,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    description     TEXT,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_user_phone ON "user"(phone);
CREATE INDEX idx_driver_phone ON driver(phone);
CREATE INDEX idx_driver_status ON driver(approval_status);
CREATE INDEX idx_driver_online ON driver(is_online) WHERE is_online = TRUE AND approval_status = 'APPROVED';
CREATE INDEX idx_driver_loc_geo ON driver_location USING GIST(location);
CREATE INDEX idx_ride_rider ON ride(rider_id);
CREATE INDEX idx_ride_driver ON ride(driver_id);
CREATE INDEX idx_ride_status ON ride(status);
CREATE INDEX idx_ride_created ON ride(created_at);
CREATE INDEX idx_ride_active_rider ON ride(rider_id) WHERE status IN ('REQUESTED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED');
CREATE INDEX idx_wtxn_wallet ON wallet_transaction(wallet_id);
CREATE INDEX idx_wtxn_idempotency ON wallet_transaction(idempotency_key);
CREATE INDEX idx_audit_created ON audit_log(created_at);
