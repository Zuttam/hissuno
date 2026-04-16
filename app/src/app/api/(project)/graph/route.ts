import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getBulkGraphData } from '@/lib/db/queries/graph'
import { entityTypeToCategory } from '@/components/graph/types'

export const runtime = 'nodejs'

/**
 * GET /api/graph?projectId=...
 * Returns all graph nodes and edges for the project in a single bulk request.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const includeOrphans = request.nextUrl.searchParams.get('includeOrphans') !== 'false'

    const data = await getBulkGraphData(projectId, { includeOrphans })

    const nodes = data.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      category: entityTypeToCategory(node.type),
      label: node.label,
      sublabel: node.sublabel,
      ...(node.parentId ? { parentId: node.parentId } : {}),
    }))

    const edges = data.edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      sourceType: edge.sourceType,
      targetType: edge.targetType,
      metadata: edge.metadata,
      ...(edge.edgeType ? { edgeType: edge.edgeType } : {}),
    }))

    console.log(`[graph.GET] includeOrphans=${includeOrphans}, nodes=${nodes.length}, edges=${edges.length}`)

    return NextResponse.json({ nodes, edges })
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
    console.error('[graph.GET] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load graph data.' }, { status: 500 })
  }
}
