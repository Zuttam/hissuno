-- Table to store GitHub OAuth tokens for API access
-- Supabase doesn't persist provider tokens, so we capture them at callback time
CREATE TABLE public.user_github_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  github_username text,
  github_user_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Add index for faster lookups by user_id
CREATE INDEX idx_user_github_tokens_user_id ON public.user_github_tokens(user_id);

-- RLS policies
ALTER TABLE public.user_github_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tokens" ON public.user_github_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON public.user_github_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.user_github_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.user_github_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_github_tokens_updated
  BEFORE UPDATE ON public.user_github_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
