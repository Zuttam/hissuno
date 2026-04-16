import { fetchApi, buildUrl } from './fetch'

export interface SearchResult {
  id: string
  type: string
  name: string
  snippet: string
  score?: number
  subtype?: string
}

interface SearchResponse {
  results: SearchResult[]
  total: number
}

export interface SearchOptions {
  type?: string
  limit?: number
  mode?: 'semantic' | 'keyword' | 'both'
  threshold?: number
}

export async function searchResources(
  projectId: string,
  query: string,
  options?: SearchOptions,
): Promise<SearchResponse> {
  return fetchApi<SearchResponse>(
    buildUrl('/api/search', { projectId, q: query, ...options }),
    { errorMessage: 'Search failed.' },
  )
}
