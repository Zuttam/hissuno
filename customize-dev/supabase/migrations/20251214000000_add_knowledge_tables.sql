-- Knowledge package tables for support agent
-- Tables: knowledge_sources, knowledge_packages

-- Knowledge sources table: stores raw material inputs for analysis
CREATE TABLE IF NOT EXISTS public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('website', 'docs_portal', 'uploaded_doc', 'raw_text')),
  url text,
  storage_path text,
  content text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.knowledge_sources OWNER TO postgres;

COMMENT ON TABLE public.knowledge_sources IS 'Raw material inputs for knowledge analysis (websites, docs, uploaded files, etc.).';
COMMENT ON COLUMN public.knowledge_sources.type IS 'Type of knowledge source: website, docs_portal, uploaded_doc, or raw_text.';
COMMENT ON COLUMN public.knowledge_sources.url IS 'URL for website or docs_portal sources.';
COMMENT ON COLUMN public.knowledge_sources.storage_path IS 'Supabase Storage path for uploaded documents.';
COMMENT ON COLUMN public.knowledge_sources.content IS 'Raw text content for raw_text sources.';
COMMENT ON COLUMN public.knowledge_sources.status IS 'Processing status: pending, processing, completed, or failed.';
COMMENT ON COLUMN public.knowledge_sources.error_message IS 'Error message if analysis failed.';
COMMENT ON COLUMN public.knowledge_sources.analyzed_at IS 'Timestamp when analysis was last completed.';

CREATE INDEX IF NOT EXISTS knowledge_sources_project_id_idx ON public.knowledge_sources (project_id);
CREATE INDEX IF NOT EXISTS knowledge_sources_status_idx ON public.knowledge_sources (status);

CREATE TRIGGER handle_knowledge_sources_updated_at
  BEFORE UPDATE ON public.knowledge_sources
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Knowledge packages table: stores compiled knowledge output
CREATE TABLE IF NOT EXISTS public.knowledge_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('business', 'product', 'technical')),
  storage_path text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  generated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (project_id, category)
);

ALTER TABLE public.knowledge_packages OWNER TO postgres;

COMMENT ON TABLE public.knowledge_packages IS 'Compiled knowledge packages organized by category (business, product, technical).';
COMMENT ON COLUMN public.knowledge_packages.category IS 'Knowledge category: business, product, or technical.';
COMMENT ON COLUMN public.knowledge_packages.storage_path IS 'Supabase Storage path to the compiled markdown file.';
COMMENT ON COLUMN public.knowledge_packages.version IS 'Version number, incremented on each re-analysis.';
COMMENT ON COLUMN public.knowledge_packages.generated_at IS 'Timestamp when this version was generated.';

CREATE INDEX IF NOT EXISTS knowledge_packages_project_id_idx ON public.knowledge_packages (project_id);

CREATE TRIGGER handle_knowledge_packages_updated_at
  BEFORE UPDATE ON public.knowledge_packages
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Enable Row Level Security
ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_packages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for knowledge_sources
CREATE POLICY "Users can view knowledge sources for their projects"
  ON public.knowledge_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge sources for their projects"
  ON public.knowledge_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge sources for their projects"
  ON public.knowledge_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge sources for their projects"
  ON public.knowledge_sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for knowledge_packages
CREATE POLICY "Users can view knowledge packages for their projects"
  ON public.knowledge_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert knowledge packages for their projects"
  ON public.knowledge_packages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update knowledge packages for their projects"
  ON public.knowledge_packages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete knowledge packages for their projects"
  ON public.knowledge_packages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );
