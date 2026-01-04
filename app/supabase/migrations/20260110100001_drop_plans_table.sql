-- Migration: Drop plans table
-- Plans data now comes from Lemon Squeezy API with caching
-- The subscriptions table has been updated to store plan metadata directly

-- Drop the plans table
DROP TABLE IF EXISTS public.plans;
