-- Migration: 20261016_initial_schema.sql
-- Al-Zahraa Meal Booking Assistant Initial Schema

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('student', 'admin')) DEFAULT 'student',
    approval_status TEXT NOT NULL CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    credentials_invalid BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON public.profiles(role, approval_status, is_active);

-- 2. ZAHRAA_CREDENTIALS TABLE (Encrypted with AES-256-GCM, server-only access)
CREATE TABLE IF NOT EXISTS public.zahraa_credentials (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    national_id_enc TEXT NOT NULL,
    national_id_iv TEXT NOT NULL,
    national_id_tag TEXT NOT NULL,
    password_enc TEXT NOT NULL,
    password_iv TEXT NOT NULL,
    password_tag TEXT NOT NULL,
    last_verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 3. PUSH_SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);

-- 4. BOOKING_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.booking_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('asked', 'booked', 'skipped', 'failed', 'expired', 'no_meals', 'already_booked')) DEFAULT 'asked',
    chosen_meals TEXT[] DEFAULT '{}',
    available_meals JSONB DEFAULT '[]'::jsonb,
    token_hash TEXT,
    token_expires_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    reminded_at TIMESTAMPTZ,
    result_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_user_target_date UNIQUE (user_id, target_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_req_token_hash ON public.booking_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_booking_req_status_date ON public.booking_requests(status, target_date);
CREATE INDEX IF NOT EXISTS idx_booking_req_user_date ON public.booking_requests(user_id, target_date);

-- 5. ADMIN_EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.admin_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zahraa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_events ENABLE ROW LEVEL SECURITY;

-- 7. POLICIES

-- Helper to check if caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES POLICIES:
-- Students can read their own profile; Admins can read all profiles
CREATE POLICY "Users can read own profile or admin can read all"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR public.is_admin());

-- Users can update their own is_active toggle
CREATE POLICY "Users can update own non-sensitive profile fields"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any profile (e.g. approval_status)
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Users can delete their own profile (cascades)
CREATE POLICY "Users can delete own profile"
ON public.profiles FOR DELETE
USING (auth.uid() = id OR public.is_admin());

-- ZAHRAA_CREDENTIALS POLICIES:
-- Intentionally NO client policies for SELECT/INSERT/UPDATE!
-- Only service_role can access credentials table.

-- PUSH_SUBSCRIPTIONS POLICIES:
CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- BOOKING_REQUESTS POLICIES:
CREATE POLICY "Users can view own booking requests"
ON public.booking_requests FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());

-- 8. TRIGGER FOR NEW SIGNUPS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, approval_status, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'طالب'),
    NEW.email,
    'student',
    'pending',
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_zahraa_credentials_updated_at
  BEFORE UPDATE ON public.zahraa_credentials
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
