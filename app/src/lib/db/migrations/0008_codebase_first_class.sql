-- Promote codebase to a first-class entity (out from under knowledge_sources)
-- Demote knowledge sources under product_scopes (every source links to a scope)

-- 1. Add new columns to source_codes (nullable for backfill)
ALTER TABLE source_codes ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id);
ALTER TABLE source_codes ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE source_codes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE source_codes ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE source_codes ADD COLUMN IF NOT EXISTS analysis_scope text;

-- 2. Add codebase_id to entity_relationships
ALTER TABLE entity_relationships
  ADD COLUMN IF NOT EXISTS codebase_id uuid
  REFERENCES source_codes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_entity_relationships_codebase_id
  ON entity_relationships(codebase_id);

-- 3. Backfill source_codes from knowledge_sources rows of type='codebase'
UPDATE source_codes sc
SET
  project_id = ks.project_id,
  name = ks.name,
  description = ks.description,
  enabled = COALESCE(ks.enabled, true),
  analysis_scope = ks.analysis_scope
FROM knowledge_sources ks
WHERE ks.source_code_id = sc.id
  AND ks.type = 'codebase'
  AND sc.project_id IS NULL;

-- 4. Rewire entity_relationships rows that link a codebase-type knowledge_source
--    to instead reference the codebase directly
INSERT INTO entity_relationships (project_id, codebase_id, product_scope_id, company_id, contact_id, issue_id, session_id, metadata)
SELECT er.project_id, ks.source_code_id, er.product_scope_id, er.company_id, er.contact_id, er.issue_id, er.session_id, er.metadata
FROM entity_relationships er
JOIN knowledge_sources ks ON ks.id = er.knowledge_source_id
WHERE ks.type = 'codebase' AND ks.source_code_id IS NOT NULL;

DELETE FROM entity_relationships
WHERE knowledge_source_id IN (SELECT id FROM knowledge_sources WHERE type = 'codebase');

-- 5. Delete codebase rows from knowledge_sources (cascade removes embeddings)
DELETE FROM knowledge_embeddings
WHERE source_id IN (SELECT id FROM knowledge_sources WHERE type = 'codebase');

DELETE FROM support_package_sources
WHERE source_id IN (SELECT id FROM knowledge_sources WHERE type = 'codebase');

DELETE FROM knowledge_sources WHERE type = 'codebase';

-- 6. Make source_codes.project_id NOT NULL (after backfill)
ALTER TABLE source_codes ALTER COLUMN project_id SET NOT NULL;

-- 7. Ensure every project has a default product_scope. We use the existing
--    is_default flag; if a project has none, create one.
INSERT INTO product_scopes (project_id, parent_id, name, slug, description, color, position, depth, is_default, type, created_at, updated_at)
SELECT
  p.id,
  NULL,
  'General',
  'general',
  'Default scope for unclassified knowledge sources',
  '#94a3b8',
  0,
  0,
  true,
  'product_area',
  now(),
  now()
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM product_scopes ps
  WHERE ps.project_id = p.id AND ps.is_default = true
);

-- 8. Attach orphan knowledge_sources (no scope link) to their project's default scope
INSERT INTO entity_relationships (project_id, knowledge_source_id, product_scope_id)
SELECT ks.project_id, ks.id, ps.id
FROM knowledge_sources ks
JOIN product_scopes ps ON ps.project_id = ks.project_id AND ps.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM entity_relationships er
  WHERE er.knowledge_source_id = ks.id
    AND er.product_scope_id IS NOT NULL
);

-- 9. Drop source_code_id from knowledge_sources
ALTER TABLE knowledge_sources DROP COLUMN IF EXISTS source_code_id;

-- 10. Rename source_codes -> codebases.
ALTER TABLE source_codes RENAME TO codebases;
CREATE INDEX IF NOT EXISTS idx_codebases_project_id ON codebases(project_id);
