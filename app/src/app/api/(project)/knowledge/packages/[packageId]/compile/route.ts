/**
 * POST /api/knowledge/packages/<packageId>/compile?projectId=...
 *
 * Synchronous package compile. Each enabled source goes through
 * fetch -> sanitize -> embed; then `compilePackageContent` organizes the
 * embedded chunks into FAQ/how-to/feature-docs/troubleshooting markdown.
 *
 * Used by the `hissuno-support-wiki` skill via `hissuno compile package <id>`.
 * Replaces the legacy package-compilation workflow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { knowledgeSources, supportPackages, supportPackageSources } from '@/lib/db/schema/app'
import { analyzeSource } from '@/lib/knowledge/knowledge-service'
import { compilePackageContent } from '@/lib/knowledge/compile-service'
export const runtime = 'nodejs'
export const maxDuration = 600

const bodySchema = z
  .object({
    /** Limit compile to a subset of source ids. Defaults to all enabled. */
    sourceIds: z.array(z.string().uuid()).optional(),
    /** Skip per-source analyze (assume already up-to-date). */
    skipAnalyze: z.boolean().optional(),
  })
  .strict()
  .partial()

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ packageId: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { packageId } = await context.params

    const [pkg] = await db
      .select({ id: supportPackages.id })
      .from(supportPackages)
      .where(and(eq(supportPackages.id, packageId), eq(supportPackages.project_id, projectId)))
      .limit(1)
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found.' }, { status: 404 })
    }

    const rawBody = await request.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { sourceIds, skipAnalyze } = parsed.data

    const linkedSourceRows = await db
      .select({ source_id: supportPackageSources.source_id })
      .from(supportPackageSources)
      .where(eq(supportPackageSources.package_id, packageId))
    const linkedIds = linkedSourceRows.map((r) => r.source_id)

    const targetIds = sourceIds && sourceIds.length > 0 ? sourceIds : linkedIds
    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: 'No sources linked to this package.' },
        { status: 400 },
      )
    }

    const sourceRows = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.project_id, projectId),
          inArray(knowledgeSources.id, targetIds),
        ),
      )

    // Folder sources are containers and aren't analyzable on their own; skip them.
    const ANALYZABLE_TYPES = new Set([
      'website',
      'docs_portal',
      'uploaded_doc',
      'raw_text',
      'codebase',
      'notion',
    ])
    const enabled = sourceRows.filter(
      (s) => s.enabled !== false && ANALYZABLE_TYPES.has(s.type as string),
    )
    if (enabled.length === 0) {
      return NextResponse.json({ error: 'No enabled sources to process.' }, { status: 400 })
    }

    const analyzeErrors: { sourceId: string; message: string }[] = []
    if (!skipAnalyze) {
      for (const source of enabled) {
        try {
          const result = await analyzeSource({
            projectId,
            sourceId: source.id,
            sourceType: source.type as
              | 'website'
              | 'docs_portal'
              | 'uploaded_doc'
              | 'raw_text'
              | 'codebase'
              | 'notion',
            url: source.url ?? null,
            storagePath: source.storage_path ?? null,
            content: source.content ?? null,
            analysisScope: source.analysis_scope ?? null,
          })
          if (!result.saved || result.errors.length > 0) {
            analyzeErrors.push({
              sourceId: source.id,
              message: result.errors.join(', ') || 'Save failed',
            })
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          analyzeErrors.push({ sourceId: source.id, message })
        }
      }
    }

    let compiled: Awaited<ReturnType<typeof compilePackageContent>> | null = null
    let compilationError: string | null = null
    try {
      compiled = await compilePackageContent(projectId, packageId)
    } catch (err) {
      compilationError = err instanceof Error ? err.message : 'Unknown compilation error'
    }

    return NextResponse.json({
      packageId,
      sourcesProcessed: enabled.length,
      analyzeErrors,
      compiled: compiled ? true : false,
      compilationError,
      compiledAt: compiled?.compiled_at?.toISOString() ?? null,
    })
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
    console.error('[knowledge.compile] error', error)
    return NextResponse.json({ error: 'Failed to compile package.' }, { status: 500 })
  }
}
