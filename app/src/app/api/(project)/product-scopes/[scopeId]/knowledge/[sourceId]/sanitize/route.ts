import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources, entityRelationships } from '@/lib/db/schema/app'
import { sanitizeContent } from '@/lib/knowledge/sanitize-content'
import { embedKnowledgeSource } from '@/lib/knowledge/embedding-service'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ scopeId: string; sourceId: string }> }

/**
 * POST /api/product-scopes/[scopeId]/knowledge/[sourceId]/sanitize?projectId=...
 * Redacts sensitive information from the source's analyzed_content and
 * re-embeds. No-op if the source has no analyzed content yet.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { scopeId, sourceId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const [link] = await db
      .select({ id: entityRelationships.id })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.project_id, projectId),
          eq(entityRelationships.knowledge_source_id, sourceId),
          eq(entityRelationships.product_scope_id, scopeId),
        ),
      )
      .limit(1)
    if (!link) {
      return NextResponse.json({ error: 'Source not found in scope.' }, { status: 404 })
    }

    const [source] = await db
      .select({
        id: knowledgeSources.id,
        analyzed_content: knowledgeSources.analyzed_content,
      })
      .from(knowledgeSources)
      .where(and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId),
      ))
      .limit(1)

    if (!source) {
      return NextResponse.json({ error: 'Source not found.' }, { status: 404 })
    }

    if (!source.analyzed_content) {
      return NextResponse.json({ sourceId, redactions: 0, changed: false, skipped: 'no_content' })
    }

    const result = await sanitizeContent(source.analyzed_content, { projectId })

    if (!result.changed) {
      return NextResponse.json({ sourceId, redactions: 0, changed: false })
    }

    await db
      .update(knowledgeSources)
      .set({ analyzed_content: result.sanitized, analyzed_at: new Date() })
      .where(eq(knowledgeSources.id, sourceId))

    const embedResult = await embedKnowledgeSource({
      id: sourceId,
      project_id: projectId,
      analyzed_content: result.sanitized,
    })

    return NextResponse.json({
      sourceId,
      redactions: result.redactions,
      changed: true,
      chunksEmbedded: embedResult.chunksEmbedded,
    })
  } catch (error) {
    if (error instanceof MissingProjectIdError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    console.error('[source.sanitize] unexpected error', error)
    return NextResponse.json({ error: 'Failed to sanitize source.' }, { status: 500 })
  }
}
