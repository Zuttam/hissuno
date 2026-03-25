import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc, inArray, isNotNull } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources, entityRelationships } from '@/lib/db/schema/app'
import { uploadDocument, validateUploadedFile } from '@/lib/knowledge/storage'
import { createGitHubCodebase, syncGitHubCodebase } from '@/lib/knowledge/codebase'
import { hasGitHubInstallation } from '@/lib/integrations/github'
import type { KnowledgeSourceType, KnowledgeSourceInsert } from '@/lib/knowledge/types'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import {
  createKnowledgeSource,
  createKnowledgeSourceBulkAdmin,
} from '@/lib/knowledge/knowledge-service'

export const runtime = 'nodejs'

/**
 * Simple in-memory per-user upload rate limiter.
 * Max 20 uploads per 60-second window.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_UPLOADS = 20
const uploadTimestamps = new Map<string, number[]>()

function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = uploadTimestamps.get(userId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)

  if (recent.length >= RATE_LIMIT_MAX_UPLOADS) {
    uploadTimestamps.set(userId, recent)
    return false
  }

  recent.push(now)
  uploadTimestamps.set(userId, recent)
  return true
}

/** Source types that users can manually add (codebase uses dedicated handler) */
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

/**
 * Helper to create or replace a codebase knowledge source
 */
async function handleCodebaseCreate(
  userId: string,
  projectId: string,
  params: {
    repositoryUrl?: string
    repositoryBranch?: string
    analysisScope?: string
    name?: string | null
    description?: string | null
  }
) {
  const { repositoryUrl, repositoryBranch, analysisScope } = params

  // 1. Validate required fields
  if (!repositoryUrl || !repositoryBranch) {
    return NextResponse.json(
      { error: 'repositoryUrl and repositoryBranch are required for codebase type.' },
      { status: 400 }
    )
  }

  // 2. Check GitHub integration is connected
  const githubStatus = await hasGitHubInstallation(projectId)
  if (!githubStatus.connected) {
    return NextResponse.json(
      { error: 'GitHub integration not connected for this project.' },
      { status: 400 }
    )
  }

  // 3. Create new source_codes record
  console.log('[knowledge-sources.post] Creating new GitHub codebase:', repositoryUrl, repositoryBranch)
  const { codebase } = await createGitHubCodebase({
    repositoryUrl,
    repositoryBranch,
    userId,
  })

  // 4. Insert new knowledge_source
  const [source] = await db
    .insert(knowledgeSources)
    .values({
      project_id: projectId,
      type: 'codebase',
      source_code_id: codebase.id,
      analysis_scope: analysisScope?.trim() || null,
      status: 'pending',
      enabled: true,
      name: params.name || null,
      description: params.description || null,
    })
    .returning()

  if (!source) {
    console.error('[knowledge-sources.post] Failed to create knowledge source')
    return NextResponse.json({ error: 'Failed to create codebase source.' }, { status: 500 })
  }

  // 5. Sync codebase (best-effort, don't fail if sync fails)
  console.log('[knowledge-sources.post] Syncing codebase:', codebase.id)
  const syncResult = await syncGitHubCodebase({
    codebaseId: codebase.id,
    userId,
    projectId,
  })

  if (syncResult.status === 'error') {
    console.warn('[knowledge-sources.post] Sync failed but codebase is linked:', syncResult.error)
  } else {
    console.log('[knowledge-sources.post] Sync completed:', syncResult.status, syncResult.commitSha)
  }

  return NextResponse.json({
    source,
    syncResult: {
      status: syncResult.status,
      commitSha: syncResult.commitSha,
      localPath: syncResult.localPath,
    },
  }, { status: 201 })
}

/**
 * GET /api/knowledge/sources?projectId=...
 * List all knowledge sources for a project
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[knowledge-sources.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const data = await db.query.knowledgeSources.findMany({
      where: eq(knowledgeSources.project_id, projectId),
      with: { sourceCode: true },
      orderBy: [desc(knowledgeSources.created_at)],
    })

    // Enrich with product_scope_id from entity_relationships
    const sourceIds = data.map(s => s.id)
    const areaLinks = sourceIds.length > 0
      ? await db.select({
          knowledge_source_id: entityRelationships.knowledge_source_id,
          product_scope_id: entityRelationships.product_scope_id,
        })
        .from(entityRelationships)
        .where(and(
          inArray(entityRelationships.knowledge_source_id, sourceIds),
          isNotNull(entityRelationships.product_scope_id),
        ))
      : []
    const areaBySource = new Map<string, string>()
    for (const link of areaLinks) {
      if (link.knowledge_source_id && link.product_scope_id) {
        areaBySource.set(link.knowledge_source_id, link.product_scope_id)
      }
    }
    const enriched = data.map(s => ({
      ...s,
      product_scope_id: areaBySource.get(s.id) ?? null,
    }))

    return NextResponse.json({ sources: enriched })
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

    console.error('[knowledge-sources.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge sources.' }, { status: 500 })
  }
}

/**
 * POST /api/knowledge/sources?projectId=...
 * Add a new knowledge source to a project
 *
 * Supports both JSON and FormData:
 * - JSON: { type, url?, content? }
 * - FormData: type, url?, content?, file? (for uploaded_doc)
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[knowledge-sources.post] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    const contentType = request.headers.get('content-type') ?? ''
    let sourceData: KnowledgeSourceInsert
    let productScopeId: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData (for file uploads)
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

      // Handle file upload for uploaded_doc type
      if (type === 'uploaded_doc') {
        if (!file) {
          return NextResponse.json({ error: 'File is required for uploaded_doc type.' }, { status: 400 })
        }

        // Rate limit: max 20 uploads per minute per user
        if (!checkUploadRateLimit(actingUserId)) {
          return NextResponse.json(
            { error: 'Upload rate limit exceeded. Please wait before uploading more files.' },
            { status: 429 }
          )
        }

        // Validate file: extension, MIME type, magic bytes, and size
        const validationError = await validateUploadedFile(file)
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 })
        }

        const { path, error: uploadError } = await uploadDocument(projectId, file)
        if (uploadError) {
          console.error('[knowledge-sources.post] failed to upload document', uploadError)
          return NextResponse.json({ error: 'Failed to upload document.' }, { status: 500 })
        }

        sourceData.storage_path = path
      }
    } else {
      // Handle JSON
      const payload = await request.json().catch(() => null)

      if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
      }

      const { type, url, content, repositoryUrl, repositoryBranch, analysis_scope, productScopeId: rawProductScopeId, name, description, notionPageId, pages } = payload
      productScopeId = rawProductScopeId || null

      // Special handling for codebase type
      if (type === 'codebase') {
        return handleCodebaseCreate(actingUserId, projectId, {
          repositoryUrl,
          repositoryBranch,
          analysisScope: analysis_scope,
          name,
          description,
        })
      }

      // Bulk Notion import
      if (type === 'notion_bulk') {
        if (!Array.isArray(pages) || pages.length === 0) {
          return NextResponse.json({ error: 'pages array is required for notion_bulk type.' }, { status: 400 })
        }

        if (pages.length > 500) {
          return NextResponse.json({ error: 'Too many pages. Maximum is 500.' }, { status: 400 })
        }

        const { hasNotionConnection } = await import('@/lib/integrations/notion')
        const notionStatus = await hasNotionConnection(projectId)
        if (!notionStatus.connected) {
          return NextResponse.json({ error: 'Notion integration not connected.' }, { status: 400 })
        }

        const values = (pages as Array<{ pageId: string; title: string; url: string }>).map((page) => ({
          type: 'notion' as const,
          notionPageId: page.pageId,
          name: page.title,
          url: page.url,
        }))

        const inserted = await createKnowledgeSourceBulkAdmin(projectId, values)

        return NextResponse.json({ sources: inserted }, { status: 201 })
      }

      if (!type || !isUserAddableType(type)) {
        return NextResponse.json({ error: 'Invalid or missing source type.' }, { status: 400 })
      }

      // Validate required fields based on type
      if ((type === 'website' || type === 'docs_portal') && !url) {
        return NextResponse.json({ error: 'URL is required for website/docs_portal sources.' }, { status: 400 })
      }

      if (type === 'raw_text' && !content) {
        return NextResponse.json({ error: 'Content is required for raw_text sources.' }, { status: 400 })
      }

      const { origin } = payload

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
      productScopeId,
    })

    if (!data) {
      console.error('[knowledge-sources.post] failed to create source')
      return NextResponse.json({ error: 'Failed to create knowledge source.' }, { status: 500 })
    }

    return NextResponse.json({ source: data }, { status: 201 })
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

    console.error('[knowledge-sources.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create knowledge source.' }, { status: 500 })
  }
}

