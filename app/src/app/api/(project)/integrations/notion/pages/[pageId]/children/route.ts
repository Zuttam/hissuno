/**
 * Notion page children API route.
 * GET - Get child pages of a page or database
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getNotionCredentials } from '@/lib/integrations/notion'
import { NotionClient, type NotionPage } from '@/lib/integrations/notion/client'

export const runtime = 'nodejs'

/**
 * Extract a display title from a Notion page result.
 */
function extractPageTitle(page: NotionPage): string {
  if (page.properties) {
    const props = page.properties as Record<string, { type?: string; title?: { plain_text: string }[] }>

    // Direct "title" property
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
 * Extract icon string from a Notion page.
 */
function extractPageIcon(page: NotionPage): string | null {
  if (!page.icon) return null
  if (page.icon.emoji) return page.icon.emoji
  if (page.icon.external?.url) return page.icon.external.url
  return null
}

/**
 * GET /api/integrations/notion/pages/[pageId]/children?projectId=xxx
 * Get child pages of a Notion page or database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.pages.children] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const { pageId } = await params
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get stored credentials
    const credentials = await getNotionCredentials(projectId)
    if (!credentials) {
      return NextResponse.json({ error: 'Notion is not connected for this project.' }, { status: 404 })
    }

    const client = new NotionClient(credentials.accessToken)

    // Try querying as a database first (databases contain pages as children)
    const result = await client.getDatabasePages(pageId)

    const pages = result.results.map((page: NotionPage) => ({
      id: page.id,
      title: extractPageTitle(page),
      icon: extractPageIcon(page),
      url: page.url,
      lastEditedTime: page.last_edited_time,
      type: 'page' as const,
    }))

    return NextResponse.json({
      pages,
      nextCursor: result.next_cursor,
      hasMore: result.has_more,
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

    console.error('[integrations.notion.pages.children] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch Notion child pages.' }, { status: 500 })
  }
}
