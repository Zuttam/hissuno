import {
  pgTable,
  text,
  uuid,
  boolean,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
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
  // Issue settings
  issue_tracking_enabled: boolean('issue_tracking_enabled'),
  pm_dedup_include_closed: boolean('pm_dedup_include_closed'),
  // PM agent guidelines
  classification_guidelines: text('classification_guidelines'),
  brief_guidelines: text('brief_guidelines'),
  analysis_guidelines: text('analysis_guidelines'),
  // Support agent
  support_agent_package_id: uuid('support_agent_package_id'),
  support_agent_tone: text('support_agent_tone'),
  brand_guidelines: text('brand_guidelines'),
  // Knowledge analysis settings
  knowledge_relationship_guidelines: text('knowledge_relationship_guidelines'),
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

export const compilationRuns = pgTable('compilation_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  run_id: text('run_id').notNull(),
  status: text('status').notNull().default('pending'),
  metadata: jsonb('metadata'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
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
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  color: text('color').notNull().default(''),
  position: integer('position').notNull().default(0),
  is_default: boolean('is_default').notNull().default(false),
  type: text('type').notNull().default('product_area'),
  goals: jsonb('goals'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const customTags = pgTable('custom_tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description').notNull().default(''),
  color: text('color'),
  position: integer('position').notNull().default(0),
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

export const customerCustomFieldDefinitions = pgTable('customer_custom_field_definitions', {
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
  // Lifecycle timestamps
  first_message_at: timestamp('first_message_at', { mode: 'date' }),
  last_activity_at: timestamp('last_activity_at', { mode: 'date' }),
  goodbye_detected_at: timestamp('goodbye_detected_at', { mode: 'date' }),
  scheduled_close_at: timestamp('scheduled_close_at', { mode: 'date' }),
  idle_prompt_sent_at: timestamp('idle_prompt_sent_at', { mode: 'date' }),
  // Analysis & review
  analysis_status: text('analysis_status').notNull().default('pending'),
  pm_reviewed_at: timestamp('pm_reviewed_at', { mode: 'date' }),
  tags_auto_applied_at: timestamp('tags_auto_applied_at', { mode: 'date' }),
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
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  priority: text('priority').notNull().default('medium'),
  status: text('status'),
  is_archived: boolean('is_archived').notNull().default(false),
  upvote_count: integer('upvote_count').default(0),
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
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const issueAnalysisRuns = pgTable('issue_analysis_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .references(() => issues.id),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  run_id: text('run_id').notNull(),
  status: text('status').notNull().default('pending'),
  metadata: jsonb('metadata'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

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
  analyzed_at: timestamp('analyzed_at', { mode: 'date' }),
  enabled: boolean('enabled').default(true),
  error_message: text('error_message'),
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

export const knowledgePackages = pgTable('knowledge_packages', {
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

export const knowledgePackageSources = pgTable('knowledge_package_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  package_id: uuid('package_id')
    .notNull()
    .references(() => knowledgePackages.id),
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
// Embeddings (Session, Issue, Contact)
// ---------------------------------------------------------------------------

export const sessionEmbeddings = pgTable('session_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  session_id: uuid('session_id')
    .notNull()
    .unique()
    .references(() => sessions.id),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  text_hash: text('text_hash').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const issueEmbeddings = pgTable('issue_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  issue_id: uuid('issue_id')
    .notNull()
    .unique()
    .references(() => issues.id),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
  text_hash: text('text_hash').notNull(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const contactEmbeddings = pgTable('contact_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  contact_id: uuid('contact_id')
    .notNull()
    .unique()
    .references(() => contacts.id),
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
// Integrations: GitHub
// ---------------------------------------------------------------------------

export const githubAppInstallations = pgTable('github_app_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  installation_id: integer('installation_id'),
  account_id: integer('account_id').notNull(),
  account_login: text('account_login').notNull(),
  target_type: text('target_type'),
  scope: text('scope'),
  auth_method: text('auth_method').notNull().default('app'),
  access_token: text('access_token'),
  installed_by_user_id: text('installed_by_user_id'),
  installed_by_email: text('installed_by_email'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Jira
// ---------------------------------------------------------------------------

export const jiraConnections = pgTable('jira_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  cloud_id: text('cloud_id').notNull(),
  site_url: text('site_url').notNull(),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token').notNull(),
  token_expires_at: timestamp('token_expires_at', { mode: 'date' }).notNull(),
  is_enabled: boolean('is_enabled').notNull().default(true),
  auto_sync_enabled: boolean('auto_sync_enabled').notNull().default(false),
  jira_project_id: text('jira_project_id'),
  jira_project_key: text('jira_project_key'),
  issue_type_id: text('issue_type_id'),
  issue_type_name: text('issue_type_name'),
  webhook_id: text('webhook_id'),
  webhook_secret: text('webhook_secret'),
  installed_by_user_id: text('installed_by_user_id'),
  installed_by_email: text('installed_by_email'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const jiraIssueSyncs = pgTable('jira_issue_syncs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => jiraConnections.id),
  issue_id: uuid('issue_id')
    .notNull()
    .unique()
    .references(() => issues.id),
  jira_issue_id: text('jira_issue_id'),
  jira_issue_key: text('jira_issue_key'),
  jira_issue_url: text('jira_issue_url'),
  last_jira_status: text('last_jira_status'),
  last_sync_status: text('last_sync_status').notNull().default('pending'),
  last_sync_action: text('last_sync_action'),
  last_sync_error: text('last_sync_error'),
  last_synced_at: timestamp('last_synced_at', { mode: 'date' }),
  last_webhook_received_at: timestamp('last_webhook_received_at', { mode: 'date' }),
  retry_count: integer('retry_count').notNull().default(0),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Linear
// ---------------------------------------------------------------------------

export const linearConnections = pgTable('linear_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  organization_id: text('organization_id').notNull(),
  organization_name: text('organization_name').notNull(),
  auth_method: text('auth_method').notNull().default('oauth'),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token'),
  token_expires_at: timestamp('token_expires_at', { mode: 'date' }),
  is_enabled: boolean('is_enabled').notNull().default(true),
  auto_sync_enabled: boolean('auto_sync_enabled').notNull().default(false),
  team_id: text('team_id'),
  team_key: text('team_key'),
  team_name: text('team_name'),
  installed_by_user_id: text('installed_by_user_id'),
  installed_by_email: text('installed_by_email'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const linearIssueSyncs = pgTable('linear_issue_syncs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => linearConnections.id),
  issue_id: uuid('issue_id')
    .notNull()
    .unique()
    .references(() => issues.id),
  linear_issue_id: text('linear_issue_id'),
  linear_issue_identifier: text('linear_issue_identifier'),
  linear_issue_url: text('linear_issue_url'),
  last_linear_state: text('last_linear_state'),
  last_linear_state_type: text('last_linear_state_type'),
  last_sync_status: text('last_sync_status').notNull().default('pending'),
  last_sync_action: text('last_sync_action'),
  last_sync_error: text('last_sync_error'),
  last_synced_at: timestamp('last_synced_at', { mode: 'date' }),
  last_webhook_received_at: timestamp('last_webhook_received_at', { mode: 'date' }),
  retry_count: integer('retry_count').notNull().default(0),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Zendesk
// ---------------------------------------------------------------------------

export const zendeskConnections = pgTable('zendesk_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  subdomain: text('subdomain').notNull(),
  admin_email: text('admin_email').notNull(),
  api_token: text('api_token').notNull(),
  account_name: text('account_name'),
  sync_enabled: boolean('sync_enabled').notNull().default(false),
  sync_frequency: text('sync_frequency').notNull().default('manual'),
  filter_config: jsonb('filter_config'),
  last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
  last_sync_status: text('last_sync_status'),
  last_sync_error: text('last_sync_error'),
  last_sync_tickets_count: integer('last_sync_tickets_count'),
  next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const zendeskSyncRuns = pgTable('zendesk_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => zendeskConnections.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('running'),
  triggered_by: text('triggered_by').notNull(),
  tickets_found: integer('tickets_found'),
  tickets_synced: integer('tickets_synced'),
  tickets_skipped: integer('tickets_skipped'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

export const zendeskSyncedTickets = pgTable('zendesk_synced_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => zendeskConnections.id, { onDelete: 'cascade' }),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  zendesk_ticket_id: integer('zendesk_ticket_id').notNull(),
  comments_count: integer('comments_count'),
  ticket_created_at: timestamp('ticket_created_at', { mode: 'date' }),
  ticket_updated_at: timestamp('ticket_updated_at', { mode: 'date' }),
  synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Intercom
// ---------------------------------------------------------------------------

export const intercomConnections = pgTable('intercom_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  workspace_id: text('workspace_id').notNull(),
  workspace_name: text('workspace_name'),
  access_token: text('access_token').notNull(),
  auth_method: text('auth_method').notNull().default('oauth'),
  sync_enabled: boolean('sync_enabled').notNull().default(false),
  sync_frequency: text('sync_frequency').notNull().default('manual'),
  filter_config: jsonb('filter_config'),
  last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
  last_sync_status: text('last_sync_status'),
  last_sync_error: text('last_sync_error'),
  last_sync_conversations_count: integer('last_sync_conversations_count'),
  next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const intercomSyncRuns = pgTable('intercom_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => intercomConnections.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('running'),
  triggered_by: text('triggered_by').notNull(),
  conversations_found: integer('conversations_found'),
  conversations_synced: integer('conversations_synced'),
  conversations_skipped: integer('conversations_skipped'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

export const intercomSyncedConversations = pgTable('intercom_synced_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => intercomConnections.id, { onDelete: 'cascade' }),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  intercom_conversation_id: text('intercom_conversation_id').notNull(),
  parts_count: integer('parts_count'),
  conversation_created_at: timestamp('conversation_created_at', { mode: 'date' }),
  conversation_updated_at: timestamp('conversation_updated_at', { mode: 'date' }),
  synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Gong
// ---------------------------------------------------------------------------

export const gongConnections = pgTable('gong_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  base_url: text('base_url').notNull().default('https://api.gong.io'),
  access_key: text('access_key').notNull(),
  access_key_secret: text('access_key_secret').notNull(),
  sync_enabled: boolean('sync_enabled').notNull().default(false),
  sync_frequency: text('sync_frequency').notNull().default('manual'),
  filter_config: jsonb('filter_config'),
  last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
  last_sync_status: text('last_sync_status'),
  last_sync_error: text('last_sync_error'),
  last_sync_calls_count: integer('last_sync_calls_count'),
  next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const gongSyncRuns = pgTable('gong_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => gongConnections.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('running'),
  triggered_by: text('triggered_by').notNull(),
  calls_found: integer('calls_found'),
  calls_synced: integer('calls_synced'),
  calls_skipped: integer('calls_skipped'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

export const gongSyncedCalls = pgTable('gong_synced_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => gongConnections.id, { onDelete: 'cascade' }),
  session_id: uuid('session_id')
    .notNull()
    .references(() => sessions.id),
  gong_call_id: text('gong_call_id').notNull(),
  call_duration_seconds: integer('call_duration_seconds'),
  call_created_at: timestamp('call_created_at', { mode: 'date' }),
  messages_count: integer('messages_count'),
  synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: PostHog
// ---------------------------------------------------------------------------

export const posthogConnections = pgTable('posthog_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  api_key: text('api_key').notNull(),
  host: text('host').notNull().default('https://app.posthog.com'),
  posthog_project_id: text('posthog_project_id').notNull(),
  event_config: jsonb('event_config'),
  sync_enabled: boolean('sync_enabled').notNull().default(false),
  sync_frequency: text('sync_frequency').notNull().default('manual'),
  filter_config: jsonb('filter_config'),
  last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
  last_sync_status: text('last_sync_status'),
  last_sync_error: text('last_sync_error'),
  next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const posthogSyncRuns = pgTable('posthog_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => posthogConnections.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('running'),
  contacts_matched: integer('contacts_matched'),
  sessions_created: integer('sessions_created'),
  contacts_created: integer('contacts_created'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

// ---------------------------------------------------------------------------
// Integrations: Notion
// ---------------------------------------------------------------------------

export const notionConnections = pgTable('notion_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id),
  access_token: text('access_token').notNull(),
  workspace_id: text('workspace_id').notNull(),
  workspace_name: text('workspace_name'),
  workspace_icon: text('workspace_icon'),
  bot_id: text('bot_id'),
  auth_method: text('auth_method').notNull().default('oauth'),
  installed_by_user_id: text('installed_by_user_id'),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: HubSpot
// ---------------------------------------------------------------------------

export const hubspotConnections = pgTable('hubspot_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  hub_id: text('hub_id').notNull(),
  hub_name: text('hub_name'),
  auth_method: text('auth_method').notNull().default('oauth'),
  access_token: text('access_token').notNull(),
  refresh_token: text('refresh_token'),
  token_expires_at: timestamp('token_expires_at', { mode: 'date' }),
  sync_enabled: boolean('sync_enabled').notNull().default(false),
  sync_frequency: text('sync_frequency').notNull().default('manual'),
  filter_config: jsonb('filter_config'),
  last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
  last_sync_status: text('last_sync_status'),
  last_sync_error: text('last_sync_error'),
  last_sync_companies_count: integer('last_sync_companies_count'),
  last_sync_contacts_count: integer('last_sync_contacts_count'),
  next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const hubspotSyncRuns = pgTable('hubspot_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => hubspotConnections.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('running'),
  triggered_by: text('triggered_by').notNull(),
  companies_found: integer('companies_found'),
  companies_synced: integer('companies_synced'),
  companies_skipped: integer('companies_skipped'),
  contacts_found: integer('contacts_found'),
  contacts_synced: integer('contacts_synced'),
  contacts_skipped: integer('contacts_skipped'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

export const hubspotSyncedCompanies = pgTable('hubspot_synced_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => hubspotConnections.id, { onDelete: 'cascade' }),
  company_id: uuid('company_id')
    .notNull()
    .references(() => companies.id, { onDelete: 'cascade' }),
  hubspot_company_id: text('hubspot_company_id').notNull(),
  hubspot_updated_at: timestamp('hubspot_updated_at', { mode: 'date' }),
  synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
})

export const hubspotSyncedContacts = pgTable('hubspot_synced_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => hubspotConnections.id, { onDelete: 'cascade' }),
  contact_id: uuid('contact_id')
    .notNull()
    .references(() => contacts.id, { onDelete: 'cascade' }),
  hubspot_contact_id: text('hubspot_contact_id').notNull(),
  hubspot_updated_at: timestamp('hubspot_updated_at', { mode: 'date' }),
  synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
})

// ---------------------------------------------------------------------------
// Integrations: Fathom
// ---------------------------------------------------------------------------

export const fathomConnections = pgTable('fathom_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  api_key: text('api_key').notNull(),
  sync_frequency: text('sync_frequency').notNull().default('manual'),
  sync_enabled: boolean('sync_enabled').notNull().default(false),
  filter_config: jsonb('filter_config'),
  last_sync_at: timestamp('last_sync_at', { mode: 'date' }),
  last_sync_status: text('last_sync_status'),
  last_sync_error: text('last_sync_error'),
  last_sync_meetings_count: integer('last_sync_meetings_count'),
  next_sync_at: timestamp('next_sync_at', { mode: 'date' }),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow(),
})

export const fathomSyncedMeetings = pgTable('fathom_synced_meetings', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => fathomConnections.id, { onDelete: 'cascade' }),
  fathom_meeting_id: text('fathom_meeting_id').notNull(),
  session_id: text('session_id').notNull(),
  meeting_created_at: timestamp('meeting_created_at', { mode: 'date' }),
  meeting_duration_seconds: integer('meeting_duration_seconds'),
  messages_count: integer('messages_count'),
  synced_at: timestamp('synced_at', { mode: 'date' }).defaultNow(),
})

export const fathomSyncRuns = pgTable('fathom_sync_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connection_id: uuid('connection_id')
    .notNull()
    .references(() => fathomConnections.id, { onDelete: 'cascade' }),
  triggered_by: text('triggered_by').notNull().default('manual'),
  status: text('status').notNull().default('in_progress'),
  meetings_found: integer('meetings_found'),
  meetings_synced: integer('meetings_synced'),
  meetings_skipped: integer('meetings_skipped'),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { mode: 'date' }).defaultNow(),
  completed_at: timestamp('completed_at', { mode: 'date' }),
})

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
