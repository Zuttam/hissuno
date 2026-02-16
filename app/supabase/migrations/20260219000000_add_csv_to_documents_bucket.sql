-- Add text/csv to documents bucket allowed MIME types for CSV import uploads
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'text/csv')
WHERE id = 'documents'
  AND NOT ('text/csv' = ANY(allowed_mime_types));
