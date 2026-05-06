import { relations } from 'drizzle-orm'
import { users } from './auth'
import {
  projects,
  projectSettings,
  graphEvaluationSettings,
  widgetIntegrations,
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
  codebases,
  knowledgeSources,
  knowledgeEmbeddings,
  supportPackages,
  supportPackageSources,
  entityRelationships,
  embeddings,
  slackWorkspaceTokens,
  slackChannels,
  slackThreadSessions,
  userNotifications,
  integrationConnections,
} from './app'

// ---------------------------------------------------------------------------
// Auth relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, { fields: [users.id], references: [userProfiles.user_id] }),
  projectMembers: many(projectMembers),
  apiKeys: many(projectApiKeys),
}))

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projectsRelations = relations(projects, ({ one, many }) => ({
  settings: one(projectSettings, { fields: [projects.id], references: [projectSettings.project_id] }),
  graphEvaluationSettings: one(graphEvaluationSettings, { fields: [projects.id], references: [graphEvaluationSettings.project_id] }),
  members: many(projectMembers),
  apiKeys: many(projectApiKeys),
  productScopes: many(productScopes),
  companies: many(companies),
  contacts: many(contacts),
  sessions: many(sessions),
  issues: many(issues),
  knowledgeSources: many(knowledgeSources),
  codebases: many(codebases),
  supportPackages: many(supportPackages),
  widgetIntegration: one(widgetIntegrations, { fields: [projects.id], references: [widgetIntegrations.project_id] }),
  slackWorkspaceToken: one(slackWorkspaceTokens, { fields: [projects.id], references: [slackWorkspaceTokens.project_id] }),
  integrationConnections: many(integrationConnections),
}))

export const projectSettingsRelations = relations(projectSettings, ({ one }) => ({
  project: one(projects, { fields: [projectSettings.project_id], references: [projects.id] }),
  supportAgentPackage: one(supportPackages, { fields: [projectSettings.support_agent_package_id], references: [supportPackages.id] }),
}))

export const graphEvaluationSettingsRelations = relations(graphEvaluationSettings, ({ one }) => ({
  project: one(projects, { fields: [graphEvaluationSettings.project_id], references: [projects.id] }),
}))

export const widgetIntegrationsRelations = relations(widgetIntegrations, ({ one }) => ({
  project: one(projects, { fields: [widgetIntegrations.project_id], references: [projects.id] }),
}))

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.project_id], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.user_id], references: [users.id] }),
}))

export const projectApiKeysRelations = relations(projectApiKeys, ({ one }) => ({
  project: one(projects, { fields: [projectApiKeys.project_id], references: [projects.id] }),
  createdBy: one(users, { fields: [projectApiKeys.created_by_user_id], references: [users.id] }),
}))

// ---------------------------------------------------------------------------
// User Profiles
// ---------------------------------------------------------------------------

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.user_id], references: [users.id] }),
}))

// ---------------------------------------------------------------------------
// Product Scopes & Tags
// ---------------------------------------------------------------------------

export const productScopesRelations = relations(productScopes, ({ one, many }) => ({
  project: one(projects, { fields: [productScopes.project_id], references: [projects.id] }),
  parent: one(productScopes, { fields: [productScopes.parent_id], references: [productScopes.id], relationName: 'scopeHierarchy' }),
  children: many(productScopes, { relationName: 'scopeHierarchy' }),
  entityRelationships: many(entityRelationships),
}))

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const companiesRelations = relations(companies, ({ one, many }) => ({
  project: one(projects, { fields: [companies.project_id], references: [projects.id] }),
  contacts: many(contacts),
  entityRelationships: many(entityRelationships),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  project: one(projects, { fields: [contacts.project_id], references: [projects.id] }),
  company: one(companies, { fields: [contacts.company_id], references: [companies.id] }),
  embedding: one(embeddings, { fields: [contacts.id], references: [embeddings.entity_id] }),
  entityRelationships: many(entityRelationships),
}))

export const customFieldDefinitionsRelations = relations(customFieldDefinitions, ({ one }) => ({
  project: one(projects, { fields: [customFieldDefinitions.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Sessions & Messages
// ---------------------------------------------------------------------------

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  project: one(projects, { fields: [sessions.project_id], references: [projects.id] }),
  messages: many(sessionMessages),
  reviews: many(sessionReviews),
  chatRuns: many(chatRuns),
  embedding: one(embeddings, { fields: [sessions.id], references: [embeddings.entity_id] }),
  entityRelationships: many(entityRelationships),
}))

export const sessionMessagesRelations = relations(sessionMessages, ({ one }) => ({
  session: one(sessions, { fields: [sessionMessages.session_id], references: [sessions.id] }),
  project: one(projects, { fields: [sessionMessages.project_id], references: [projects.id] }),
}))

export const sessionReviewsRelations = relations(sessionReviews, ({ one }) => ({
  session: one(sessions, { fields: [sessionReviews.session_id], references: [sessions.id] }),
  project: one(projects, { fields: [sessionReviews.project_id], references: [projects.id] }),
}))

export const chatRunsRelations = relations(chatRuns, ({ one }) => ({
  session: one(sessions, { fields: [chatRuns.session_id], references: [sessions.id] }),
  project: one(projects, { fields: [chatRuns.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, { fields: [issues.project_id], references: [projects.id] }),
  embedding: one(embeddings, { fields: [issues.id], references: [embeddings.entity_id] }),
  entityRelationships: many(entityRelationships),
}))

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export const codebasesRelations = relations(codebases, ({ one, many }) => ({
  project: one(projects, { fields: [codebases.project_id], references: [projects.id] }),
  entityRelationships: many(entityRelationships),
}))

export const knowledgeSourcesRelations = relations(knowledgeSources, ({ one, many }) => ({
  project: one(projects, { fields: [knowledgeSources.project_id], references: [projects.id] }),
  parent: one(knowledgeSources, { fields: [knowledgeSources.parent_id], references: [knowledgeSources.id], relationName: 'parentChild' }),
  children: many(knowledgeSources, { relationName: 'parentChild' }),
  embeddings: many(knowledgeEmbeddings),
  supportPackageSources: many(supportPackageSources),
  entityRelationships: many(entityRelationships),
}))

export const knowledgeEmbeddingsRelations = relations(knowledgeEmbeddings, ({ one }) => ({
  project: one(projects, { fields: [knowledgeEmbeddings.project_id], references: [projects.id] }),
  source: one(knowledgeSources, { fields: [knowledgeEmbeddings.source_id], references: [knowledgeSources.id] }),
}))

export const supportPackagesRelations = relations(supportPackages, ({ one, many }) => ({
  project: one(projects, { fields: [supportPackages.project_id], references: [projects.id] }),
  sources: many(supportPackageSources),
}))

export const supportPackageSourcesRelations = relations(supportPackageSources, ({ one }) => ({
  package: one(supportPackages, { fields: [supportPackageSources.package_id], references: [supportPackages.id] }),
  source: one(knowledgeSources, { fields: [supportPackageSources.source_id], references: [knowledgeSources.id] }),
}))

// ---------------------------------------------------------------------------
// Entity Relationships
// ---------------------------------------------------------------------------

export const entityRelationshipsRelations = relations(entityRelationships, ({ one }) => ({
  project: one(projects, { fields: [entityRelationships.project_id], references: [projects.id] }),
  company: one(companies, { fields: [entityRelationships.company_id], references: [companies.id] }),
  contact: one(contacts, { fields: [entityRelationships.contact_id], references: [contacts.id] }),
  issue: one(issues, { fields: [entityRelationships.issue_id], references: [issues.id] }),
  session: one(sessions, { fields: [entityRelationships.session_id], references: [sessions.id] }),
  knowledgeSource: one(knowledgeSources, { fields: [entityRelationships.knowledge_source_id], references: [knowledgeSources.id] }),
  productScope: one(productScopes, { fields: [entityRelationships.product_scope_id], references: [productScopes.id] }),
}))

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  project: one(projects, { fields: [embeddings.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Slack
// ---------------------------------------------------------------------------

export const slackWorkspaceTokensRelations = relations(slackWorkspaceTokens, ({ one, many }) => ({
  project: one(projects, { fields: [slackWorkspaceTokens.project_id], references: [projects.id] }),
  channels: many(slackChannels),
}))

export const slackChannelsRelations = relations(slackChannels, ({ one, many }) => ({
  workspaceToken: one(slackWorkspaceTokens, { fields: [slackChannels.workspace_token_id], references: [slackWorkspaceTokens.id] }),
  threadSessions: many(slackThreadSessions),
}))

export const slackThreadSessionsRelations = relations(slackThreadSessions, ({ one }) => ({
  session: one(sessions, { fields: [slackThreadSessions.session_id], references: [sessions.id] }),
  channel: one(slackChannels, { fields: [slackThreadSessions.channel_id], references: [slackChannels.id] }),
}))

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  project: one(projects, { fields: [userNotifications.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Unified integrations (plugin-kit)
// ---------------------------------------------------------------------------

export const integrationConnectionsRelations = relations(integrationConnections, ({ one }) => ({
  project: one(projects, { fields: [integrationConnections.project_id], references: [projects.id] }),
}))
