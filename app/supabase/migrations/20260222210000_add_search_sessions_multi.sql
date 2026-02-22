CREATE OR REPLACE FUNCTION public.search_sessions_multi(
  p_project_id uuid,
  p_query text,
  p_query_like text,
  p_status text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_session_type text DEFAULT NULL,
  p_is_human_takeover boolean DEFAULT NULL,
  p_is_archived boolean DEFAULT FALSE,
  p_is_analyzed boolean DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_contact_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (session_id text, total_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  WITH search_matches AS (
    -- Message content (full-text search)
    SELECT DISTINCT sm.session_id
    FROM public.session_messages sm
    WHERE sm.project_id = p_project_id
      AND to_tsvector('english', sm.content) @@ websearch_to_tsquery('english', p_query)
    UNION
    -- Session name (ILIKE)
    SELECT s.id FROM public.sessions s
    WHERE s.project_id = p_project_id
      AND s.name ILIKE '%' || p_query_like || '%'
    UNION
    -- Contact name (ILIKE via join)
    SELECT s.id FROM public.sessions s
    INNER JOIN public.contacts c ON c.id = s.contact_id
    WHERE s.project_id = p_project_id
      AND c.name ILIKE '%' || p_query_like || '%'
  ),
  filtered AS (
    SELECT s.id, s.last_activity_at
    FROM public.sessions s
    INNER JOIN search_matches m ON m.session_id = s.id
    WHERE s.project_id = p_project_id
      AND s.is_archived = COALESCE(p_is_archived, FALSE)
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_source IS NULL OR s.source = p_source)
      AND (p_session_type IS NULL OR s.session_type = p_session_type)
      AND (p_is_human_takeover IS NULL OR s.is_human_takeover = p_is_human_takeover)
      AND (p_is_analyzed IS NULL OR s.pm_reviewed_at IS NOT NULL)
      AND (p_tags IS NULL OR s.tags && p_tags)
      AND (p_date_from IS NULL OR s.created_at >= p_date_from)
      AND (p_date_to IS NULL OR s.created_at <= p_date_to)
      AND (p_contact_id IS NULL OR s.contact_id = p_contact_id)
      AND (p_company_id IS NULL OR s.contact_id IN (
        SELECT c.id FROM public.contacts c WHERE c.company_id = p_company_id
      ))
  )
  SELECT f.id AS session_id, count(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.last_activity_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_sessions_multi TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_sessions_multi TO service_role;
