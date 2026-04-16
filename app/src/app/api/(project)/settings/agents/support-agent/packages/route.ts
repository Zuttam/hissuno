import { NextRequest, NextResponse } from 'next/server'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { supportPackages, supportPackageSources, knowledgeSources } from '@/lib/db/schema/app'
import type { SupportPackageWithSources } from '@/lib/knowledge/types'

export const runtime = 'nodejs'

/**
 * GET /api/settings/agents/support-agent/packages
 * List all named knowledge packages for a project
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[knowledge-packages.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Fetch all named packages for the project
    const packages = await db
      .select()
      .from(supportPackages)
      .where(eq(supportPackages.project_id, projectId))
      .orderBy(asc(supportPackages.created_at))

    if (packages.length === 0) {
      return NextResponse.json({ packages: [] })
    }

    // Fetch related data for each package
    const packagesWithRelations = await Promise.all(
      packages.map(async (pkg) => {
        // Get linked sources
        const sourcesData = await db
          .select({ source_id: supportPackageSources.source_id })
          .from(supportPackageSources)
          .where(eq(supportPackageSources.package_id, pkg.id))

        const sourceIds = sourcesData.map((s) => s.source_id)

        const rawSources = sourceIds.length > 0
          ? await db.select().from(knowledgeSources).where(inArray(knowledgeSources.id, sourceIds))
          : []

        // Compute lastAnalyzedAt from source data
        const lastAnalyzedAt = rawSources.length > 0
          ? rawSources.reduce((latest: string | null, s) => {
              if (!s.analyzed_at) return latest
              const analyzedStr = s.analyzed_at.toISOString()
              if (!latest) return analyzedStr
              return new Date(analyzedStr) > new Date(latest) ? analyzedStr : latest
            }, null as string | null)
          : null

        return {
          ...pkg,
          created_at: pkg.created_at?.toISOString() ?? null,
          updated_at: pkg.updated_at?.toISOString() ?? null,
          compiled_at: pkg.compiled_at?.toISOString() ?? null,
          sources: rawSources as unknown as SupportPackageWithSources['sources'],
          sourceCount: rawSources.length,
          lastAnalyzedAt,
        }
      })
    )

    return NextResponse.json({ packages: packagesWithRelations })
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

    console.error('[knowledge-packages.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load knowledge packages.' }, { status: 500 })
  }
}

/**
 * POST /api/settings/agents/support-agent/packages
 * Create a new named knowledge package
 *
 * Body:
 * - name: string (required)
 * - description?: string
 * - guidelines?: string
 * - sourceIds?: string[] - IDs of sources to link
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[knowledge-packages.post] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { name, description, guidelines, sourceIds } = body as {
      name: string
      description?: string
      guidelines?: string
      sourceIds?: string[]
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Package name is required.' }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Check for duplicate name
    const [existing] = await db
      .select({ id: supportPackages.id })
      .from(supportPackages)
      .where(
        and(
          eq(supportPackages.project_id, projectId),
          eq(supportPackages.name, trimmedName)
        )
      )
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'A package with this name already exists.' }, { status: 409 })
    }

    // Create the package
    const [pkg] = await db
      .insert(supportPackages)
      .values({
        project_id: projectId,
        name: trimmedName,
        description: description?.trim() || null,
        guidelines: guidelines?.trim() || null,
      })
      .returning()

    if (!pkg) {
      console.error('[knowledge-packages.post] failed to create package')
      return NextResponse.json({ error: 'Failed to create knowledge package.' }, { status: 500 })
    }

    // Link sources if provided
    if (sourceIds && sourceIds.length > 0) {
      // Verify sources belong to this project
      const validSources = await db
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.project_id, projectId),
            inArray(knowledgeSources.id, sourceIds)
          )
        )

      const validSourceIds = validSources.map((s) => s.id)

      if (validSourceIds.length > 0) {
        try {
          await db
            .insert(supportPackageSources)
            .values(validSourceIds.map((sourceId) => ({
              package_id: pkg.id,
              source_id: sourceId,
            })))
        } catch (linkError) {
          console.error('[knowledge-packages.post] failed to link sources', linkError)
          // Package created, just warn about sources
        }
      }
    }

    // Return the created package with relations
    const sources = sourceIds && sourceIds.length > 0
      ? await db
          .select()
          .from(knowledgeSources)
          .where(
            and(
              eq(knowledgeSources.project_id, projectId),
              inArray(knowledgeSources.id, sourceIds)
            )
          )
      : []

    const result = {
      ...pkg,
      created_at: pkg.created_at?.toISOString() ?? null,
      updated_at: pkg.updated_at?.toISOString() ?? null,
      sources: sources as unknown as SupportPackageWithSources['sources'],
      sourceCount: sources.length,
      lastAnalyzedAt: null,
    }

    return NextResponse.json({ package: result }, { status: 201 })
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

    console.error('[knowledge-packages.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create knowledge package.' }, { status: 500 })
  }
}
