import { relations } from 'drizzle-orm'
import { users } from './auth'
import {
  projects,
  projectSettings,
  graphEvaluationSettings,
  widgetIntegrations,
  projectMembers,
  projectApiKeys,
  compilationRuns,
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
  issueAnalysisRuns,
  sourceCodes,
  knowledgeSources,
  knowledgeEmbeddings,
  supportPackages,
  supportPackageSources,
  entityRelationships,
  embeddings,
  slackWorkspaceTokens,
  slackChannels,
  slackThreadSessions,
  githubAppInstallations,
  githubSyncConfigs,
  githubSyncedIssues,
  jiraConnections,
  linearConnections,
  zendeskConnections,
  zendeskSyncRuns,
  zendeskSyncedTickets,
  intercomConnections,
  intercomSyncRuns,
  intercomSyncedConversations,
  gongConnections,
  gongSyncRuns,
  gongSyncedCalls,
  fathomConnections,
  fathomSyncRuns,
  fathomSyncedMeetings,
  posthogConnections,
  posthogSyncRuns,
  notionConnections,
  notionSyncConfigs,
  notionIssueSyncs,
  hubspotConnections,
  hubspotSyncRuns,
  hubspotSyncedCompanies,
  hubspotSyncedContacts,
  userNotifications,
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
  compilationRuns: many(compilationRuns),
  productScopes: many(productScopes),
  companies: many(companies),
  contacts: many(contacts),
  sessions: many(sessions),
  issues: many(issues),
  knowledgeSources: many(knowledgeSources),
  supportPackages: many(supportPackages),
  // Integrations (one-to-one)
  widgetIntegration: one(widgetIntegrations, { fields: [projects.id], references: [widgetIntegrations.project_id] }),
  slackWorkspaceToken: one(slackWorkspaceTokens, { fields: [projects.id], references: [slackWorkspaceTokens.project_id] }),
  githubAppInstallation: one(githubAppInstallations, { fields: [projects.id], references: [githubAppInstallations.project_id] }),
  jiraConnection: one(jiraConnections, { fields: [projects.id], references: [jiraConnections.project_id] }),
  linearConnection: one(linearConnections, { fields: [projects.id], references: [linearConnections.project_id] }),
  zendeskConnection: one(zendeskConnections, { fields: [projects.id], references: [zendeskConnections.project_id] }),
  intercomConnection: one(intercomConnections, { fields: [projects.id], references: [intercomConnections.project_id] }),
  gongConnection: one(gongConnections, { fields: [projects.id], references: [gongConnections.project_id] }),
  posthogConnection: one(posthogConnections, { fields: [projects.id], references: [posthogConnections.project_id] }),
  notionConnection: one(notionConnections, { fields: [projects.id], references: [notionConnections.project_id] }),
  notionSyncConfigs: many(notionSyncConfigs),
  hubspotConnection: one(hubspotConnections, { fields: [projects.id], references: [hubspotConnections.project_id] }),
  fathomConnection: one(fathomConnections, { fields: [projects.id], references: [fathomConnections.project_id] }),
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

export const compilationRunsRelations = relations(compilationRuns, ({ one }) => ({
  project: one(projects, { fields: [compilationRuns.project_id], references: [projects.id] }),
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
  analysisRuns: many(issueAnalysisRuns),
  embedding: one(embeddings, { fields: [issues.id], references: [embeddings.entity_id] }),
  notionSync: one(notionIssueSyncs, { fields: [issues.id], references: [notionIssueSyncs.issue_id] }),
  entityRelationships: many(entityRelationships),
}))

export const issueAnalysisRunsRelations = relations(issueAnalysisRuns, ({ one }) => ({
  issue: one(issues, { fields: [issueAnalysisRuns.issue_id], references: [issues.id] }),
  project: one(projects, { fields: [issueAnalysisRuns.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

export const sourceCodesRelations = relations(sourceCodes, ({ many }) => ({
  knowledgeSources: many(knowledgeSources),
}))

export const knowledgeSourcesRelations = relations(knowledgeSources, ({ one, many }) => ({
  project: one(projects, { fields: [knowledgeSources.project_id], references: [projects.id] }),
  sourceCode: one(sourceCodes, { fields: [knowledgeSources.source_code_id], references: [sourceCodes.id] }),
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
// Integrations: GitHub
// ---------------------------------------------------------------------------

export const githubAppInstallationsRelations = relations(githubAppInstallations, ({ one, many }) => ({
  project: one(projects, { fields: [githubAppInstallations.project_id], references: [projects.id] }),
  syncConfigs: many(githubSyncConfigs),
  syncedIssues: many(githubSyncedIssues),
}))

export const githubSyncConfigsRelations = relations(githubSyncConfigs, ({ one }) => ({
  installation: one(githubAppInstallations, { fields: [githubSyncConfigs.installation_id], references: [githubAppInstallations.id] }),
  project: one(projects, { fields: [githubSyncConfigs.project_id], references: [projects.id] }),
}))

export const githubSyncedIssuesRelations = relations(githubSyncedIssues, ({ one }) => ({
  installation: one(githubAppInstallations, { fields: [githubSyncedIssues.installation_id], references: [githubAppInstallations.id] }),
  session: one(sessions, { fields: [githubSyncedIssues.session_id], references: [sessions.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Jira
// ---------------------------------------------------------------------------

export const jiraConnectionsRelations = relations(jiraConnections, ({ one, many }) => ({
  project: one(projects, { fields: [jiraConnections.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Linear
// ---------------------------------------------------------------------------

export const linearConnectionsRelations = relations(linearConnections, ({ one }) => ({
  project: one(projects, { fields: [linearConnections.project_id], references: [projects.id] }),
}))


// ---------------------------------------------------------------------------
// Integrations: Zendesk
// ---------------------------------------------------------------------------

export const zendeskConnectionsRelations = relations(zendeskConnections, ({ one, many }) => ({
  project: one(projects, { fields: [zendeskConnections.project_id], references: [projects.id] }),
  syncRuns: many(zendeskSyncRuns),
  syncedTickets: many(zendeskSyncedTickets),
}))

export const zendeskSyncRunsRelations = relations(zendeskSyncRuns, ({ one }) => ({
  connection: one(zendeskConnections, { fields: [zendeskSyncRuns.connection_id], references: [zendeskConnections.id] }),
}))

export const zendeskSyncedTicketsRelations = relations(zendeskSyncedTickets, ({ one }) => ({
  connection: one(zendeskConnections, { fields: [zendeskSyncedTickets.connection_id], references: [zendeskConnections.id] }),
  session: one(sessions, { fields: [zendeskSyncedTickets.session_id], references: [sessions.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Intercom
// ---------------------------------------------------------------------------

export const intercomConnectionsRelations = relations(intercomConnections, ({ one, many }) => ({
  project: one(projects, { fields: [intercomConnections.project_id], references: [projects.id] }),
  syncRuns: many(intercomSyncRuns),
  syncedConversations: many(intercomSyncedConversations),
}))

export const intercomSyncRunsRelations = relations(intercomSyncRuns, ({ one }) => ({
  connection: one(intercomConnections, { fields: [intercomSyncRuns.connection_id], references: [intercomConnections.id] }),
}))

export const intercomSyncedConversationsRelations = relations(intercomSyncedConversations, ({ one }) => ({
  connection: one(intercomConnections, { fields: [intercomSyncedConversations.connection_id], references: [intercomConnections.id] }),
  session: one(sessions, { fields: [intercomSyncedConversations.session_id], references: [sessions.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Gong
// ---------------------------------------------------------------------------

export const gongConnectionsRelations = relations(gongConnections, ({ one, many }) => ({
  project: one(projects, { fields: [gongConnections.project_id], references: [projects.id] }),
  syncRuns: many(gongSyncRuns),
  syncedCalls: many(gongSyncedCalls),
}))

export const gongSyncRunsRelations = relations(gongSyncRuns, ({ one }) => ({
  connection: one(gongConnections, { fields: [gongSyncRuns.connection_id], references: [gongConnections.id] }),
}))

export const gongSyncedCallsRelations = relations(gongSyncedCalls, ({ one }) => ({
  connection: one(gongConnections, { fields: [gongSyncedCalls.connection_id], references: [gongConnections.id] }),
  session: one(sessions, { fields: [gongSyncedCalls.session_id], references: [sessions.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: PostHog
// ---------------------------------------------------------------------------

export const posthogConnectionsRelations = relations(posthogConnections, ({ one, many }) => ({
  project: one(projects, { fields: [posthogConnections.project_id], references: [projects.id] }),
  syncRuns: many(posthogSyncRuns),
}))

export const posthogSyncRunsRelations = relations(posthogSyncRuns, ({ one }) => ({
  connection: one(posthogConnections, { fields: [posthogSyncRuns.connection_id], references: [posthogConnections.id] }),
  project: one(projects, { fields: [posthogSyncRuns.project_id], references: [projects.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Notion
// ---------------------------------------------------------------------------

export const notionConnectionsRelations = relations(notionConnections, ({ one, many }) => ({
  project: one(projects, { fields: [notionConnections.project_id], references: [projects.id] }),
  syncConfigs: many(notionSyncConfigs),
  issueSyncs: many(notionIssueSyncs),
}))

export const notionSyncConfigsRelations = relations(notionSyncConfigs, ({ one }) => ({
  connection: one(notionConnections, { fields: [notionSyncConfigs.connection_id], references: [notionConnections.id] }),
  project: one(projects, { fields: [notionSyncConfigs.project_id], references: [projects.id] }),
}))

export const notionIssueSyncsRelations = relations(notionIssueSyncs, ({ one }) => ({
  connection: one(notionConnections, { fields: [notionIssueSyncs.connection_id], references: [notionConnections.id] }),
  issue: one(issues, { fields: [notionIssueSyncs.issue_id], references: [issues.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: HubSpot
// ---------------------------------------------------------------------------

export const hubspotConnectionsRelations = relations(hubspotConnections, ({ one, many }) => ({
  project: one(projects, { fields: [hubspotConnections.project_id], references: [projects.id] }),
  syncRuns: many(hubspotSyncRuns),
  syncedCompanies: many(hubspotSyncedCompanies),
  syncedContacts: many(hubspotSyncedContacts),
}))

export const hubspotSyncRunsRelations = relations(hubspotSyncRuns, ({ one }) => ({
  connection: one(hubspotConnections, { fields: [hubspotSyncRuns.connection_id], references: [hubspotConnections.id] }),
}))

export const hubspotSyncedCompaniesRelations = relations(hubspotSyncedCompanies, ({ one }) => ({
  connection: one(hubspotConnections, { fields: [hubspotSyncedCompanies.connection_id], references: [hubspotConnections.id] }),
  company: one(companies, { fields: [hubspotSyncedCompanies.company_id], references: [companies.id] }),
}))

export const hubspotSyncedContactsRelations = relations(hubspotSyncedContacts, ({ one }) => ({
  connection: one(hubspotConnections, { fields: [hubspotSyncedContacts.connection_id], references: [hubspotConnections.id] }),
  contact: one(contacts, { fields: [hubspotSyncedContacts.contact_id], references: [contacts.id] }),
}))

// ---------------------------------------------------------------------------
// Integrations: Fathom
// ---------------------------------------------------------------------------

export const fathomConnectionsRelations = relations(fathomConnections, ({ one, many }) => ({
  project: one(projects, { fields: [fathomConnections.project_id], references: [projects.id] }),
  syncRuns: many(fathomSyncRuns),
  syncedMeetings: many(fathomSyncedMeetings),
}))

export const fathomSyncRunsRelations = relations(fathomSyncRuns, ({ one }) => ({
  connection: one(fathomConnections, { fields: [fathomSyncRuns.connection_id], references: [fathomConnections.id] }),
}))

export const fathomSyncedMeetingsRelations = relations(fathomSyncedMeetings, ({ one }) => ({
  connection: one(fathomConnections, { fields: [fathomSyncedMeetings.connection_id], references: [fathomConnections.id] }),
}))

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  project: one(projects, { fields: [userNotifications.project_id], references: [projects.id] }),
}))
