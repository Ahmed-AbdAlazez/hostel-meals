-- ========================================================
-- Neon Postgres Schema for Al-Zahraa Meal Booking Assistant
-- Run this in the Neon SQL Editor (https://console.neon.tech)
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES TABLE (Users & Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
    approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    credentials_invalid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, approval_status, is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 2. ZAHRAA_CREDENTIALS TABLE (Encrypted with AES-256-GCM)
CREATE TABLE IF NOT EXISTS zahraa_credentials (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    national_id_enc TEXT NOT NULL,
    national_id_iv TEXT NOT NULL,
    national_id_tag TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    password_iv TEXT NOT NULL,
    password_tag TEXT NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PUSH_SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);

-- 4. BOOKING_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('asked', 'booked', 'skipped', 'failed', 'expired', 'no_meals', 'already_booked')) DEFAULT 'asked',
    chosen_meals TEXT[] DEFAULT '{}',
    available_meals JSONB DEFAULT '[]'::jsonb,
    token_hash TEXT,
    token_expires_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    result_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_target_date UNIQUE (user_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_req_token_hash ON booking_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_booking_req_status_date ON booking_requests(status, target_date);
CREATE INDEX IF NOT EXISTS idx_booking_req_user_date ON booking_requests(user_id, target_date);

-- 5. ADMIN_EVENTS TABLE
CREATE TABLE IF NOT EXISTS admin_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. TRIGGER FUNCTION FOR UPDATED_AT
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_zahraa_credentials_updated_at ON zahraa_credentials;
CREATE TRIGGER trg_zahraa_credentials_updated_at
    BEFORE UPDATE ON zahraa_credentials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_booking_requests_updated_at ON booking_requests;
CREATE TRIGGER trg_booking_requests_updated_at
    BEFORE UPDATE ON booking_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
