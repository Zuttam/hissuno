-- Add FAQ and How-To knowledge package categories
-- Extends the knowledge_packages table to support 5 categories:
-- business, product, technical, faq, how_to

-- Drop the existing check constraint
ALTER TABLE knowledge_packages DROP CONSTRAINT IF EXISTS knowledge_packages_category_check;

-- Add new check constraint with all 5 categories
ALTER TABLE knowledge_packages ADD CONSTRAINT knowledge_packages_category_check
  CHECK (category IN ('business', 'product', 'technical', 'faq', 'how_to'));
