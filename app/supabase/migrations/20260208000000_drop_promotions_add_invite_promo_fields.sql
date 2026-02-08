-- Drop unused promotions table
DROP TABLE IF EXISTS public.promotions;

-- Add promotion fields to invites
ALTER TABLE public.invites
  ADD COLUMN promotion_code text,
  ADD COLUMN promotion_description text;
