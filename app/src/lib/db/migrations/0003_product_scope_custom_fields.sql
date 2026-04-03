-- Add custom_fields column to product_scopes table
ALTER TABLE product_scopes ADD COLUMN IF NOT EXISTS custom_fields jsonb;
