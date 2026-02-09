-- Security hardening: Fix function permissions and SECURITY DEFINER risks
-- See Design Log #002 for full audit details
--
-- Fixes:
--   1. Set default privileges to prevent future functions from being callable by public/anon
--   2. Revoke EXECUTE on all custom functions from PUBLIC/anon/authenticated
--   3. Switch search functions from SECURITY DEFINER to SECURITY INVOKER

-- ============================================================================
-- 1. DEFAULT PRIVILEGES
-- ============================================================================

-- Prevent future functions from being auto-executable by PUBLIC.
-- New functions must explicitly GRANT to the roles that need them.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- 2. REVOKE EXECUTE ON TRIGGER/UTILITY FUNCTIONS
-- ============================================================================

-- These functions are only used by triggers or internal policies.
-- They should never be callable via PostgREST /rpc/ endpoint.

REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_project_key(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_project_key(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_project_key(text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.auto_generate_project_keys() FROM PUBLIC, anon, authenticated;

-- check_waitlist_rate_limit: only used inside the waitlist INSERT policy.
-- Policies run as the table owner, so this function works without explicit grants.
REVOKE EXECUTE ON FUNCTION public.check_waitlist_rate_limit(text) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 3. SWITCH SEARCH FUNCTIONS TO SECURITY INVOKER
-- ============================================================================

-- CRITICAL FIX: Both search functions previously used SECURITY DEFINER,
-- which bypasses RLS entirely. Any caller could query ANY project's data
-- by passing an arbitrary project_id.
--
-- Switching to SECURITY INVOKER means:
--   - RLS policies are enforced on the calling user
--   - Authenticated users can only search their own projects (via existing RLS)
--   - service_role callers still bypass RLS (Supabase default), so backend is unaffected

-- -- search_knowledge_embeddings --

DROP FUNCTION IF EXISTS public.search_knowledge_embeddings(uuid, extensions.vector, uuid, text[], integer, float);

CREATE OR REPLACE FUNCTION public.search_knowledge_embeddings(
  p_project_id uuid,
  p_query_embedding extensions.vector(1536),
  p_named_package_id uuid DEFAULT NULL,
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
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.search_knowledge_embeddings FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_knowledge_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_knowledge_embeddings TO service_role;

-- -- search_similar_issues --

DROP FUNCTION IF EXISTS public.search_similar_issues(uuid, extensions.vector, text, integer, float, uuid, boolean);

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
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.search_similar_issues FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_similar_issues TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_issues TO service_role;
