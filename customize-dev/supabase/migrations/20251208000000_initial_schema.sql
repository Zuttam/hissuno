-- Initial schema for Customize project
-- Tables: source_codes, projects

-- Enable moddatetime extension for updated_at triggers
CREATE EXTENSION IF NOT EXISTS moddatetime WITH SCHEMA extensions;

-- Source codes table: stores uploaded or linked source code references
CREATE TABLE IF NOT EXISTS public.source_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  description text,
  kind text CHECK (kind IN ('path', 'upload')),
  storage_uri text,
  repository_url text,
  repository_branch text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.source_codes OWNER TO postgres;

COMMENT ON TABLE public.source_codes IS 'Stored source code references that can be shared across projects.';
COMMENT ON COLUMN public.source_codes.storage_uri IS 'Remote or logical pointer to the uploaded code (e.g. S3 URI or absolute path).';

CREATE INDEX IF NOT EXISTS source_codes_user_id_idx ON public.source_codes (user_id);

CREATE TRIGGER handle_source_codes_updated_at
  BEFORE UPDATE ON public.source_codes
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Projects table: developer-uploaded projects for the developer studio
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source_code_id uuid REFERENCES public.source_codes(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.projects OWNER TO postgres;

COMMENT ON TABLE public.projects IS 'Developer-uploaded projects tracked by the Customize developer studio.';

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON public.projects (user_id);

CREATE TRIGGER handle_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);







