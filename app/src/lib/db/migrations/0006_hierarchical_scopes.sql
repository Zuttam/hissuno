-- Hierarchical scopes: add parent_id, depth, content columns
ALTER TABLE product_scopes ADD COLUMN IF NOT EXISTS parent_id uuid;
ALTER TABLE product_scopes ADD COLUMN IF NOT EXISTS depth integer NOT NULL DEFAULT 0;
ALTER TABLE product_scopes ADD COLUMN IF NOT EXISTS content text;

-- Index for efficient child lookups
CREATE INDEX IF NOT EXISTS idx_product_scopes_parent_id ON product_scopes(parent_id);

-- Full-text search index on content
CREATE INDEX IF NOT EXISTS idx_product_scopes_content_fts
  ON product_scopes USING gin (to_tsvector('english', coalesce(content, '')));
