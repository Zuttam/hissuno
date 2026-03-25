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

export const runtime = 'nodejs'

const RESOURCE_TYPES = ['knowledge', 'feedback', 'issues', 'customers'] as const
type ResourceType = (typeof RESOURCE_TYPES)[number]

const VALID_TYPES = new Set<string>(RESOURCE_TYPES)

interface SearchResult {
  id: string
  type: ResourceType
  name: string
  snippet: string
  score?: number
}

async function searchByType(
  type: ResourceType,
  projectId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  switch (type) {
    case 'feedback': {
      const results = await searchSessions(projectId, query, limit)
      return results.map((r) => ({ ...r, type: 'feedback' as const }))
    }
    case 'issues': {
      const results = await searchIssues(projectId, query, limit)
      return results.map((r) => ({ ...r, type: 'issues' as const }))
    }
    case 'customers': {
      const results = await searchCustomers(projectId, query, limit)
      return results.map((r) => ({ ...r, type: 'customers' as const }))
    }
    case 'knowledge': {
      const results = await searchKnowledge(projectId, query, limit)
      return results.map((r) => ({ ...r, type: 'knowledge' as const }))
    }
  }
}

/**
 * GET /api/search?projectId=...&q=...&type=...&limit=...
 *
 * Searches across project resources using the service layer.
 *
 * Query params:
 * - q (required) - search query
 * - type (optional) - knowledge|feedback|issues|customers
 * - limit (optional, default 10, max 20)
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
      allResults = await searchByType(typeParam as ResourceType, projectId, query.trim(), limit)
    } else {
      // Search all types in parallel
      const results = await Promise.allSettled(
        RESOURCE_TYPES.map((type) => searchByType(type, projectId, query.trim(), limit))
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

    console.log(`[search.get] query="${query}" type=${typeParam ?? 'all'} results=${allResults.length}`)

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
