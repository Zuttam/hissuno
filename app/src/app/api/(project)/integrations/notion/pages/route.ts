/**
 * Notion pages API route.
 * GET - Search/list Notion pages accessible by the integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getNotionCredentials } from '@/lib/integrations/notion'
import { NotionClient, type NotionSearchResult } from '@/lib/integrations/notion/client'

export const runtime = 'nodejs'

/**
 * Extract a display title from a Notion search result.
 * Pages have properties.title or a "Name" property; databases have a top-level title array.
 */
function extractTitle(result: NotionSearchResult): string {
  // Database: top-level title array
  if (result.object === 'database' && result.title && Array.isArray(result.title)) {
    return result.title.map((t) => t.plain_text).join('') || 'Untitled'
  }

  // Page: look for properties.title or properties.Name (both are rich-text arrays)
  if (result.properties) {
    const props = result.properties as Record<string, { type?: string; title?: { plain_text: string }[] }>

    // Direct "title" property (common for pages)
    if (props.title && Array.isArray(props.title.title)) {
      return props.title.title.map((t) => t.plain_text).join('') || 'Untitled'
    }

    // Look for any property with type "title"
    for (const key of Object.keys(props)) {
      const prop = props[key]
      if (prop.type === 'title' && Array.isArray(prop.title)) {
        return prop.title.map((t) => t.plain_text).join('') || 'Untitled'
      }
    }
  }

  return 'Untitled'
}

/**
 * Extract icon string from a Notion result.
 */
function extractIcon(result: NotionSearchResult): string | null {
  if (!result.icon) return null
  if (result.icon.emoji) return result.icon.emoji
  if (result.icon.external?.url) return result.icon.external.url
  return null
}

/**
 * GET /api/integrations/notion/pages?projectId=xxx&query=yyy&startCursor=zzz
 * Search/list Notion pages
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.pages] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const query = request.nextUrl.searchParams.get('query') || undefined
    const startCursor = request.nextUrl.searchParams.get('startCursor') || undefined

    // Get stored credentials
    const credentials = await getNotionCredentials(projectId)
    if (!credentials) {
      return NextResponse.json({ error: 'Notion is not connected for this project.' }, { status: 404 })
    }

    const client = new NotionClient(credentials.accessToken)

    const searchResult = await client.search({
      query,
      filter: { property: 'object', value: 'page' },
      startCursor,
    })

    const pages = searchResult.results.map((result) => ({
      id: result.id,
      title: extractTitle(result),
      icon: extractIcon(result),
      url: result.url,
      lastEditedTime: result.last_edited_time,
      type: result.object,
    }))

    return NextResponse.json({
      pages,
      nextCursor: searchResult.next_cursor,
      hasMore: searchResult.has_more,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[integrations.notion.pages] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch Notion pages.' }, { status: 500 })
  }
}
