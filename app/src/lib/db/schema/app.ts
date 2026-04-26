import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
  unique,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { vector } from './custom-types'

// ---------------------------------------------------------------------------
// Core: Projects
// ---------------------------------------------------------------------------

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  secret_key: text('secret_key'),
  is_demo: boolean('is_demo').notNull().default(false),
  user_id: uuid('user_id').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const projectSettings = pgTable('project_settings', {
  project_id: uuid('project_id')
    .primaryKey()
    .references(() => projects.id),
  // Session settings
  session_idle_timeout_minutes: integer('session_idle_timeout_minutes'),
  session_goodbye_delay_seconds: integer('session_goodbye_delay_seconds'),
  session_idle_response_timeout_seconds: integer('session_idle_response_timeout_seconds'),
  // Feedback review workflow settings
  classification_guidelines: text('classification_guidelines'),
  brief_guidelines: text('brief_guidelines'),
  analysis_guidelines: text('analysis_guidelines'),
  // Support agent
  support_agent_package_id: uuid('support_agent_package_id'),
  support_agent_tone: text('support_agent_tone'),
  brand_guidelines: text('brand_guidelines'),
  // Knowledge analysis settings
  knowledge_relationship_guidelines: text('knowledge_relationship_guidelines'),
  // AI model configuration (per-project override)
  ai_model: text('ai_model'),
  ai_model_small: text('ai_model_small'),
  // Automation runner — long-lived project-scoped API key used by skill-runner
  // sandboxes. One per project, encrypted at rest with AUTOMATION_KEY_ENC_SECRET.
  // Created on demand by getOrCreateAutomationApiKey.
  automation_key_id: uuid('automation_key_id'),
  automation_key_ciphertext: text('automation_key_ciphertext'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const graphEvaluationSettings = pgTable('graph_evaluation_settings', {
  project_id: uuid('project_id')
    .primaryKey()
    .references(() => projects.id),
  config: jsonb('config').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const widgetIntegrations = pgTable('widget_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  trigger_type: text('trigger_type'),
  display_type: text('display_type'),
  theme: text('theme'),
  position: text('position'),
  title: text('title'),
  initial_message: text('initial_message'),
  shortcut: text('shortcut'),
  drawer_badge_label: text('drawer_badge_label'),
  variant: text('variant'),
  token_required: boolean('token_required'),
  allowed_origins: text('allowed_origins').array(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  user_id: uuid('user_id').references(() => users.id),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('active'),
  invited_email: text('invited_email'),
  invited_by_user_id: uuid('invited_by_user_id'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const projectApiKeys = pgTable('project_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  created_by_user_id: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  key_hash: text('key_hash').notNull(),
  key_prefix: text('key_prefix').notNull(),
  last_used_at: timestamp('last_used_at', { mode: 'date' }),
  expires_at: timestamp('expires_at', { mode: 'date' }),
  revoked_at: timestamp('revoked_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  full_name: text('full_name'),
  notifications_silenced: boolean('notifications_silenced').notNull().default(false),
  notification_preferences: jsonb('notification_preferences'),
  slack_user_id: text('slack_user_id'),
  slack_notification_channel: text('slack_notification_channel'),
  company_name: text('company_name'),
  company_size: text('company_size'),
  role: text('role'),
  communication_channels: text('communication_channels').array(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Product Scopes & Tags
// ---------------------------------------------------------------------------

export const productScopes = pgTable('product_scopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  parent_id: uuid('parent_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default(''),
  position: integer('position').notNull().default(0),
  depth: integer('depth').notNull().default(0),
  is_default: boolean('is_default').notNull().default(false),
  type: text('type').notNull().default('product_area'),
  goals: jsonb('goals'),
  content: text('content'),
  custom_fields: jsonb('custom_fields'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Customers: Companies & Contacts
// ---------------------------------------------------------------------------

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  industry: text('industry'),
  country: text('country'),
  employee_count: integer('employee_count'),
  arr: doublePrecision('arr'),
  stage: text('stage'),
  plan_tier: text('plan_tier'),
  product_used: text('product_used'),
  health_score: integer('health_score'),
  renewal_date: timestamp('renewal_date', { mode: 'date' }),
  notes: text('notes'),
  custom_fields: jsonb('custom_fields'),
  is_archived: boolean('is_archived').default(false),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  company_id: uuid('company_id').references(() => companies.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  title: text('title'),
  role: text('role'),
  company_url: text('company_url'),
  is_champion: boolean('is_champion').default(false),
  is_archived: boolean('is_archived').default(false),
  last_contacted_at: timestamp('last_contacted_at', { mode: 'date' }),
  notes: text('notes'),
  custom_fields: jsonb('custom_fields'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const customFieldDefinitions = pgTable('customer_custom_field_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  entity_type: text('entity_type').notNull(),
  field_key: text('field_key').notNull(),
  field_label: text('field_label').notNull(),
  field_type: text('field_type').notNull(),
  is_required: boolean('is_required').default(false),
  select_options: text('select_options').array(),
  position: integer('position').notNull().default(0),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Feedback: Sessions & Messages
// ---------------------------------------------------------------------------

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name'),
  description: text('description'),
  status: text('status'),
  source: text('source'),
  session_type: text('session_type').notNull().default('chat'),
  tags: text('tags').array(),
  message_count: integer('message_count'),
  page_url: text('page_url'),
  page_title: text('page_title'),
  user_metadata: jsonb('user_metadata'),
  custom_fields: jsonb('custom_fields'),
  // Lifecycle timestamps
  first_message_at: timestamp('first_message_at', { mode: 'date' }),
  last_activity_at: timestamp('last_activity_at', { mode: 'date' }),
  goodbye_detected_at: timestamp('goodbye_detected_at', { mode: 'date' }),
  scheduled_close_at: timestamp('scheduled_close_at', { mode: 'date' }),
  idle_prompt_sent_at: timestamp('idle_prompt_sent_at', { mode: 'date' }),
  // Analysis & review
  base_processed_at: timestamp('base_processed_at', { mode: 'date' }),
  // Human takeover
  is_human_takeover: boolean('is_human_takeover').notNull().default(false),
  human_takeover_at: timestamp('human_takeover_at', { mode: 'date' }),
  // Archive
  is_archived: boolean('is_archived').notNull().default(false),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const sessionMessages = pgTable('session_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  sender_type: text('sender_type').notNull(),
  sender_user_id: text('sender_user_id'),
  content: text('content').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

export const sessionReviews = pgTable('session_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  run_id: text('run_id').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  metadata: jsonb('metadata'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

export const chatRuns = pgTable('chat_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  run_id: text('run_id').notNull(),
  status: text('status').notNull().default('running'),
  metadata: jsonb('metadata'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export const issues = pgTable('issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  priority: text('priority').notNull().default('medium'),
  status: text('status'),
  is_archived: boolean('is_archived').notNull().default(false),
  custom_fields: jsonb('custom_fields'),
  priority_manual_override: boolean('priority_manual_override').default(false),
  // RICE scores
  reach_score: doublePrecision('reach_score'),
  reach_reasoning: text('reach_reasoning'),
  impact_score: doublePrecision('impact_score'),
  confidence_score: doublePrecision('confidence_score'),
  confidence_reasoning: text('confidence_reasoning'),
  effort_score: doublePrecision('effort_score'),
  effort_estimate: text('effort_estimate'),
  effort_reasoning: text('effort_reasoning'),
  // Analysis
  impact_analysis: jsonb('impact_analysis'),
  analysis_computed_at: timestamp('analysis_computed_at', { mode: 'date' }),
  // Brief
  brief: text('brief'),
  brief_generated_at: timestamp('brief_generated_at', { mode: 'date' }),
  // PR link (set by autonomous dev skill when an issue ships)
  pr_url: text('pr_url'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// Per-project skill enable/disable. One row per (project, skill) where the
// project has explicitly turned a skill off. No row = enabled (default).
// Replaces the legacy project_settings.issue_analysis_enabled column and
// the custom_skills.enabled column (both removed in the same migration).
export const projectSkillSettings = pgTable(
  'project_skill_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    skill_id: text('skill_id').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('project_skill_settings_project_skill_idx').on(t.project_id, t.skill_id),
  ],
)

// Per-project custom automation skills. The SKILL.md body lives in blob
// storage (FileStorageProvider) at the path stored in `blob_path`; this row
// is the metadata + frontmatter snapshot needed for catalog rendering and
// trigger validation without round-tripping the blob on every list.
export const customSkills = pgTable(
  'custom_skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    skill_id: text('skill_id').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    version: text('version'),
    blob_path: text('blob_path').notNull(),
    /** Frontmatter snapshot - duplicated from SKILL.md for fast catalog reads. */
    frontmatter: jsonb('frontmatter').notNull().default({}),
    created_by_user_id: uuid('created_by_user_id').references(() => users.id),
    created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('custom_skills_project_skill_idx').on(t.project_id, t.skill_id),
  ],
)

// Generic per-run record for skill-based automations. Replaces compilation_runs
// and issue_analysis_runs once each is migrated to a SKILL.md-driven flow
// (see plan: replace static workflows with skill.md-based automations).
export const automationRuns = pgTable(
  'automation_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    skill_id: text('skill_id').notNull(),
    skill_version: text('skill_version'),
    skill_source: text('skill_source').notNull().default('bundled'), // 'bundled' | 'custom'
    trigger_type: text('trigger_type').notNull(), // 'manual' | 'scheduled' | 'event'
    trigger_entity_type: text('trigger_entity_type'), // 'issue' | 'customer' | 'scope' | ...
    trigger_entity_id: text('trigger_entity_id'),
    status: text('status').notNull().default('queued'), // queued | running | succeeded | failed | cancelled
    input: jsonb('input').notNull().default({}),
    output: jsonb('output'),
    error: jsonb('error'),
    progress_events: jsonb('progress_events').notNull().default([]),
    started_at: timestamp('started_at', { mode: 'date' }),
    completed_at: timestamp('completed_at', { mode: 'date' }),
    duration_ms: integer('duration_ms'),
    created_at: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('automation_runs_project_skill_idx').on(t.project_id, t.skill_id, t.created_at),
    index('automation_runs_status_idx').on(t.status),
    index('automation_runs_entity_idx').on(t.trigger_entity_type, t.trigger_entity_id),
  ],
)

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export const sourceCodes = pgTable('source_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  repository_url: text('repository_url'),
  repository_branch: text('repository_branch'),
  commit_sha: text('commit_sha'),
  kind: text('kind'),
  synced_at: timestamp('synced_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const knowledgeSources = pgTable('knowledge_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  source_code_id: uuid('source_code_id').references(() => sourceCodes.id),
  parent_id: uuid('parent_id'),
  name: text('name'),
  description: text('description'),
  type: text('type').notNull(),
  status: text('status').notNull().default('pending'),
  url: text('url'),
  content: text('content'),
  storage_path: text('storage_path'),
  analyzed_content: text('analyzed_content'),
  analysis_scope: text('analysis_scope'),
  notion_page_id: text('notion_page_id'),
  origin: text('origin'),
  custom_fields: jsonb('custom_fields'),
  analyzed_at: timestamp('analyzed_at', { mode: 'date' }),
  enabled: boolean('enabled').default(true),
  error_message: text('error_message'),
  sort_order: integer('sort_order').default(0),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const knowledgeEmbeddings = pgTable('knowledge_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  source_id: uuid('source_id').references(() => knowledgeSources.id),
  chunk_text: text('chunk_text').notNull(),
  chunk_index: integer('chunk_index').notNull(),
  chunk_start_line: integer('chunk_start_line'),
  chunk_end_line: integer('chunk_end_line'),
  section_heading: text('section_heading'),
  parent_headings: text('parent_headings').array(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  version: integer('version').notNull().default(1),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const supportPackages = pgTable('support_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  description: text('description'),
  guidelines: text('guidelines'),
  // Compiled content (previously in package_compilations)
  faq_content: text('faq_content'),
  howto_content: text('howto_content'),
  feature_docs_content: text('feature_docs_content'),
  troubleshooting_content: text('troubleshooting_content'),
  compiled_at: timestamp('compiled_at', { mode: 'date' }),
  source_snapshot: jsonb('source_snapshot'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const supportPackageSources = pgTable('support_package_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  package_id: uuid('package_id')
    .notNull()
    .references(() => supportPackages.id),
  source_id: uuid('source_id')
    .notNull()
    .references(() => knowledgeSources.id),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Entity Relationships (universal graph edges)
// ---------------------------------------------------------------------------

export const entityRelationships = pgTable('entity_relationships', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id),
  company_id: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  contact_id: uuid('contact_id').references(() => contacts.id, { onDelete: 'cascade' }),
  issue_id: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }),
  session_id: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  knowledge_source_id: uuid('knowledge_source_id').references(() => knowledgeSources.id, { onDelete: 'cascade' }),
  product_scope_id: uuid('product_scope_id').references(() => productScopes.id, { onDelete: 'cascade' }),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Embeddings (unified table for issues, sessions, contacts, companies, product scopes)
// ---------------------------------------------------------------------------

export const embeddings = pgTable('embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entity_id: uuid('entity_id').notNull().unique(),
  entity_type: text('entity_type').notNull(), // 'issue' | 'session' | 'contact' | 'company' | 'product_scope'
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  text_hash: text('text_hash').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Slack
// ---------------------------------------------------------------------------

export const slackWorkspaceTokens = pgTable('slack_workspace_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  workspace_id: text('workspace_id').notNull(),
  workspace_name: text('workspace_name'),
  workspace_domain: text('workspace_domain'),
  bot_token: text('bot_token').notNull(),
  bot_user_id: text('bot_user_id').notNull(),
  scope: text('scope'),
  installed_by_user_id: text('installed_by_user_id'),
  installed_by_email: text('installed_by_email'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const slackChannels = pgTable('slack_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspace_token_id: uuid('workspace_token_id')
    .notNull()
    .references(() => slackWorkspaceTokens.id),
  channel_id: text('channel_id').notNull(),
  channel_name: text('channel_name'),
  channel_type: text('channel_type'),
  channel_mode: text('channel_mode'),
  capture_scope: text('capture_scope'),
  is_active: boolean('is_active').default(true),
  joined_at: timestamp('joined_at', { mode: 'date' }),
  workspace_primary_domain: text('workspace_primary_domain'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

export const slackThreadSessions = pgTable('slack_thread_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  channel_id: uuid('channel_id')
    .notNull()
    .references(() => slackChannels.id),
  slack_channel_id: text('slack_channel_id').notNull(),
  thread_ts: text('thread_ts').notNull(),
  has_external_participants: boolean('has_external_participants').default(false),
  last_message_ts: text('last_message_ts'),
  last_bot_response_ts: text('last_bot_response_ts'),
  last_responder_type: text('last_responder_type'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Infrastructure: Rate Limiting
// ---------------------------------------------------------------------------

export const rateLimitEvents = pgTable('rate_limit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
}, (table) => [
  index('idx_rate_limit_key_created').on(table.key, table.created_at),
])

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const userNotifications = pgTable('user_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull(),
  project_id: uuid('project_id').references(() => projects.id),
  type: text('type').notNull(),
  channel: text('channel').notNull().default('in_app'),
  metadata: jsonb('metadata'),
  dedup_key: text('dedup_key'),
  sent_at: timestamp('sent_at', { mode: 'date' }).defaultNow(),
  dismissed_at: timestamp('dismissed_at', { mode: 'date' }),
})

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Integrations (plugin-kit)
// ---------------------------------------------------------------------------

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    project_id: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    plugin_id: text('plugin_id').notNull(),
    /** Stable identifier from the provider (workspace id, subdomain, installation id, ...). */
    external_account_id: text('external_account_id').notNull(),
    /** Human-readable label shown in the UI. */
    account_label: text('account_label').notNull(),
    /** Auth tokens / api keys. Currently plaintext; encryption is a follow-up. */
    credentials: jsonb('credentials').notNull(),
    /** Connection-level settings (not stream-specific). */
    settings: jsonb('settings'),
    created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
  },
  (table) => [
    unique('integration_connections_unique').on(
      table.project_id,
      table.plugin_id,
      table.external_account_id
    ),
    index('idx_integration_connections_project').on(table.project_id),
    index('idx_integration_connections_plugin').on(table.plugin_id),
  ]
)

export const integrationStreams = pgTable(
  'integration_streams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    plugin_id: text('plugin_id').notNull(),
    /**
     * Full stream key. For singleton streams equals the plugin's stream def key
     * (e.g. "tickets"). For parameterized streams encodes instance id
     * ("codebase:acme/repo"). See plugin-kit.buildStreamId / parseStreamId.
     */
    stream_id: text('stream_id').notNull(),
    /** The stream kind ("sessions", "contacts", ...) for analytics/indexing. */
    stream_kind: text('stream_kind').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /** 'manual' | '1h' | '6h' | '24h' | 'webhook' */
    frequency: text('frequency').notNull().default('manual'),
    filter_config: jsonb('filter_config'),
    /** Stream-specific settings (e.g. per-channel "join-on-mention" flag). */
    settings: jsonb('settings'),
    last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
    last_sync_status: text('last_sync_status'),
    last_sync_error: text('last_sync_error'),
    last_sync_counts: jsonb('last_sync_counts'),
    next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
    created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
    updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
  },
  (table) => [
    unique('integration_streams_unique').on(table.connection_id, table.stream_id),
    index('idx_integration_streams_connection').on(table.connection_id),
    index('idx_integration_streams_due').on(table.enabled, table.frequency, table.next_sync_at),
  ]
)

export const integrationSyncRuns = pgTable(
  'integration_sync_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    plugin_id: text('plugin_id').notNull(),
    /** Null for connection-level runs (currently unused but reserved). */
    stream_id: text('stream_id'),
    triggered_by: text('triggered_by').notNull(),
    status: text('status').notNull().default('in_progress'),
    counts: jsonb('counts'),
    error_message: text('error_message'),
    started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
    completed_at: timestamp('completed_at', { mode: 'date' }),
  },
  (table) => [
    index('idx_integration_sync_runs_connection').on(table.connection_id),
    index('idx_integration_sync_runs_started').on(table.started_at),
  ]
)

export const integrationSyncedRecords = pgTable(
  'integration_synced_records',
  {
    connection_id: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    stream_id: text('stream_id').notNull(),
    /** External id (provider's primary key for the record, e.g. "ticket:12345"). */
    external_id: text('external_id').notNull(),
    /** The hissuno id the external record was mapped to (session id, issue id, ...). */
    hissuno_id: text('hissuno_id').notNull(),
    hissuno_kind: text('hissuno_kind').notNull(),
    synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
  },
  (table) => [
    // Composite PK — we look up by (connection, stream, external).
    unique('integration_synced_records_pk').on(
      table.connection_id,
      table.stream_id,
      table.external_id
    ),
    index('idx_integration_synced_records_connection').on(table.connection_id),
  ]
)

