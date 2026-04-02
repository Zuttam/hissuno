-- Add automation toggle settings to project_settings
ALTER TABLE "project_settings" ADD COLUMN "feedback_analysis_enabled" boolean;
--> statement-breakpoint
ALTER TABLE "project_settings" ADD COLUMN "issue_analysis_enabled" boolean;
--> statement-breakpoint
-- Add base processing tracking to sessions
ALTER TABLE "sessions" ADD COLUMN "base_processed_at" timestamp;
