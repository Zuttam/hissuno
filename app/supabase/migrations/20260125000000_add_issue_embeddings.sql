-- Issue embeddings for semantic deduplication
-- Uses pgvector (already enabled) for similarity search

-- Add pm_dedup_include_closed setting to project_settings
ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS pm_dedup_include_closed boolean DEFAULT false;

-- Create issue_embeddings table
CREATE TABLE IF NOT EXISTS public.issue_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Combined embedding of title + description (OpenAI text-embedding-3-small)
  embedding extensions.vector(1536) NOT NULL,

  -- MD5 hash of title+description for change detection
  text_hash text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS issue_embeddings_embedding_idx
  ON public.issue_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS issue_embeddings_project_id_idx
  ON public.issue_embeddings (project_id);

CREATE INDEX IF NOT EXISTS issue_embeddings_issue_id_idx
  ON public.issue_embeddings (issue_id);

-- Enable RLS
ALTER TABLE public.issue_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies (match issues table pattern)
CREATE POLICY "Users can view issue embeddings for their projects"
  ON public.issue_embeddings
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert issue embeddings for their projects"
  ON public.issue_embeddings
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update issue embeddings for their projects"
  ON public.issue_embeddings
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete issue embeddings for their projects"
  ON public.issue_embeddings
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE user_id = auth.uid()
    )
  );

-- Service role bypass for backend operations
CREATE POLICY "Service role can manage all issue embeddings"
  ON public.issue_embeddings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Semantic search function for issue deduplication
CREATE OR REPLACE FUNCTION public.search_similar_issues(
  p_project_id uuid,
  p_query_embedding extensions.vector(1536),
  p_issue_type text DEFAULT NULL,
  p_limit integer DEFAULT 5,
  p_similarity_threshold float DEFAULT 0.7,
  p_exclude_issue_id uuid DEFAULT NULL,
  p_include_closed boolean DEFAULT FALSE
)
RETURNS TABLE (
  issue_id uuid,
  title text,
  description text,
  type text,
  status text,
  upvote_count integer,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id as issue_id,
    i.title,
    i.description,
    i.type,
    i.status,
    i.upvote_count,
    (1 - (ie.embedding <=> p_query_embedding))::float as similarity
  FROM public.issues i
  JOIN public.issue_embeddings ie ON ie.issue_id = i.id
  WHERE i.project_id = p_project_id
    AND i.is_archived = false
    AND (
      i.status IN ('open', 'in_progress', 'ready')
      OR (p_include_closed AND i.status IN ('resolved', 'closed'))
    )
    AND (p_issue_type IS NULL OR i.type = p_issue_type)
    AND (p_exclude_issue_id IS NULL OR i.id != p_exclude_issue_id)
    AND (1 - (ie.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY ie.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION public.search_similar_issues TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_issues TO service_role;
