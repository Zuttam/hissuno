/**
 * Re-exported Drizzle inferred types for all key domain tables.
 * Import from '@/lib/db/queries/types' for consistent type usage.
 */

import type {
  projects,
  projectSettings,
  projectMembers,
  projectApiKeys,
  compilationRuns,
  userProfiles,
  productScopes,
  customTags,
  companies,
  contacts,
  customerCustomFieldDefinitions,
  sessions,
  sessionMessages,
  sessionReviews,
  chatRuns,
  issues,
  issueAnalysisRuns,
  knowledgeSources,
  knowledgeEmbeddings,
  knowledgePackages,
  knowledgePackageSources,
  entityRelationships,
  sourceCodes,
  embeddings,
  slackWorkspaceTokens,
  slackChannels,
  slackThreadSessions,
  githubAppInstallations,
  jiraConnections,
  jiraIssueSyncs,
  linearConnections,
  linearIssueSyncs,
  zendeskConnections,
  intercomConnections,
  gongConnections,
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

export type CompilationRunRow = typeof compilationRuns.$inferSelect
export type CompilationRunInsert = typeof compilationRuns.$inferInsert

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------
export type UserProfileRow = typeof userProfiles.$inferSelect
export type UserProfileInsert = typeof userProfiles.$inferInsert

// ---------------------------------------------------------------------------
// Product Scopes & Tags
// ---------------------------------------------------------------------------
export type ProductScopeRow = typeof productScopes.$inferSelect
export type ProductScopeInsert = typeof productScopes.$inferInsert

export type CustomTagRow = typeof customTags.$inferSelect
export type CustomTagInsert = typeof customTags.$inferInsert

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export type CompanyRow = typeof companies.$inferSelect
export type CompanyInsert = typeof companies.$inferInsert

export type ContactRow = typeof contacts.$inferSelect
export type ContactInsert = typeof contacts.$inferInsert

export type CustomerCustomFieldRow = typeof customerCustomFieldDefinitions.$inferSelect
export type CustomerCustomFieldInsert = typeof customerCustomFieldDefinitions.$inferInsert

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

export type IssueAnalysisRunRow = typeof issueAnalysisRuns.$inferSelect
export type IssueAnalysisRunInsert = typeof issueAnalysisRuns.$inferInsert

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------
export type SourceCodeRow = typeof sourceCodes.$inferSelect
export type SourceCodeInsert = typeof sourceCodes.$inferInsert

export type KnowledgeSourceRow = typeof knowledgeSources.$inferSelect
export type KnowledgeSourceInsert = typeof knowledgeSources.$inferInsert

export type KnowledgeEmbeddingRow = typeof knowledgeEmbeddings.$inferSelect
export type KnowledgeEmbeddingInsert = typeof knowledgeEmbeddings.$inferInsert

export type KnowledgePackageRow = typeof knowledgePackages.$inferSelect
export type KnowledgePackageInsert = typeof knowledgePackages.$inferInsert

export type KnowledgePackageSourceRow = typeof knowledgePackageSources.$inferSelect
export type KnowledgePackageSourceInsert = typeof knowledgePackageSources.$inferInsert

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

export type GithubAppInstallationRow = typeof githubAppInstallations.$inferSelect

export type JiraConnectionRow = typeof jiraConnections.$inferSelect
export type JiraIssueSyncRow = typeof jiraIssueSyncs.$inferSelect

export type LinearConnectionRow = typeof linearConnections.$inferSelect
export type LinearIssueSyncRow = typeof linearIssueSyncs.$inferSelect

export type ZendeskConnectionRow = typeof zendeskConnections.$inferSelect
export type IntercomConnectionRow = typeof intercomConnections.$inferSelect
export type GongConnectionRow = typeof gongConnections.$inferSelect

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export type UserNotificationRow = typeof userNotifications.$inferSelect
export type UserNotificationInsert = typeof userNotifications.$inferInsert
