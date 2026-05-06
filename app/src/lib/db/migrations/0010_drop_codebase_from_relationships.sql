DELETE FROM "entity_relationships" WHERE "codebase_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "entity_relationships" DROP COLUMN IF EXISTS "codebase_id";
