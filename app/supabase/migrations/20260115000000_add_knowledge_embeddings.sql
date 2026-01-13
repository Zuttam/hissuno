-- Knowledge embeddings table for semantic search
-- Uses pgvector extension (already enabled in extensions schema)

CREATE TABLE IF NOT EXISTS public.knowledge_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.knowledge_packages(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('business', 'product', 'technical', 'faq', 'how_to')),

  -- Chunk metadata
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  chunk_start_line integer,
  chunk_end_line integer,

  -- Heading context for better retrieval
  section_heading text,
  parent_headings text[] DEFAULT '{}',

  -- Vector embedding (1536 dimensions for text-embedding-3-small)
  embedding extensions.vector(1536) NOT NULL,

  -- Metadata
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Ensure unique chunks per package version
  UNIQUE (package_id, chunk_index, version)
);

ALTER TABLE public.knowledge_embeddings OWNER TO postgres;

COMMENT ON TABLE public.knowledge_embeddings IS 'Vector embeddings for semantic search across knowledge packages.';
COMMENT ON COLUMN public.knowledge_embeddings.chunk_text IS 'The text content of this chunk.';
COMMENT ON COLUMN public.knowledge_embeddings.section_heading IS 'The nearest heading above this chunk.';
COMMENT ON COLUMN public.knowledge_embeddings.parent_headings IS 'Hierarchical heading context (h1 > h2 > h3).';
COMMENT ON COLUMN public.knowledge_embeddings.embedding IS 'OpenAI text-embedding-3-small vector (1536d).';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS knowledge_embeddings_project_id_idx
  ON public.knowledge_embeddings (project_id);

CREATE INDEX IF NOT EXISTS knowledge_embeddings_package_id_idx
  ON public.knowledge_embeddings (package_id);

CREATE INDEX IF NOT EXISTS knowledge_embeddings_category_idx
  ON public.knowledge_embeddings (category);

-- HNSW index for fast approximate nearest neighbor search
-- Using cosine distance (best for normalized OpenAI embeddings)
CREATE INDEX IF NOT EXISTS knowledge_embeddings_embedding_idx
  ON public.knowledge_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER handle_knowledge_embeddings_updated_at
  BEFORE UPDATE ON public.knowledge_embeddings
  FOR EACH ROW
  EXECUTE PROCEDURE extensions.moddatetime(updated_at);

-- Enable Row Level Security
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (same pattern as knowledge_packages)
CREATE POLICY "Users can view embeddings for their projects"
  ON public.knowledge_embeddings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_embeddings.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert embeddings for their projects"
  ON public.knowledge_embeddings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_embeddings.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update embeddings for their projects"
  ON public.knowledge_embeddings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_embeddings.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete embeddings for their projects"
  ON public.knowledge_embeddings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = knowledge_embeddings.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Service role policy for backend operations
CREATE POLICY "Service role has full access to embeddings"
  ON public.knowledge_embeddings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function for semantic search
CREATE OR REPLACE FUNCTION public.search_knowledge_embeddings(
  p_project_id uuid,
  p_query_embedding extensions.vector(1536),
  p_categories text[] DEFAULT NULL,
  p_limit integer DEFAULT 5,
  p_similarity_threshold float DEFAULT 0.0  -- App always passes threshold, this is just a fallback
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
    AND (p_categories IS NULL OR ke.category = ANY(p_categories))
    AND (1 - (ke.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY ke.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.search_knowledge_embeddings IS 'Semantic search across knowledge embeddings using cosine similarity.';
