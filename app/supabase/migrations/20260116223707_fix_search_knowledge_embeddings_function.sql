-- Fix search_knowledge_embeddings function to include extensions schema in search_path
-- This resolves the "operator does not exist: extensions.vector <=> extensions.vector" error

DROP FUNCTION IF EXISTS public.search_knowledge_embeddings;

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
