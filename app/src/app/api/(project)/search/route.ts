import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { searchSessions } from '@/lib/sessions/sessions-service'
import { searchIssues } from '@/lib/issues/issues-service'
import { searchCustomers } from '@/lib/customers/customers-service'
import { searchKnowledge } from '@/lib/knowledge/knowledge-service'
import { searchScopes } from '@/lib/product-scopes/product-scopes-service'
import type { SearchMode } from '@/lib/search/search-by-mode'

export const runtime = 'nodejs'

const VALID_MODES = new Set<string>(['semantic', 'keyword', 'both'])

const RESOURCE_TYPES = ['knowledge', 'feedback', 'issues', 'customers', 'scopes'] as const
type ResourceType = (typeof RESOURCE_TYPES)[number]

const VALID_TYPES = new Set<string>(RESOURCE_TYPES)

interface SearchResult {
  id: string
  type: ResourceType
  name: string
  snippet: string
  score?: number
  subtype?: string
}

async function searchByType(
  type: ResourceType,
  projectId: string,
  query: string,
  limit: number,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchResult[]> {
  switch (type) {
    case 'feedback': {
      const results = await searchSessions(projectId, query, limit, options)
      return results.map((r) => ({ ...r, type: 'feedback' as const }))
    }
    case 'issues': {
      const results = await searchIssues(projectId, query, limit, options)
      return results.map((r) => ({ ...r, type: 'issues' as const }))
    }
    case 'customers': {
      const results = await searchCustomers(projectId, query, limit, options)
      return results.map((r) => ({ ...r, type: 'customers' as const, subtype: r.subtype }))
    }
    case 'knowledge': {
      const results = await searchKnowledge(projectId, query, limit, options)
      return results.map((r) => ({ ...r, type: 'knowledge' as const }))
    }
    case 'scopes': {
      const results = await searchScopes(projectId, query, limit, options)
      return results.map((r) => ({ ...r, type: 'scopes' as const }))
    }
  }
}

/**
 * GET /api/search?projectId=...&q=...&type=...&limit=...&mode=...&threshold=...
 *
 * Searches across project resources using the service layer.
 *
 * Query params:
 * - q (required) - search query
 * - type (optional) - knowledge|feedback|issues|customers|scopes
 * - limit (optional, default 10, max 20)
 * - mode (optional, default 'semantic') - semantic|keyword|both
 * - threshold (optional) - similarity threshold for semantic search (0-1)
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[search.get] Database must be configured to search resources')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q')
    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'q query parameter is required.' }, { status: 400 })
    }

    const typeParam = searchParams.get('type')
    if (typeParam && !VALID_TYPES.has(typeParam)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${RESOURCE_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const modeParam = searchParams.get('mode')
    if (modeParam && !VALID_MODES.has(modeParam)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be one of: semantic, keyword, both' },
        { status: 400 }
      )
    }
    const mode = (modeParam as SearchMode) || undefined

    const thresholdParam = searchParams.get('threshold')
    let threshold: number | undefined
    if (thresholdParam) {
      const parsed = parseFloat(thresholdParam)
      if (isNaN(parsed) || parsed < 0 || parsed > 1) {
        return NextResponse.json(
          { error: 'Invalid threshold. Must be a number between 0 and 1.' },
          { status: 400 }
        )
      }
      threshold = parsed
    }

    const searchOptions = { mode, threshold }

    const limitParam = searchParams.get('limit')
    let limit = 10
    if (limitParam) {
      const parsed = parseInt(limitParam, 10)
      if (isNaN(parsed) || parsed < 1) {
        limit = 10
      } else {
        limit = Math.min(parsed, 20)
      }
    }

    let allResults: SearchResult[]

    if (typeParam) {
      allResults = await searchByType(typeParam as ResourceType, projectId, query.trim(), limit, searchOptions)
    } else {
      // Search all types in parallel
      const results = await Promise.allSettled(
        RESOURCE_TYPES.map((type) => searchByType(type, projectId, query.trim(), limit, searchOptions))
      )

      allResults = []
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === 'fulfilled') {
          allResults.push(...result.value)
        } else {
          console.warn(`[search.get] ${RESOURCE_TYPES[i]} search failed:`, result.reason)
        }
      }

      // Sort: scored results first (descending), then unscored
      allResults.sort((a, b) => {
        if (a.score != null && b.score != null) return b.score - a.score
        if (a.score != null) return -1
        if (b.score != null) return 1
        return 0
      })
    }

    console.log(`[search.get] query="${query}" type=${typeParam ?? 'all'} mode=${mode ?? 'semantic'} results=${allResults.length}`)

    return NextResponse.json({ results: allResults, total: allResults.length })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[search.get] unexpected error', error)
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 })
  }
}
