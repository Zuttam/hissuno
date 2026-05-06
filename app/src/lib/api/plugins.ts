/**
 * Client helpers for the plugin API (`/api/(project)/plugins/[pluginId]/...`).
 *
 * Plugins are connect-only — sync logic lives in automation skills. Calls
 * here are limited to listing connections and managing the connect/disconnect
 * lifecycle.
 */

export interface PluginConnection {
  id: string
  pluginId: string
  accountLabel: string
  externalAccountId: string
  createdAt: string | null
  updatedAt: string | null
  settings: Record<string, unknown> | null
}

export interface PluginConnectionsResponse {
  plugin: { id: string; name: string; multiInstance: boolean }
  connections: PluginConnection[]
}

export async function fetchPluginConnections(
  pluginId: string,
  projectId: string
): Promise<PluginConnectionsResponse> {
  const res = await fetch(`/api/plugins/${pluginId}?projectId=${encodeURIComponent(projectId)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to load ${pluginId} connections.`)
  }
  return res.json() as Promise<PluginConnectionsResponse>
}

export interface ConnectResponse {
  connectionId?: string
  authorizeUrl?: string
  error?: string
}

export async function connectPlugin(
  pluginId: string,
  projectId: string,
  body: Record<string, unknown> = {}
): Promise<ConnectResponse> {
  const res = await fetch(`/api/plugins/${pluginId}/connect?projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as ConnectResponse
  if (!res.ok && !data.authorizeUrl) {
    throw new Error(data.error ?? `Failed to connect ${pluginId}.`)
  }
  return data
}

export async function disconnectPluginConnection(
  pluginId: string,
  connectionId: string,
  projectId: string
): Promise<void> {
  const res = await fetch(
    `/api/plugins/${pluginId}/${connectionId}?projectId=${encodeURIComponent(projectId)}`,
    { method: 'DELETE' }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to disconnect.`)
  }
}

export async function updatePluginConnection(
  pluginId: string,
  connectionId: string,
  projectId: string,
  body: { accountLabel?: string; settings?: Record<string, unknown> }
): Promise<void> {
  const res = await fetch(
    `/api/plugins/${pluginId}/${connectionId}?projectId=${encodeURIComponent(projectId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Failed to update connection.`)
  }
}

// ---------------------------------------------------------------------------
// Picker helpers for the knowledge UI (GitHub + Notion custom handlers)
// ---------------------------------------------------------------------------

export interface GitHubRepoInfo {
  id: number
  name: string
  fullName: string
  defaultBranch: string
  private: boolean
  htmlUrl: string
  description: string | null
}

export interface GitHubBranchInfo {
  name: string
  commit: { sha: string }
  protected: boolean
}

interface RawGithubRepo {
  id: number
  name: string
  full_name: string
  default_branch: string
  private: boolean
  html_url: string
  description: string | null
}

async function firstConnectionId(pluginId: string, projectId: string): Promise<string | null> {
  const res = await fetch(`/api/plugins/${pluginId}?projectId=${encodeURIComponent(projectId)}`)
  if (!res.ok) return null
  const data = (await res.json()) as { connections?: Array<{ id: string }> }
  return data.connections?.[0]?.id ?? null
}

async function callPluginHandler(
  pluginId: string,
  connectionId: string,
  projectId: string,
  handler: string,
  query: Record<string, string> = {}
): Promise<Response> {
  const params = new URLSearchParams({ projectId, ...query })
  return fetch(`/api/plugins/${pluginId}/${connectionId}/${handler}?${params.toString()}`)
}

export async function fetchGithubStatus(projectId: string): Promise<Response> {
  const res = await fetch(`/api/plugins/github?projectId=${encodeURIComponent(projectId)}`)
  if (!res.ok) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const list = (await res.json()) as {
    connections: Array<{ accountLabel: string; settings: Record<string, unknown> | null }>
  }
  const conn = list.connections[0]
  if (!conn) {
    return new Response(JSON.stringify({ connected: false }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(
    JSON.stringify({
      connected: true,
      accountLogin:
        (conn.settings as { accountLogin?: string } | null)?.accountLogin ?? conn.accountLabel,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export async function fetchGithubRepos(projectId: string): Promise<{ repos: GitHubRepoInfo[] }> {
  const connectionId = await firstConnectionId('github', projectId)
  if (!connectionId) return { repos: [] }
  const res = await callPluginHandler('github', connectionId, projectId, 'repos')
  if (!res.ok) throw new Error('Failed to list GitHub repos')
  const body = (await res.json()) as { repos: RawGithubRepo[] }
  return {
    repos: body.repos.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch,
      private: r.private,
      htmlUrl: r.html_url,
      description: r.description,
    })),
  }
}

export async function fetchGithubBranches(
  projectId: string,
  owner: string,
  repo: string
): Promise<{ branches: GitHubBranchInfo[] }> {
  const connectionId = await firstConnectionId('github', projectId)
  if (!connectionId) return { branches: [] }
  const res = await callPluginHandler('github', connectionId, projectId, 'branches', {
    owner,
    repo,
  })
  if (!res.ok) throw new Error('Failed to list GitHub branches')
  return (await res.json()) as { branches: GitHubBranchInfo[] }
}

export async function fetchNotionStatus(projectId: string): Promise<Response> {
  const connectionId = await firstConnectionId('notion', projectId)
  return new Response(JSON.stringify({ connected: Boolean(connectionId) }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function fetchNotionPages(
  projectId: string,
  params: { query?: string; startCursor?: string } = {}
): Promise<Response> {
  const connectionId = await firstConnectionId('notion', projectId)
  if (!connectionId) {
    return new Response(JSON.stringify({ pages: [], hasMore: false, nextCursor: null }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const query: Record<string, string> = {}
  if (params.query) query.query = params.query
  if (params.startCursor) query.startCursor = params.startCursor
  return callPluginHandler('notion', connectionId, projectId, 'pages', query)
}

export async function fetchNotionChildPages(projectId: string, pageId: string): Promise<Response> {
  const connectionId = await firstConnectionId('notion', projectId)
  if (!connectionId) {
    return new Response(JSON.stringify({ pages: [] }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return callPluginHandler('notion', connectionId, projectId, 'childPages', { pageId })
}
