/**
 * MCP Resource Adapter Types
 *
 * Shared types for the resource adapter layer that bridges
 * MCP tools to Hissuno's data layer.
 */

export const RESOURCE_TYPES = ['knowledge', 'feedback', 'issues', 'customers'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export interface ResourceListItem {
  id: string
  name: string
  description: string
  metadata: Record<string, string>
}

export interface ResourceDetail {
  id: string
  type: ResourceType
  markdown: string
}

export interface SearchResult {
  id: string
  type: ResourceType
  name: string
  snippet: string
  score?: number
}

export interface AddResult {
  id: string
  type: ResourceType
  name: string
}

export interface ResourceAdapter {
  list(projectId: string, filters: Record<string, unknown>): Promise<{ items: ResourceListItem[]; total: number }>
  get(projectId: string, id: string): Promise<ResourceDetail | null>
  search(projectId: string, query: string, limit: number): Promise<SearchResult[]>
  add(projectId: string, data: Record<string, unknown>): Promise<AddResult>
}
