ALTER TABLE public.intercom_connections
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'token'
  CHECK (auth_method IN ('token', 'oauth'));
