import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources, entityRelationships, productScopes } from '@/lib/db/schema/app'
import { uploadDocument, validateUploadedFile } from '@/lib/knowledge/storage'
import type { KnowledgeSourceType, KnowledgeSourceInsert } from '@/lib/knowledge/types'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import {
  createKnowledgeSource,
  createKnowledgeSourceBulkAdmin,
} from '@/lib/knowledge/knowledge-service'
import { getRateLimiter } from '@/lib/utils/rate-limiter'
import { upsertExternalRecord } from '@/lib/db/queries/external-records'
import { hasNotionConnection } from '@/lib/integrations/notion'

export const runtime = 'nodejs'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_UPLOADS = 20

const USER_ADDABLE_TYPES: KnowledgeSourceType[] = [
  'website',
  'docs_portal',
  'uploaded_doc',
  'raw_text',
  'notion',
]

function isUserAddableType(type: string): type is KnowledgeSourceType {
  return USER_ADDABLE_TYPES.includes(type as KnowledgeSourceType)
}

type RouteParams = { scopeId: string }
type RouteContext = { params: Promise<RouteParams> }

async function assertScopeInProject(scopeId: string, projectId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: productScopes.id })
    .from(productScopes)
    .where(and(eq(productScopes.id, scopeId), eq(productScopes.project_id, projectId)))
    .limit(1)
  return Boolean(row)
}

/**
 * GET /api/product-scopes/[scopeId]/knowledge?projectId=...
 * List knowledge sources linked to a scope.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { scopeId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    if (!(await assertScopeInProject(scopeId, projectId))) {
      return NextResponse.json({ error: 'Scope not found.' }, { status: 404 })
    }

    const links = await db
      .select({ knowledge_source_id: entityRelationships.knowledge_source_id })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.project_id, projectId),
          eq(entityRelationships.product_scope_id, scopeId),
        ),
      )

    const sourceIds = links
      .map((l) => l.knowledge_source_id)
      .filter((id): id is string => Boolean(id))

    if (sourceIds.length === 0) {
      return NextResponse.json({ sources: [] })
    }

    const data = await db.query.knowledgeSources.findMany({
      where: and(
        eq(knowledgeSources.project_id, projectId),
        inArray(knowledgeSources.id, sourceIds),
      ),
      orderBy: [desc(knowledgeSources.created_at)],
    })

    return NextResponse.json({ sources: data.map((s) => ({ ...s, product_scope_id: scopeId })) })
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

    console.error('[scope-knowledge.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load sources.' }, { status: 500 })
  }
}

/**
 * POST /api/product-scopes/[scopeId]/knowledge?projectId=...
 * Create a knowledge source attached to this scope.
 *
 * Supports JSON ({ type, url?, content?, ... }) and FormData (uploaded_doc).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { scopeId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    if (!(await assertScopeInProject(scopeId, projectId))) {
      return NextResponse.json({ error: 'Scope not found.' }, { status: 404 })
    }

    const contentType = request.headers.get('content-type') ?? ''
    let sourceData: KnowledgeSourceInsert
    let external_id: string | undefined
    let external_source: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const type = formData.get('type')?.toString()
      const url = formData.get('url')?.toString()
      const content = formData.get('content')?.toString()
      const file = formData.get('file') as File | null

      if (!type || !isUserAddableType(type)) {
        return NextResponse.json({ error: 'Invalid or missing source type.' }, { status: 400 })
      }

      sourceData = {
        project_id: projectId,
        type,
        url: url || null,
        content: content || null,
        storage_path: null,
        status: 'pending',
        enabled: true,
      }

      if (type === 'uploaded_doc') {
        if (!file) {
          return NextResponse.json({ error: 'File is required for uploaded_doc type.' }, { status: 400 })
        }

        const allowed = await getRateLimiter().check(
          `knowledge-upload:${actingUserId}`,
          RATE_LIMIT_WINDOW_MS,
          RATE_LIMIT_MAX_UPLOADS,
        )
        if (!allowed) {
          return NextResponse.json(
            { error: 'Upload rate limit exceeded. Please wait before uploading more files.' },
            { status: 429 },
          )
        }

        const validationError = await validateUploadedFile(file)
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 })
        }

        const { path, error: uploadError } = await uploadDocument(projectId, file)
        if (uploadError) {
          console.error('[scope-knowledge.post] failed to upload document', uploadError)
          return NextResponse.json({ error: 'Failed to upload document.' }, { status: 500 })
        }

        sourceData.storage_path = path
      }
    } else {
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
      }

      const { type, url, content, name, description, notionPageId, pages, custom_fields, parent_id, origin } = payload
      if (typeof payload.external_id === 'string') external_id = payload.external_id
      if (typeof payload.external_source === 'string') external_source = payload.external_source

      if (type === 'folder') {
        const data = await createKnowledgeSource({
          projectId,
          type: 'folder',
          name: name || 'Untitled folder',
          parentId: parent_id || null,
          productScopeId: scopeId,
          skipInlineProcessing: true,
        })
        if (!data) {
          return NextResponse.json({ error: 'Failed to create folder.' }, { status: 500 })
        }
        return NextResponse.json({ source: { ...data, product_scope_id: scopeId } }, { status: 201 })
      }

      if (type === 'notion_bulk') {
        if (!Array.isArray(pages) || pages.length === 0) {
          return NextResponse.json({ error: 'pages array is required for notion_bulk type.' }, { status: 400 })
        }

        if (pages.length > 500) {
          return NextResponse.json({ error: 'Too many pages. Maximum is 500.' }, { status: 400 })
        }

        const notionStatus = await hasNotionConnection(projectId)
        if (!notionStatus.connected) {
          return NextResponse.json({ error: 'Notion integration not connected.' }, { status: 400 })
        }

        const values = (pages as Array<{ pageId: string; title: string; url: string }>).map((page) => ({
          type: 'notion' as const,
          notionPageId: page.pageId,
          name: page.title,
          url: page.url,
          productScopeId: scopeId,
        }))

        const inserted = await createKnowledgeSourceBulkAdmin(projectId, values)
        return NextResponse.json({ sources: inserted }, { status: 201 })
      }

      if (!type || !isUserAddableType(type)) {
        return NextResponse.json({ error: 'Invalid or missing source type.' }, { status: 400 })
      }

      if ((type === 'website' || type === 'docs_portal') && !url) {
        return NextResponse.json({ error: 'URL is required for website/docs_portal sources.' }, { status: 400 })
      }

      if (type === 'raw_text' && !content) {
        return NextResponse.json({ error: 'Content is required for raw_text sources.' }, { status: 400 })
      }

      sourceData = {
        project_id: projectId,
        type,
        url: url || null,
        content: content || null,
        storage_path: null,
        status: 'pending',
        enabled: true,
        name: name || null,
        description: description || null,
        notion_page_id: (type === 'notion' || (type === 'uploaded_doc' && origin === 'notion')) ? (notionPageId || null) : null,
        origin: type === 'uploaded_doc' ? (origin || 'upload') : null,
        custom_fields: custom_fields || null,
        parent_id: parent_id || null,
      }
    }

    const data = await createKnowledgeSource({
      projectId,
      type: sourceData.type,
      name: sourceData.name ?? null,
      description: sourceData.description ?? null,
      url: sourceData.url ?? null,
      content: sourceData.content ?? null,
      storagePath: sourceData.storage_path ?? null,
      notionPageId: sourceData.notion_page_id ?? null,
      origin: sourceData.origin ?? null,
      customFields: (sourceData.custom_fields as Record<string, unknown> | null) ?? null,
      productScopeId: scopeId,
      parentId: sourceData.parent_id ?? null,
    })

    if (!data) {
      console.error('[scope-knowledge.post] failed to create source')
      return NextResponse.json({ error: 'Failed to create knowledge source.' }, { status: 500 })
    }

    if (external_id && external_source && data?.id) {
      await upsertExternalRecord({
        projectId,
        source: external_source,
        externalId: external_id,
        resourceType: 'knowledge',
        resourceId: data.id,
      })
    }

    return NextResponse.json({ source: { ...data, product_scope_id: scopeId } }, { status: 201 })
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

    console.error('[scope-knowledge.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create knowledge source.' }, { status: 500 })
  }
}
