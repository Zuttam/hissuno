/**
 * Notion database schema API route.
 * GET - Get the properties/columns of a specific Notion database
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getNotionCredentials } from '@/lib/integrations/notion'
import { NotionClient } from '@/lib/integrations/notion/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/notion/databases/:databaseId?projectId=xxx
 * Get the schema (properties) of a specific Notion database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ databaseId: string }> }
) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.database-schema] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const { databaseId } = await params
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get stored credentials
    const credentials = await getNotionCredentials(projectId)
    if (!credentials) {
      return NextResponse.json({ error: 'Notion is not connected for this project.' }, { status: 404 })
    }

    const client = new NotionClient(credentials.accessToken)
    const database = await client.getDatabase(databaseId)

    const properties = Object.entries(database.properties).map(([name, prop]) => ({
      id: prop.id,
      name,
      type: prop.type,
      options: prop.select?.options || prop.multi_select?.options || prop.status?.options || undefined,
    }))

    return NextResponse.json({ properties })
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

    console.error('[integrations.notion.database-schema] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch database schema.' }, { status: 500 })
  }
}
