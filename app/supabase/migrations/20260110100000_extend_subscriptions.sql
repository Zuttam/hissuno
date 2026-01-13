-- Migration: Extend subscriptions table for metered dimensions
-- This migration adds plan metadata columns to subscriptions table
-- so we can track user-specific limits that can differ from plan defaults

-- Step 1: Drop the foreign key constraint to plans table
-- (plans data now comes from Lemon Squeezy API)
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_plan_id_fkey;

-- Step 2: Change plan_id column type to text (stores LS variant ID)
ALTER TABLE public.subscriptions
ALTER COLUMN plan_id TYPE text USING plan_id::text;

-- Step 3: Add new columns for metered dimensions and plan info
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS plan_name text;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS sessions_limit integer;

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS projects_limit integer;

-- Step 4: Add comments explaining the columns
COMMENT ON COLUMN public.subscriptions.plan_id IS
  'Lemon Squeezy variant ID. Plans are now fetched from LS API with caching.';

COMMENT ON COLUMN public.subscriptions.plan_name IS
  'Internal plan name (basic, pro, unlimited). Denormalized from plan for convenience.';

COMMENT ON COLUMN public.subscriptions.sessions_limit IS
  'Per-user session limit (from plan, can be overridden). NULL = unlimited.';

COMMENT ON COLUMN public.subscriptions.projects_limit IS
  'Per-user project limit (from plan, can be overridden). NULL = unlimited.';
