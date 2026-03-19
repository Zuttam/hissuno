CREATE TABLE "chat_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"metadata" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"industry" text,
	"country" text,
	"employee_count" integer,
	"arr" double precision,
	"stage" text,
	"plan_tier" text,
	"product_used" text,
	"health_score" integer,
	"renewal_date" timestamp,
	"notes" text,
	"custom_fields" jsonb,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compilation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"text_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contact_embeddings_contact_id_unique" UNIQUE("contact_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"title" text,
	"role" text,
	"company_url" text,
	"is_champion" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"last_contacted_at" timestamp,
	"notes" text,
	"custom_fields" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_custom_field_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"field_key" text NOT NULL,
	"field_label" text NOT NULL,
	"field_type" text NOT NULL,
	"is_required" boolean DEFAULT false,
	"select_options" text[],
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entity_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"issue_id" uuid,
	"session_id" uuid,
	"knowledge_source_id" uuid,
	"product_scope_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fathom_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"api_key" text NOT NULL,
	"sync_frequency" text DEFAULT 'manual' NOT NULL,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"filter_config" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_meetings_count" integer,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "fathom_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "fathom_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"triggered_by" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"meetings_found" integer,
	"meetings_synced" integer,
	"meetings_skipped" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fathom_synced_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"fathom_meeting_id" text NOT NULL,
	"session_id" text NOT NULL,
	"meeting_created_at" timestamp,
	"meeting_duration_seconds" integer,
	"messages_count" integer,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "github_app_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"installation_id" integer,
	"account_id" integer NOT NULL,
	"account_login" text NOT NULL,
	"target_type" text,
	"scope" text,
	"auth_method" text DEFAULT 'app' NOT NULL,
	"access_token" text,
	"installed_by_user_id" text,
	"installed_by_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "github_app_installations_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "gong_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"base_url" text DEFAULT 'https://api.gong.io' NOT NULL,
	"access_key" text NOT NULL,
	"access_key_secret" text NOT NULL,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_frequency" text DEFAULT 'manual' NOT NULL,
	"filter_config" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_calls_count" integer,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "gong_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "gong_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"triggered_by" text NOT NULL,
	"calls_found" integer,
	"calls_synced" integer,
	"calls_skipped" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gong_synced_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"gong_call_id" text NOT NULL,
	"call_duration_seconds" integer,
	"call_created_at" timestamp,
	"messages_count" integer,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hubspot_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"hub_id" text NOT NULL,
	"hub_name" text,
	"auth_method" text DEFAULT 'oauth' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_frequency" text DEFAULT 'manual' NOT NULL,
	"filter_config" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_companies_count" integer,
	"last_sync_contacts_count" integer,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hubspot_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "hubspot_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"triggered_by" text NOT NULL,
	"companies_found" integer,
	"companies_synced" integer,
	"companies_skipped" integer,
	"contacts_found" integer,
	"contacts_synced" integer,
	"contacts_skipped" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "hubspot_synced_companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"hubspot_company_id" text NOT NULL,
	"hubspot_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "hubspot_synced_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"hubspot_contact_id" text NOT NULL,
	"hubspot_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "intercom_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text,
	"access_token" text NOT NULL,
	"auth_method" text DEFAULT 'oauth' NOT NULL,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_frequency" text DEFAULT 'manual' NOT NULL,
	"filter_config" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_conversations_count" integer,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "intercom_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "intercom_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"triggered_by" text NOT NULL,
	"conversations_found" integer,
	"conversations_synced" integer,
	"conversations_skipped" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "intercom_synced_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"intercom_conversation_id" text NOT NULL,
	"parts_count" integer,
	"conversation_created_at" timestamp,
	"conversation_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "issue_analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "issue_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"text_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "issue_embeddings_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"upvote_count" integer DEFAULT 0,
	"priority_manual_override" boolean DEFAULT false,
	"reach_score" double precision,
	"reach_reasoning" text,
	"impact_score" double precision,
	"confidence_score" double precision,
	"confidence_reasoning" text,
	"effort_score" double precision,
	"effort_estimate" text,
	"effort_reasoning" text,
	"impact_analysis" jsonb,
	"analysis_computed_at" timestamp,
	"brief" text,
	"brief_generated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jira_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cloud_id" text NOT NULL,
	"site_url" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"auto_sync_enabled" boolean DEFAULT false NOT NULL,
	"jira_project_id" text,
	"jira_project_key" text,
	"issue_type_id" text,
	"issue_type_name" text,
	"webhook_id" text,
	"webhook_secret" text,
	"installed_by_user_id" text,
	"installed_by_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "jira_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "jira_issue_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"jira_issue_id" text,
	"jira_issue_key" text,
	"jira_issue_url" text,
	"last_jira_status" text,
	"last_sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_action" text,
	"last_sync_error" text,
	"last_synced_at" timestamp,
	"last_webhook_received_at" timestamp,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "jira_issue_syncs_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid,
	"chunk_text" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_start_line" integer,
	"chunk_end_line" integer,
	"section_heading" text,
	"parent_headings" text[],
	"embedding" vector(1536) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_package_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"guidelines" text,
	"faq_content" text,
	"howto_content" text,
	"feature_docs_content" text,
	"troubleshooting_content" text,
	"compiled_at" timestamp,
	"source_snapshot" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_code_id" uuid,
	"name" text,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"url" text,
	"content" text,
	"storage_path" text,
	"analyzed_content" text,
	"analysis_scope" text,
	"notion_page_id" text,
	"origin" text,
	"analyzed_at" timestamp,
	"enabled" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "linear_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"organization_name" text NOT NULL,
	"auth_method" text DEFAULT 'oauth' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_expires_at" timestamp,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"auto_sync_enabled" boolean DEFAULT false NOT NULL,
	"team_id" text,
	"team_key" text,
	"team_name" text,
	"installed_by_user_id" text,
	"installed_by_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "linear_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "linear_issue_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"linear_issue_id" text,
	"linear_issue_identifier" text,
	"linear_issue_url" text,
	"last_linear_state" text,
	"last_linear_state_type" text,
	"last_sync_status" text DEFAULT 'pending' NOT NULL,
	"last_sync_action" text,
	"last_sync_error" text,
	"last_synced_at" timestamp,
	"last_webhook_received_at" timestamp,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "linear_issue_syncs_issue_id_unique" UNIQUE("issue_id")
);
--> statement-breakpoint
CREATE TABLE "notion_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text,
	"workspace_icon" text,
	"bot_id" text,
	"auth_method" text DEFAULT 'oauth' NOT NULL,
	"installed_by_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notion_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "posthog_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"api_key" text NOT NULL,
	"host" text DEFAULT 'https://app.posthog.com' NOT NULL,
	"posthog_project_id" text NOT NULL,
	"event_config" jsonb,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_frequency" text DEFAULT 'manual' NOT NULL,
	"filter_config" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "posthog_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "posthog_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"contacts_matched" integer,
	"sessions_created" integer,
	"contacts_created" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "product_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"type" text DEFAULT 'product_area' NOT NULL,
	"goals" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"invited_email" text,
	"invited_by_user_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_settings" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"session_idle_timeout_minutes" integer,
	"session_goodbye_delay_seconds" integer,
	"session_idle_response_timeout_seconds" integer,
	"issue_tracking_enabled" boolean,
	"pm_dedup_include_closed" boolean,
	"classification_guidelines" text,
	"brief_guidelines" text,
	"analysis_guidelines" text,
	"support_agent_package_id" uuid,
	"support_agent_tone" text,
	"brand_guidelines" text,
	"knowledge_relationship_guidelines" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"secret_key" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"text_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "session_embeddings_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "session_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"sender_type" text NOT NULL,
	"sender_user_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"metadata" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text,
	"description" text,
	"status" text,
	"source" text,
	"session_type" text DEFAULT 'chat' NOT NULL,
	"tags" text[],
	"message_count" integer,
	"page_url" text,
	"page_title" text,
	"user_metadata" jsonb,
	"first_message_at" timestamp,
	"last_activity_at" timestamp,
	"goodbye_detected_at" timestamp,
	"scheduled_close_at" timestamp,
	"idle_prompt_sent_at" timestamp,
	"analysis_status" text DEFAULT 'pending' NOT NULL,
	"pm_reviewed_at" timestamp,
	"tags_auto_applied_at" timestamp,
	"is_human_takeover" boolean DEFAULT false NOT NULL,
	"human_takeover_at" timestamp,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slack_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_token_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"channel_name" text,
	"channel_type" text,
	"channel_mode" text,
	"capture_scope" text,
	"is_active" boolean DEFAULT true,
	"joined_at" timestamp,
	"workspace_primary_domain" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slack_thread_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"slack_channel_id" text NOT NULL,
	"thread_ts" text NOT NULL,
	"has_external_participants" boolean DEFAULT false,
	"last_message_ts" text,
	"last_bot_response_ts" text,
	"last_responder_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "slack_workspace_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"workspace_id" text NOT NULL,
	"workspace_name" text,
	"workspace_domain" text,
	"bot_token" text NOT NULL,
	"bot_user_id" text NOT NULL,
	"scope" text,
	"installed_by_user_id" text,
	"installed_by_email" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "slack_workspace_tokens_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "source_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repository_url" text,
	"repository_branch" text,
	"commit_sha" text,
	"kind" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"type" text NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"metadata" jsonb,
	"dedup_key" text,
	"sent_at" timestamp DEFAULT now(),
	"dismissed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text,
	"notifications_silenced" boolean DEFAULT false NOT NULL,
	"notification_preferences" jsonb,
	"slack_user_id" text,
	"slack_notification_channel" text,
	"company_name" text,
	"company_size" text,
	"role" text,
	"communication_channels" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "widget_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"trigger_type" text,
	"display_type" text,
	"theme" text,
	"position" text,
	"title" text,
	"initial_message" text,
	"shortcut" text,
	"drawer_badge_label" text,
	"variant" text,
	"token_required" boolean,
	"allowed_origins" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "widget_integrations_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "zendesk_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"subdomain" text NOT NULL,
	"admin_email" text NOT NULL,
	"api_token" text NOT NULL,
	"account_name" text,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"sync_frequency" text DEFAULT 'manual' NOT NULL,
	"filter_config" jsonb,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"last_sync_tickets_count" integer,
	"next_sync_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "zendesk_connections_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "zendesk_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"triggered_by" text NOT NULL,
	"tickets_found" integer,
	"tickets_synced" integer,
	"tickets_skipped" integer,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "zendesk_synced_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"zendesk_ticket_id" integer NOT NULL,
	"comments_count" integer,
	"ticket_created_at" timestamp,
	"ticket_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "authjs_sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_runs" ADD CONSTRAINT "chat_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compilation_runs" ADD CONSTRAINT "compilation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_embeddings" ADD CONSTRAINT "contact_embeddings_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_embeddings" ADD CONSTRAINT "contact_embeddings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_tags" ADD CONSTRAINT "custom_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_custom_field_definitions" ADD CONSTRAINT "customer_custom_field_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_knowledge_source_id_knowledge_sources_id_fk" FOREIGN KEY ("knowledge_source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_product_scope_id_product_scopes_id_fk" FOREIGN KEY ("product_scope_id") REFERENCES "public"."product_scopes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom_connections" ADD CONSTRAINT "fathom_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom_sync_runs" ADD CONSTRAINT "fathom_sync_runs_connection_id_fathom_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."fathom_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fathom_synced_meetings" ADD CONSTRAINT "fathom_synced_meetings_connection_id_fathom_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."fathom_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_app_installations" ADD CONSTRAINT "github_app_installations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gong_connections" ADD CONSTRAINT "gong_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gong_sync_runs" ADD CONSTRAINT "gong_sync_runs_connection_id_gong_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gong_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gong_synced_calls" ADD CONSTRAINT "gong_synced_calls_connection_id_gong_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gong_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gong_synced_calls" ADD CONSTRAINT "gong_synced_calls_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_connections" ADD CONSTRAINT "hubspot_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_sync_runs" ADD CONSTRAINT "hubspot_sync_runs_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_synced_companies" ADD CONSTRAINT "hubspot_synced_companies_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_synced_companies" ADD CONSTRAINT "hubspot_synced_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_synced_contacts" ADD CONSTRAINT "hubspot_synced_contacts_connection_id_hubspot_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."hubspot_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hubspot_synced_contacts" ADD CONSTRAINT "hubspot_synced_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intercom_connections" ADD CONSTRAINT "intercom_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intercom_sync_runs" ADD CONSTRAINT "intercom_sync_runs_connection_id_intercom_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."intercom_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intercom_synced_conversations" ADD CONSTRAINT "intercom_synced_conversations_connection_id_intercom_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."intercom_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intercom_synced_conversations" ADD CONSTRAINT "intercom_synced_conversations_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_analysis_runs" ADD CONSTRAINT "issue_analysis_runs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_analysis_runs" ADD CONSTRAINT "issue_analysis_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_embeddings" ADD CONSTRAINT "issue_embeddings_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_embeddings" ADD CONSTRAINT "issue_embeddings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_connections" ADD CONSTRAINT "jira_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_issue_syncs" ADD CONSTRAINT "jira_issue_syncs_connection_id_jira_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."jira_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jira_issue_syncs" ADD CONSTRAINT "jira_issue_syncs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_embeddings" ADD CONSTRAINT "knowledge_embeddings_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_package_sources" ADD CONSTRAINT "knowledge_package_sources_package_id_knowledge_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."knowledge_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_package_sources" ADD CONSTRAINT "knowledge_package_sources_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_packages" ADD CONSTRAINT "knowledge_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_source_code_id_source_codes_id_fk" FOREIGN KEY ("source_code_id") REFERENCES "public"."source_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_connections" ADD CONSTRAINT "linear_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_issue_syncs" ADD CONSTRAINT "linear_issue_syncs_connection_id_linear_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."linear_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "linear_issue_syncs" ADD CONSTRAINT "linear_issue_syncs_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notion_connections" ADD CONSTRAINT "notion_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posthog_connections" ADD CONSTRAINT "posthog_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posthog_sync_runs" ADD CONSTRAINT "posthog_sync_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posthog_sync_runs" ADD CONSTRAINT "posthog_sync_runs_connection_id_posthog_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."posthog_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_scopes" ADD CONSTRAINT "product_scopes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_api_keys" ADD CONSTRAINT "project_api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_api_keys" ADD CONSTRAINT "project_api_keys_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_settings" ADD CONSTRAINT "project_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_embeddings" ADD CONSTRAINT "session_embeddings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_embeddings" ADD CONSTRAINT "session_embeddings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_channels" ADD CONSTRAINT "slack_channels_workspace_token_id_slack_workspace_tokens_id_fk" FOREIGN KEY ("workspace_token_id") REFERENCES "public"."slack_workspace_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_thread_sessions" ADD CONSTRAINT "slack_thread_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_thread_sessions" ADD CONSTRAINT "slack_thread_sessions_channel_id_slack_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."slack_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_workspace_tokens" ADD CONSTRAINT "slack_workspace_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_integrations" ADD CONSTRAINT "widget_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zendesk_connections" ADD CONSTRAINT "zendesk_connections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zendesk_sync_runs" ADD CONSTRAINT "zendesk_sync_runs_connection_id_zendesk_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."zendesk_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zendesk_synced_tickets" ADD CONSTRAINT "zendesk_synced_tickets_connection_id_zendesk_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."zendesk_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zendesk_synced_tickets" ADD CONSTRAINT "zendesk_synced_tickets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authjs_sessions" ADD CONSTRAINT "authjs_sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;