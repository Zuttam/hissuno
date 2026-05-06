/**
 * Re-exported Drizzle inferred types for all key domain tables.
 * Import from '@/lib/db/queries/types' for consistent type usage.
 */

import type {
  projects,
  projectSettings,
  projectMembers,
  projectApiKeys,
  userProfiles,
  productScopes,
  companies,
  contacts,
  customFieldDefinitions,
  sessions,
  sessionMessages,
  sessionReviews,
  chatRuns,
  issues,
  knowledgeSources,
  knowledgeEmbeddings,
  supportPackages,
  supportPackageSources,
  entityRelationships,
  sourceCodes,
  embeddings,
  slackWorkspaceTokens,
  slackChannels,
  slackThreadSessions,
  integrationConnections,
  integrationStreams,
  integrationSyncRuns,
  integrationSyncedRecords,
  userNotifications,
} from '@/lib/db/schema/app'

// ---------------------------------------------------------------------------
// Core: Projects
// ---------------------------------------------------------------------------
export type ProjectRow = typeof projects.$inferSelect
export type ProjectInsert = typeof projects.$inferInsert

export type ProjectSettingsRow = typeof projectSettings.$inferSelect
export type ProjectSettingsInsert = typeof projectSettings.$inferInsert

export type ProjectMemberRow = typeof projectMembers.$inferSelect
export type ProjectMemberInsert = typeof projectMembers.$inferInsert

export type ProjectApiKeyRow = typeof projectApiKeys.$inferSelect
export type ProjectApiKeyInsert = typeof projectApiKeys.$inferInsert

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------
export type UserProfileRow = typeof userProfiles.$inferSelect
export type UserProfileInsert = typeof userProfiles.$inferInsert

// ---------------------------------------------------------------------------
// Product Scopes
// ---------------------------------------------------------------------------
export type ProductScopeRow = typeof productScopes.$inferSelect
export type ProductScopeInsert = typeof productScopes.$inferInsert

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export type CompanyRow = typeof companies.$inferSelect
export type CompanyInsert = typeof companies.$inferInsert

export type ContactRow = typeof contacts.$inferSelect
export type ContactInsert = typeof contacts.$inferInsert

export type CustomFieldDefinitionRow = typeof customFieldDefinitions.$inferSelect
export type CustomFieldDefinitionInsert = typeof customFieldDefinitions.$inferInsert
/** @deprecated Use CustomFieldDefinitionRow */
export type CustomerCustomFieldRow = CustomFieldDefinitionRow
/** @deprecated Use CustomFieldDefinitionInsert */
export type CustomerCustomFieldInsert = CustomFieldDefinitionInsert

// ---------------------------------------------------------------------------
// Sessions & Messages
// ---------------------------------------------------------------------------
export type SessionRow = typeof sessions.$inferSelect
export type SessionInsert = typeof sessions.$inferInsert

export type SessionMessageRow = typeof sessionMessages.$inferSelect
export type SessionMessageInsert = typeof sessionMessages.$inferInsert

export type SessionReviewRow = typeof sessionReviews.$inferSelect
export type SessionReviewInsert = typeof sessionReviews.$inferInsert

export type ChatRunRow = typeof chatRuns.$inferSelect
export type ChatRunInsert = typeof chatRuns.$inferInsert

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------
export type IssueRow = typeof issues.$inferSelect
export type IssueInsert = typeof issues.$inferInsert

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------
export type SourceCodeRow = typeof sourceCodes.$inferSelect
export type SourceCodeInsert = typeof sourceCodes.$inferInsert

export type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect
export type KnowledgeSourceInsert = typeof knowledgeSources.$inferInsert

export type KnowledgeEmbeddingRow = typeof knowledgeEmbeddings.$inferSelect
export type KnowledgeEmbeddingInsert = typeof knowledgeEmbeddings.$inferInsert

export type SupportPackageRow = typeof supportPackages.$inferSelect
export type SupportPackageInsert = typeof supportPackages.$inferInsert

export type SupportPackageSourceRow = typeof supportPackageSources.$inferSelect
export type SupportPackageSourceInsert = typeof supportPackageSources.$inferInsert

// ---------------------------------------------------------------------------
// Entity Relationships
// ---------------------------------------------------------------------------
export type EntityRelationshipRow = typeof entityRelationships.$inferSelect
export type EntityRelationshipInsert = typeof entityRelationships.$inferInsert
export type EntityType = 'company' | 'contact' | 'issue' | 'session' | 'knowledge_source' | 'product_scope'

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------
export type EmbeddingRow = typeof embeddings.$inferSelect
export type EmbeddingInsert = typeof embeddings.$inferInsert

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
export type SlackWorkspaceTokenRow = typeof slackWorkspaceTokens.$inferSelect
export type SlackChannelRow = typeof slackChannels.$inferSelect
export type SlackThreadSessionRow = typeof slackThreadSessions.$inferSelect

export type IntegrationConnectionRow = typeof integrationConnections.$inferSelect
export type IntegrationConnectionInsert = typeof integrationConnections.$inferInsert
export type IntegrationStreamRow = typeof integrationStreams.$inferSelect
export type IntegrationStreamInsert = typeof integrationStreams.$inferInsert
export type IntegrationSyncRunRow = typeof integrationSyncRuns.$inferSelect
export type IntegrationSyncRunInsert = typeof integrationSyncRuns.$inferInsert
export type IntegrationSyncedRecordRow = typeof integrationSyncedRecords.$inferSelect
export type IntegrationSyncedRecordInsert = typeof integrationSyncedRecords.$inferInsert

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type UserNotificationRow = typeof userNotifications.$inferSelect
export type UserNotificationInsert = typeof userNotifications.$inferInsert
