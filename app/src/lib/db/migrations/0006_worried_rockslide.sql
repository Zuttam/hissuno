CREATE TABLE "project_skill_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"skill_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_skill_settings_project_skill_idx" UNIQUE("project_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "project_skill_settings" ADD CONSTRAINT "project_skill_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Preserve any explicit "off" toggles from the legacy issue_analysis_enabled
-- column. Default for the new generic table is enabled (no row); only
-- opted-out projects need rows.
INSERT INTO "project_skill_settings" ("project_id", "skill_id", "enabled")
SELECT "project_id", 'hissuno-issue-analysis', false
FROM "project_settings"
WHERE "issue_analysis_enabled" = false;--> statement-breakpoint
-- Same migration for any explicitly-disabled custom skills.
INSERT INTO "project_skill_settings" ("project_id", "skill_id", "enabled")
SELECT "project_id", "skill_id", false
FROM "custom_skills"
WHERE "enabled" = false;--> statement-breakpoint
ALTER TABLE "custom_skills" DROP COLUMN "enabled";--> statement-breakpoint
ALTER TABLE "project_settings" DROP COLUMN "issue_analysis_enabled";