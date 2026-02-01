-- Named Knowledge Packages: Support multiple named knowledge packages per project
-- Each package connects to specific sources and can be attached to the support agent

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Named knowledge packages (user-created packages)
CREATE TABLE IF NOT EXISTS public.named_knowledge_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  guidelines text,  -- Custom analysis guidelines
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (project_id, name)
);

ALTER TABLE public.named_knowledge_packages OWNER TO postgres;

COMMENT ON TABLE public.named_knowledge_packages IS 'User-created knowledge packages that group sources together for analysis.';
COMMENT ON COLUMN public.named_knowledge_packages.name IS 'Unique name for the package within the project.';
COMMENT ON COLUMN public.named_knowledge_packages.description IS 'Optional description of what this package contains.';
COMMENT ON COLUMN public.named_knowledge_packages.guidelines IS 'Optional custom guidelines for knowledge analysis.';

CREATE INDEX IF NOT EXISTS named_knowledge_packages_project_id_idx ON public.named_knowledge_packages (project_id);

CREATE TRIGGER handle_named_knowledge_packages_updated_at
  BEFORE UPDATE ON public.named_knowledge_packages
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Junction table: packages <-> sources (many-to-many)
CREATE TABLE IF NOT EXISTS public.named_package_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.named_knowledge_packages(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (package_id, source_id)
);

ALTER TABLE public.named_package_sources OWNER TO postgres;

COMMENT ON TABLE public.named_package_sources IS 'Links named knowledge packages to their source materials.';

CREATE INDEX IF NOT EXISTS named_package_sources_package_id_idx ON public.named_package_sources (package_id);
CREATE INDEX IF NOT EXISTS named_package_sources_source_id_idx ON public.named_package_sources (source_id);

-- ============================================================================
-- SCHEMA MODIFICATIONS
-- ============================================================================

-- Add named_package_id to knowledge_packages (nullable for migration)
ALTER TABLE public.knowledge_packages
  ADD COLUMN IF NOT EXISTS named_package_id uuid REFERENCES public.named_knowledge_packages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS knowledge_packages_named_package_id_idx ON public.knowledge_packages (named_package_id);

-- Add named_package_id to knowledge_embeddings
ALTER TABLE public.knowledge_embeddings
  ADD COLUMN IF NOT EXISTS named_package_id uuid REFERENCES public.named_knowledge_packages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS knowledge_embeddings_named_package_id_idx ON public.knowledge_embeddings (named_package_id);

-- Store selected package in project_settings
ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS support_agent_package_id uuid REFERENCES public.named_knowledge_packages(id) ON DELETE SET NULL;

-- ============================================================================
-- DATA MIGRATION
-- ============================================================================

-- Create "Default" package for each project that has knowledge
INSERT INTO public.named_knowledge_packages (project_id, name, description)
SELECT DISTINCT project_id, 'Default', 'Auto-migrated knowledge package'
FROM public.knowledge_packages
ON CONFLICT (project_id, name) DO NOTHING;

-- Link existing sources to Default package
INSERT INTO public.named_package_sources (package_id, source_id)
SELECT np.id, ks.id
FROM public.named_knowledge_packages np
JOIN public.knowledge_sources ks ON ks.project_id = np.project_id
WHERE np.name = 'Default'
  AND ks.enabled = true
ON CONFLICT (package_id, source_id) DO NOTHING;

-- Update existing knowledge_packages with named_package_id
UPDATE public.knowledge_packages kp
SET named_package_id = np.id
FROM public.named_knowledge_packages np
WHERE kp.project_id = np.project_id
  AND np.name = 'Default'
  AND kp.named_package_id IS NULL;

-- Update existing embeddings with named_package_id
UPDATE public.knowledge_embeddings ke
SET named_package_id = kp.named_package_id
FROM public.knowledge_packages kp
WHERE ke.package_id = kp.id
  AND ke.named_package_id IS NULL
  AND kp.named_package_id IS NOT NULL;

-- Set default package in project_settings for projects that have a Default package
INSERT INTO public.project_settings (project_id, support_agent_package_id)
SELECT np.project_id, np.id
FROM public.named_knowledge_packages np
WHERE np.name = 'Default'
ON CONFLICT (project_id) DO UPDATE
SET support_agent_package_id = EXCLUDED.support_agent_package_id
WHERE public.project_settings.support_agent_package_id IS NULL;

-- ============================================================================
-- UPDATED SEARCH FUNCTION
-- ============================================================================

-- Drop and recreate the search function with named_package_id parameter
DROP FUNCTION IF EXISTS public.search_knowledge_embeddings(uuid, extensions.vector(1536), text[], integer, float);

CREATE OR REPLACE FUNCTION public.search_knowledge_embeddings(
  p_project_id uuid,
  p_query_embedding extensions.vector(1536),
  p_named_package_id uuid DEFAULT NULL,  -- NEW: filter by named package
  p_categories text[] DEFAULT NULL,
  p_limit integer DEFAULT 5,
  p_similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  category text,
  chunk_text text,
  section_heading text,
  parent_headings text[],
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.category,
    ke.chunk_text,
    ke.section_heading,
    ke.parent_headings,
    (1 - (ke.embedding <=> p_query_embedding))::float as similarity
  FROM public.knowledge_embeddings ke
  WHERE ke.project_id = p_project_id
    AND (p_named_package_id IS NULL OR ke.named_package_id = p_named_package_id)
    AND (p_categories IS NULL OR ke.category = ANY(p_categories))
    AND (1 - (ke.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.search_knowledge_embeddings IS 'Semantic search across knowledge embeddings using cosine similarity, with optional package filtering.';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.named_knowledge_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.named_package_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for named_knowledge_packages
CREATE POLICY "Users can view named packages for their projects"
  ON public.named_knowledge_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = named_knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert named packages for their projects"
  ON public.named_knowledge_packages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = named_knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update named packages for their projects"
  ON public.named_knowledge_packages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = named_knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete named packages for their projects"
  ON public.named_knowledge_packages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = named_knowledge_packages.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Service role policy for named_knowledge_packages
CREATE POLICY "Service role has full access to named packages"
  ON public.named_knowledge_packages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for named_package_sources (through package ownership)
CREATE POLICY "Users can view package sources for their projects"
  ON public.named_package_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.named_knowledge_packages np
      JOIN public.projects p ON p.id = np.project_id
      WHERE np.id = named_package_sources.package_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert package sources for their projects"
  ON public.named_package_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.named_knowledge_packages np
      JOIN public.projects p ON p.id = np.project_id
      WHERE np.id = named_package_sources.package_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update package sources for their projects"
  ON public.named_package_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.named_knowledge_packages np
      JOIN public.projects p ON p.id = np.project_id
      WHERE np.id = named_package_sources.package_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete package sources for their projects"
  ON public.named_package_sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.named_knowledge_packages np
      JOIN public.projects p ON p.id = np.project_id
      WHERE np.id = named_package_sources.package_id
      AND p.user_id = auth.uid()
    )
  );

-- Service role policy for named_package_sources
CREATE POLICY "Service role has full access to package sources"
  ON public.named_package_sources FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
