-- Backfill any NULL is_demo values and add NOT NULL constraint
UPDATE projects SET is_demo = false WHERE is_demo IS NULL;
ALTER TABLE projects ALTER COLUMN is_demo SET NOT NULL;
