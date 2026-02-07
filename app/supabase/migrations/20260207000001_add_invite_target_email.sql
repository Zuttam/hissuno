-- Add target_email column to invites table
-- Allows associating invite codes with the waitlist email they're intended for
ALTER TABLE public.invites ADD COLUMN target_email text;
CREATE INDEX idx_invites_target_email ON public.invites(target_email);
