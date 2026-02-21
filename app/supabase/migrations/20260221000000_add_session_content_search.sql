-- Full-text search index on session_messages.content
CREATE INDEX IF NOT EXISTS session_messages_content_fts_idx
  ON public.session_messages
  USING gin (to_tsvector('english', content));

-- RPC function: search sessions by message content using full-text search
CREATE OR REPLACE FUNCTION public.search_sessions_by_content(
  p_project_id uuid,
  p_query text,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  session_id text,
  rank real,
  match_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    sm.session_id,
    max(ts_rank(to_tsvector('english', sm.content), websearch_to_tsquery('english', p_query))) AS rank,
    count(*) AS match_count
  FROM public.session_messages sm
  WHERE sm.project_id = p_project_id
    AND to_tsvector('english', sm.content) @@ websearch_to_tsquery('english', p_query)
  GROUP BY sm.session_id
  ORDER BY rank DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- Grant access to authenticated and service_role only
GRANT EXECUTE ON FUNCTION public.search_sessions_by_content(uuid, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_sessions_by_content(uuid, text, int, int) TO service_role;
