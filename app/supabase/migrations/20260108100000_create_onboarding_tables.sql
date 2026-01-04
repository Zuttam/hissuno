-- Create onboarding tables: user_profiles, plans, subscriptions
-- Migration for onboarding flow with Lemon Squeezy billing integration

-- User profiles table: stores onboarding profile information
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name text,
  company_name text,
  role text,
  company_size text CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '500+')),
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_profiles OWNER TO postgres;

COMMENT ON TABLE public.user_profiles IS 'User profile information collected during onboarding.';
COMMENT ON COLUMN public.user_profiles.onboarding_completed IS 'Whether the user has completed the onboarding flow.';

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON public.user_profiles (user_id);

CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Plans table: subscription plan definitions
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('basic', 'pro', 'unlimited')),
  display_name text NOT NULL,
  lemon_squeezy_variant_id text NOT NULL,
  price_cents integer NOT NULL,
  sessions_limit integer, -- null = unlimited
  features jsonb NOT NULL DEFAULT '[]',
  is_recommended boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.plans OWNER TO postgres;

COMMENT ON TABLE public.plans IS 'Available subscription plans with Lemon Squeezy integration.';
COMMENT ON COLUMN public.plans.sessions_limit IS 'Maximum sessions allowed per month. NULL means unlimited.';

-- Subscriptions table: user subscription records
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  lemon_squeezy_subscription_id text UNIQUE,
  lemon_squeezy_customer_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'on_trial', 'paused')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.subscriptions OWNER TO postgres;

COMMENT ON TABLE public.subscriptions IS 'User subscription records linked to Lemon Squeezy.';

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);

CREATE TRIGGER handle_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS policies for plans (read-only for all authenticated users)
CREATE POLICY "Anyone can view plans"
  ON public.plans FOR SELECT
  TO authenticated
  USING (true);

-- RLS policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Seed default plans
INSERT INTO public.plans (name, display_name, lemon_squeezy_variant_id, price_cents, sessions_limit, features, is_recommended, sort_order) VALUES
  ('basic', 'Basic', 'PLACEHOLDER_BASIC_VARIANT', 0, 100, '["100 sessions/month", "1 project", "Community support"]'::jsonb, false, 1),
  ('pro', 'Pro', 'PLACEHOLDER_PRO_VARIANT', 2900, 1000, '["1,000 sessions/month", "5 projects", "Priority support", "Custom branding"]'::jsonb, true, 2),
  ('unlimited', 'Unlimited', 'PLACEHOLDER_UNLIMITED_VARIANT', 9900, NULL, '["Unlimited sessions", "Unlimited projects", "Dedicated support", "Custom integrations", "SLA guarantee"]'::jsonb, false, 3)
ON CONFLICT (name) DO NOTHING;
