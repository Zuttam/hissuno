-- Migration: Remove is_over_limit column from sessions table
--
-- This migration removes the is_over_limit column that was used for soft enforcement
-- of session limits at creation time. Limits are now enforced at analysis time
-- (PM review) instead, so this column is no longer needed.
--
-- The analyzed sessions count is now calculated by counting sessions where
-- pm_reviewed_at IS NOT NULL, rather than checking is_over_limit at creation.

ALTER TABLE public.sessions DROP COLUMN IF EXISTS is_over_limit;
