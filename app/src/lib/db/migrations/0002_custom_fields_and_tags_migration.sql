-- 1. Add custom_fields column to knowledge_sources
ALTER TABLE "knowledge_sources" ADD COLUMN IF NOT EXISTS "custom_fields" jsonb;

-- 2. For each project that has custom_tags, create a multi_select custom field definition for sessions
-- This converts the custom_tags vocabulary into select_options on a multi_select field
INSERT INTO "customer_custom_field_definitions" (
  "project_id", "entity_type", "field_key", "field_label", "field_type", "select_options", "position"
)
SELECT
  ct.project_id,
  'session',
  'tags',
  'Tags',
  'multi_select',
  array_agg(ct.slug ORDER BY ct.position),
  0
FROM "custom_tags" ct
GROUP BY ct.project_id
ON CONFLICT DO NOTHING;

-- 3. Move custom tag slugs from sessions.tags into sessions.custom_fields
-- Only moves non-native tags (native tags stay in sessions.tags)
-- Native tags: general_feedback, wins, losses, bug, feature_request, change_request
WITH native_tags AS (
  SELECT unnest(ARRAY['general_feedback', 'wins', 'losses', 'bug', 'feature_request', 'change_request']) AS tag
),
sessions_with_custom_tags AS (
  SELECT
    s.id,
    s.tags,
    s.custom_fields,
    array_agg(t.tag) FILTER (WHERE t.tag IS NOT NULL) AS custom_tag_values,
    array_agg(t.tag) FILTER (WHERE nt.tag IS NOT NULL) AS native_tag_values
  FROM "sessions" s
  CROSS JOIN LATERAL unnest(s.tags) AS t(tag)
  LEFT JOIN native_tags nt ON nt.tag = t.tag
  WHERE s.tags IS NOT NULL AND array_length(s.tags, 1) > 0
  GROUP BY s.id, s.tags, s.custom_fields
  HAVING bool_or(nt.tag IS NULL) -- at least one non-native tag
)
UPDATE "sessions" s
SET
  tags = swct.native_tag_values,
  custom_fields = COALESCE(s.custom_fields, '{}'::jsonb) || jsonb_build_object(
    'tags',
    (SELECT jsonb_agg(val) FROM unnest(
      array(SELECT unnest(swct.tags) EXCEPT SELECT unnest(swct.native_tag_values))
    ) AS val)
  )
FROM sessions_with_custom_tags swct
WHERE s.id = swct.id;

-- 4. Drop custom_tags table
DROP TABLE IF EXISTS "custom_tags";
