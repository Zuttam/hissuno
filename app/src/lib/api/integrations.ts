import { fetchApi, fetchApiRaw, buildUrl } from './fetch'

// ---------------------------------------------------------------------------
// Integrations Availability
// ---------------------------------------------------------------------------

export interface IntegrationAvailability {
  available: boolean
  requiredEnvVars: string[]
  oauthConfigured?: boolean
}

export interface IntegrationsAvailabilityResponse {
  integrations: Record<string, IntegrationAvailability>
}

export function fetchIntegrationsAvailability(): Promise<IntegrationsAvailabilityResponse> {
  return fetchApi<IntegrationsAvailabilityResponse>('/api/integrations/availability', {
    errorMessage: 'Failed to fetch integrations availability',
  })
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const paths = {
  // Slack
  slack: '/api/integrations/slack',
  slackChannels: '/api/integrations/slack/channels',
  slackChannelsAvailable: '/api/integrations/slack/channels/available',
  slackChannelsJoin: '/api/integrations/slack/channels/join',
  slackChannelsLeave: '/api/integrations/slack/channels/leave',
  slackConnect: '/api/integrations/slack/connect',

  // GitHub
  github: '/api/integrations/github',
  githubConnect: '/api/integrations/github/connect',

  // Intercom
  intercom: '/api/integrations/intercom',
  intercomConnect: '/api/integrations/intercom/connect',
  intercomTest: '/api/integrations/intercom/test',
  intercomSync: '/api/integrations/intercom/sync',

  // Gong
  gong: '/api/integrations/gong',
  gongConnect: '/api/integrations/gong/connect',
  gongTest: '/api/integrations/gong/test',
  gongSync: '/api/integrations/gong/sync',

  // Jira
  jira: '/api/integrations/jira',
  jiraConnect: '/api/integrations/jira/connect',
  jiraConfigure: '/api/integrations/jira/configure',
  jiraProjects: '/api/integrations/jira/projects',
  jiraIssueTypes: '/api/integrations/jira/issue-types',

  // Zendesk
  zendesk: '/api/integrations/zendesk',
  zendeskConnect: '/api/integrations/zendesk/connect',
  zendeskTest: '/api/integrations/zendesk/test',
  zendeskSync: '/api/integrations/zendesk/sync',

  // PostHog
  posthog: '/api/integrations/posthog',
  posthogConnect: '/api/integrations/posthog/connect',
  posthogSync: '/api/integrations/posthog/sync',
  posthogEventDefinitions: '/api/integrations/posthog/event-definitions',

  // Linear
  linear: '/api/integrations/linear',
  linearConnect: '/api/integrations/linear/connect',
  linearTest: '/api/integrations/linear/test',
  linearTeams: '/api/integrations/linear/teams',

  // Notion
  notion: '/api/integrations/notion',
  notionConnect: '/api/integrations/notion/connect',
  notionPages: '/api/integrations/notion/pages',

  // HubSpot
  hubspot: '/api/integrations/hubspot',
  hubspotConnect: '/api/integrations/hubspot/connect',
  hubspotTest: '/api/integrations/hubspot/test',
  hubspotSync: '/api/integrations/hubspot/sync',

  // Fathom
  fathom: '/api/integrations/fathom',
  fathomConnect: '/api/integrations/fathom/connect',
  fathomTest: '/api/integrations/fathom/test',
  fathomSync: '/api/integrations/fathom/sync',

  // Widget Settings
  widgetSettings: '/api/integrations/widget/settings',
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export function fetchWidgetStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl('/api/sessions', { projectId, stats: 'true' }))
}

export function fetchWidgetSettings<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(buildUrl(paths.widgetSettings, { projectId }), {
    errorMessage: 'Failed to load widget settings.',
  })
}

export function updateWidgetSettings<T = unknown>(projectId: string, body: unknown): Promise<T> {
  return fetchApi<T>(buildUrl(paths.widgetSettings, { projectId }), {
    method: 'PATCH',
    body,
    errorMessage: 'Failed to save widget settings.',
  })
}

// ---------------------------------------------------------------------------
// Slack
// ---------------------------------------------------------------------------

export function fetchSlackStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.slack, { projectId }))
}

export function disconnectSlack(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.slack, { projectId }), { method: 'DELETE' })
}

export function slackConnectUrl(projectId: string, nextUrl?: string): string {
  return buildUrl(paths.slackConnect, { projectId, nextUrl })
}

export function fetchSlackChannels<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(buildUrl(paths.slackChannels, { projectId }), {
    errorMessage: 'Failed to load channels',
  })
}

export function fetchSlackAvailableChannels<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(buildUrl(paths.slackChannelsAvailable, { projectId }), {
    errorMessage: 'Failed to load available channels',
  })
}

export function updateSlackChannelMode(body: {
  channelDbId?: string
  projectId?: string
  mode: string
  captureScope?: string
  applyToAll?: boolean
}): Promise<Response> {
  return fetchApiRaw(paths.slackChannels, { method: 'PATCH', body })
}

export function joinSlackChannel(projectId: string, channelId: string): Promise<Response> {
  return fetchApiRaw(paths.slackChannelsJoin, {
    method: 'POST',
    body: { projectId, channelId },
  })
}

export function leaveSlackChannel(projectId: string, channelDbId: string): Promise<Response> {
  return fetchApiRaw(paths.slackChannelsLeave, {
    method: 'POST',
    body: { projectId, channelDbId },
  })
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

export function fetchGithubStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.github, { projectId }))
}

export function disconnectGithub(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.github, { projectId }), { method: 'DELETE' })
}

export function githubConnectUrl(projectId: string, returnUrl: string): string {
  return buildUrl(paths.githubConnect, { projectId, returnUrl })
}

export function connectGithubPat(body: { projectId: string; accessToken: string }): Promise<Response> {
  return fetchApiRaw(paths.githubConnect, { method: 'POST', body })
}

export async function fetchGithubRepos(projectId: string) {
  return fetchApi<{ repos: Array<{ id: number; fullName: string; defaultBranch: string }> }>(
    buildUrl('/api/integrations/github/repos', { projectId }),
    { errorMessage: 'Failed to load repositories' },
  )
}

export async function fetchGithubBranches(projectId: string, owner: string, repo: string) {
  return fetchApi<{ branches: Array<{ name: string }> }>(
    buildUrl(`/api/integrations/github/repos/${owner}/${repo}/branches`, { projectId }),
    { errorMessage: 'Failed to load branches' },
  )
}

// ---------------------------------------------------------------------------
// Intercom
// ---------------------------------------------------------------------------

export function fetchIntercomStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.intercom, { projectId }))
}

export function disconnectIntercom(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.intercom, { projectId }), { method: 'DELETE' })
}

export function updateIntercomSettings(projectId: string, body: unknown): Promise<Response> {
  return fetchApiRaw(paths.intercom, {
    method: 'PATCH',
    body: { projectId, ...(body as Record<string, unknown>) },
  })
}

export function testIntercomConnection(accessToken: string): Promise<Response> {
  return fetchApiRaw(paths.intercomTest, {
    method: 'POST',
    body: { accessToken },
  })
}

export function connectIntercom(body: {
  projectId: string
  accessToken: string
  syncFrequency?: string
  filterConfig?: unknown
}): Promise<Response> {
  return fetchApiRaw(paths.intercomConnect, { method: 'POST', body })
}

export function intercomOAuthConnectUrl(projectId: string): string {
  return buildUrl(paths.intercomConnect, { projectId })
}

export function intercomSyncUrl(projectId: string, mode: string): string {
  return buildUrl(paths.intercomSync, { projectId, mode })
}

// ---------------------------------------------------------------------------
// Gong
// ---------------------------------------------------------------------------

export function fetchGongStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.gong, { projectId }))
}

export function disconnectGong(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.gong, { projectId }), { method: 'DELETE' })
}

export function updateGongSettings(projectId: string, body: unknown): Promise<Response> {
  return fetchApiRaw(paths.gong, {
    method: 'PATCH',
    body: { projectId, ...(body as Record<string, unknown>) },
  })
}

export function testGongConnection(body: {
  baseUrl: string
  accessKey: string
  accessKeySecret: string
}): Promise<Response> {
  return fetchApiRaw(paths.gongTest, { method: 'POST', body })
}

export function connectGong(body: {
  projectId: string
  baseUrl: string
  accessKey: string
  accessKeySecret: string
  syncFrequency?: string
  filterConfig?: unknown
}): Promise<Response> {
  return fetchApiRaw(paths.gongConnect, { method: 'POST', body })
}

export function gongSyncUrl(projectId: string, mode: string): string {
  return buildUrl(paths.gongSync, { projectId, mode })
}

// ---------------------------------------------------------------------------
// Jira
// ---------------------------------------------------------------------------

export function fetchJiraStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.jira, { projectId }))
}

export function disconnectJira(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.jira, { projectId }), { method: 'DELETE' })
}

export function jiraConnectUrl(projectId: string): string {
  return buildUrl(paths.jiraConnect, { projectId })
}

export function fetchJiraProjects<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(buildUrl(paths.jiraProjects, { projectId }), {
    errorMessage: 'Failed to fetch Jira projects',
  })
}

export function fetchJiraIssueTypes<T = unknown>(projectId: string, jiraProjectKey: string): Promise<T> {
  return fetchApi<T>(buildUrl(paths.jiraIssueTypes, { projectId, jiraProjectKey }), {
    errorMessage: 'Failed to fetch issue types',
  })
}

export function configureJira(body: {
  projectId: string
  jiraProjectKey: string
  jiraProjectId: string
  issueTypeId: string
  issueTypeName: string
  autoSyncEnabled?: boolean
}): Promise<Response> {
  return fetchApiRaw(paths.jiraConfigure, { method: 'POST', body })
}

// ---------------------------------------------------------------------------
// Zendesk
// ---------------------------------------------------------------------------

export function fetchZendeskStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.zendesk, { projectId }))
}

export function disconnectZendesk(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.zendesk, { projectId }), { method: 'DELETE' })
}

export function updateZendeskSettings(projectId: string, body: unknown): Promise<Response> {
  return fetchApiRaw(paths.zendesk, {
    method: 'PATCH',
    body: { projectId, ...(body as Record<string, unknown>) },
  })
}

export function testZendeskConnection(body: {
  subdomain: string
  email: string
  apiToken: string
}): Promise<Response> {
  return fetchApiRaw(paths.zendeskTest, { method: 'POST', body })
}

export function connectZendesk(body: {
  projectId: string
  subdomain: string
  email: string
  apiToken: string
  syncFrequency?: string
  filterConfig?: unknown
}): Promise<Response> {
  return fetchApiRaw(paths.zendeskConnect, { method: 'POST', body })
}

export function zendeskSyncUrl(projectId: string, mode: string): string {
  return buildUrl(paths.zendeskSync, { projectId, mode })
}

// ---------------------------------------------------------------------------
// Linear
// ---------------------------------------------------------------------------

export function fetchLinearStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.linear, { projectId }))
}

export function disconnectLinear(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.linear, { projectId }), { method: 'DELETE' })
}

export function updateLinearConfig(body: {
  projectId: string
  teamId: string
  teamName: string
  teamKey: string
  autoSyncEnabled?: boolean
}): Promise<Response> {
  return fetchApiRaw(paths.linear, { method: 'PATCH', body })
}

export function linearConnectUrl(projectId: string): string {
  return buildUrl(paths.linearConnect, { projectId })
}

export function fetchLinearTeams<T = unknown>(projectId: string): Promise<T> {
  return fetchApi<T>(buildUrl(paths.linearTeams, { projectId }), {
    errorMessage: 'Failed to fetch Linear teams',
  })
}

export function testLinearApiKey(apiKey: string): Promise<Response> {
  return fetchApiRaw(paths.linearTest, {
    method: 'POST',
    body: { apiKey },
  })
}

export function connectLinearWithApiKey(body: { projectId: string; apiKey: string }): Promise<Response> {
  return fetchApiRaw(paths.linearConnect, { method: 'POST', body })
}

// ---------------------------------------------------------------------------
// PostHog
// ---------------------------------------------------------------------------

export function fetchPosthogStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.posthog, { projectId }))
}

export function disconnectPosthog(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.posthog, { projectId }), { method: 'DELETE' })
}

export function updatePosthogSettings(projectId: string, body: unknown): Promise<Response> {
  return fetchApiRaw(paths.posthog, {
    method: 'PATCH',
    body: { projectId, ...(body as Record<string, unknown>) },
  })
}

export function connectPosthog(body: {
  projectId: string
  apiKey: string
  host?: string
  posthogProjectId: string
  syncFrequency?: string
  filterConfig?: unknown
}): Promise<Response> {
  return fetchApiRaw(paths.posthogConnect, { method: 'POST', body })
}

export function posthogSyncUrl(projectId: string): string {
  return buildUrl(paths.posthogSync, { projectId })
}

export function fetchPosthogEventDefinitions(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.posthogEventDefinitions, { projectId }))
}

// ---------------------------------------------------------------------------
// Notion
// ---------------------------------------------------------------------------

export function fetchNotionStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.notion, { projectId }))
}

export function disconnectNotion(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.notion, { projectId }), { method: 'DELETE' })
}

export function notionConnectUrl(projectId: string): string {
  return buildUrl(paths.notionConnect, { projectId })
}

export function connectNotionToken(body: { projectId: string; accessToken: string }): Promise<Response> {
  return fetchApiRaw(paths.notionConnect, { method: 'POST', body })
}

export function fetchNotionPages(projectId: string, params?: { query?: string; startCursor?: string }): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.notionPages, { projectId, ...params }))
}

export function fetchNotionChildPages(projectId: string, pageId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(`/api/integrations/notion/pages/${pageId}/children`, { projectId }))
}

// ---------------------------------------------------------------------------
// HubSpot
// ---------------------------------------------------------------------------

export function fetchHubSpotStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.hubspot, { projectId }))
}

export function disconnectHubSpot(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.hubspot, { projectId }), { method: 'DELETE' })
}

export function updateHubSpotSettings(projectId: string, body: unknown): Promise<Response> {
  return fetchApiRaw(paths.hubspot, {
    method: 'PATCH',
    body: { projectId, ...(body as Record<string, unknown>) },
  })
}

export function testHubSpotConnection(accessToken: string): Promise<Response> {
  return fetchApiRaw(paths.hubspotTest, {
    method: 'POST',
    body: { accessToken },
  })
}

export function connectHubSpot(body: {
  projectId: string
  accessToken: string
  syncFrequency?: string
  filterConfig?: unknown
}): Promise<Response> {
  return fetchApiRaw(paths.hubspotConnect, { method: 'POST', body })
}

export function hubspotOAuthConnectUrl(projectId: string): string {
  return buildUrl(paths.hubspotConnect, { projectId })
}

export function hubspotSyncUrl(projectId: string, mode: string): string {
  return buildUrl(paths.hubspotSync, { projectId, mode })
}

// ---------------------------------------------------------------------------
// Fathom
// ---------------------------------------------------------------------------

export function fetchFathomStatus(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.fathom, { projectId }))
}

export function disconnectFathom(projectId: string): Promise<Response> {
  return fetchApiRaw(buildUrl(paths.fathom, { projectId }), { method: 'DELETE' })
}

export function updateFathomSettings(projectId: string, body: unknown): Promise<Response> {
  return fetchApiRaw(paths.fathom, {
    method: 'PATCH',
    body: { projectId, ...(body as Record<string, unknown>) },
  })
}

export function testFathomConnection(apiKey: string): Promise<Response> {
  return fetchApiRaw(paths.fathomTest, {
    method: 'POST',
    body: { apiKey },
  })
}

export function connectFathom(body: {
  projectId: string
  apiKey: string
  syncFrequency?: string
  filterConfig?: unknown
}): Promise<Response> {
  return fetchApiRaw(paths.fathomConnect, { method: 'POST', body })
}

export function fathomSyncUrl(projectId: string, mode: string): string {
  return buildUrl(paths.fathomSync, { projectId, mode })
}

