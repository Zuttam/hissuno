-- Create invites table for invite-only signup system
-- Invites are manually created by admin in the database
CREATE TABLE public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,              -- 8-char alphanumeric code
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  expires_at timestamptz,                 -- null = no expiry
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create promotions table for earned rewards
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id uuid NOT NULL REFERENCES public.invites(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('referral_credit', 'discount_percent', 'free_month')),
  value integer NOT NULL,                 -- cents for credit, percent for discount
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'claimed', 'expired')),
  eligible_at timestamptz,
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_invites_owner_user_id ON public.invites(owner_user_id);
CREATE INDEX idx_invites_code ON public.invites(code);
CREATE INDEX idx_invites_claimed_by_user_id ON public.invites(claimed_by_user_id);
CREATE INDEX idx_promotions_user_id ON public.promotions(user_id);
CREATE INDEX idx_promotions_invite_id ON public.promotions(invite_id);
CREATE INDEX idx_promotions_status ON public.promotions(status);

-- Enable RLS on invites table
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Users can read their own invites (where they are the owner)
CREATE POLICY "Users can read own invites"
  ON public.invites FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- Enable RLS on promotions table
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Users can read their own promotions
CREATE POLICY "Users can read own promotions"
  ON public.promotions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
