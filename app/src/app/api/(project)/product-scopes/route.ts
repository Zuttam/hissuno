import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { listProjectProductScopes, syncProductScopes, createProductScope, type SyncScopeInput, type CreateProductScopeInput } from '@/lib/db/queries/product-scopes'
import { generateSlugFromName } from '@/lib/security/sanitize'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import type { ProductScopeGoal } from '@/types/product-scope'
import { MAX_SCOPES, MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_GOAL_TEXT_LENGTH, MAX_GOALS_PER_SCOPE, VALID_TYPES } from './validation'

export const runtime = 'nodejs'

/**
 * GET /api/product-scopes?projectId=...
 *
 * List all product scopes for a project.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[product-scopes.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const scopes = await listProjectProductScopes(projectId)
    return NextResponse.json({ scopes })
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

    console.error('[product-scopes.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load product scopes.' }, { status: 500 })
  }
}

/**
 * POST /api/product-scopes?projectId=...
 *
 * Create a single product scope.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[product-scopes.post] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { name, slug, description, color, type, goals } = body as {
      name?: string
      slug?: string
      description?: string
      color?: string
      type?: string
      goals?: ProductScopeGoal[]
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }

    const trimmedName = name.trim()
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
      return NextResponse.json({ error: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.` }, { status: 400 })
    }

    if (description && description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` }, { status: 400 })
    }

    if (type && !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: `Invalid type "${type}". Must be "product_area" or "initiative".` }, { status: 400 })
    }

    if (goals != null) {
      if (!Array.isArray(goals)) {
        return NextResponse.json({ error: 'Goals must be an array.' }, { status: 400 })
      }
      if (goals.length > MAX_GOALS_PER_SCOPE) {
        return NextResponse.json({ error: `Maximum of ${MAX_GOALS_PER_SCOPE} goals per scope.` }, { status: 400 })
      }
      for (const goal of goals) {
        if (!goal.id || !goal.text || typeof goal.text !== 'string') {
          return NextResponse.json({ error: 'Each goal must have an id and text.' }, { status: 400 })
        }
        if (goal.text.length > MAX_GOAL_TEXT_LENGTH) {
          return NextResponse.json({ error: `Goal text must be ${MAX_GOAL_TEXT_LENGTH} characters or less.` }, { status: 400 })
        }
      }
    }

    const resolvedSlug = slug || generateSlugFromName(trimmedName)
    if (!resolvedSlug || !/^[a-z][a-z0-9_]*$/.test(resolvedSlug)) {
      return NextResponse.json({ error: `Invalid slug. Must start with a letter and contain only lowercase alphanumeric and underscores.` }, { status: 400 })
    }

    const input: CreateProductScopeInput = {
      name: trimmedName,
      slug: resolvedSlug,
      description,
      color,
      type: type as CreateProductScopeInput['type'],
      goals: goals ?? null,
    }

    const scope = await createProductScope(projectId, input)
    return NextResponse.json({ scope }, { status: 201 })
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

    const message = error instanceof Error ? error.message : 'Failed to create product scope.'
    console.error('[product-scopes.post] error', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/product-scopes?projectId=...
 *
 * Sync product scopes for a project (create/update/delete).
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[product-scopes.patch] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { scopes } = body as { scopes: SyncScopeInput[] }

    if (!Array.isArray(scopes)) {
      return NextResponse.json({ error: 'scopes must be an array.' }, { status: 400 })
    }

    if (scopes.length > MAX_SCOPES) {
      return NextResponse.json({ error: `Maximum of ${MAX_SCOPES} product scopes per project.` }, { status: 400 })
    }

    // Validate each scope
    for (const scope of scopes) {
      if (!scope.name || typeof scope.name !== 'string') {
        return NextResponse.json({ error: 'Each scope must have a name.' }, { status: 400 })
      }

      const trimmedName = scope.name.trim()
      if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: `Scope name must be between 1 and ${MAX_NAME_LENGTH} characters.` }, { status: 400 })
      }

      if (scope.description && scope.description.length > MAX_DESCRIPTION_LENGTH) {
        return NextResponse.json({ error: `Scope description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` }, { status: 400 })
      }

      // Validate type
      if (scope.type && !VALID_TYPES.includes(scope.type as typeof VALID_TYPES[number])) {
        return NextResponse.json({ error: `Invalid scope type "${scope.type}". Must be "product_area" or "initiative".` }, { status: 400 })
      }

      // Validate goals
      if (scope.goals != null) {
        if (!Array.isArray(scope.goals)) {
          return NextResponse.json({ error: 'Goals must be an array.' }, { status: 400 })
        }
        if (scope.goals.length > MAX_GOALS_PER_SCOPE) {
          return NextResponse.json({ error: `Maximum of ${MAX_GOALS_PER_SCOPE} goals per scope.` }, { status: 400 })
        }
        for (const goal of scope.goals) {
          if (!goal.id || !goal.text || typeof goal.text !== 'string') {
            return NextResponse.json({ error: 'Each goal must have an id and text.' }, { status: 400 })
          }
          if (goal.text.length > MAX_GOAL_TEXT_LENGTH) {
            return NextResponse.json({ error: `Goal text must be ${MAX_GOAL_TEXT_LENGTH} characters or less.` }, { status: 400 })
          }
        }
      }

      // Auto-generate slug from name if not provided
      if (!scope.slug) {
        scope.slug = generateSlugFromName(scope.name)
      }

      if (!scope.slug || !/^[a-z][a-z0-9_]*$/.test(scope.slug)) {
        return NextResponse.json({ error: `Invalid slug for scope "${scope.name}". Name must start with a letter.` }, { status: 400 })
      }

      // Check for duplicate slugs within the incoming set
      const slugCount = scopes.filter((s) => s.slug === scope.slug).length
      if (slugCount > 1) {
        return NextResponse.json({ error: `Duplicate scope slug "${scope.slug}".` }, { status: 400 })
      }
    }

    const result = await syncProductScopes(projectId, scopes)
    return NextResponse.json({ result })
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

    const message = error instanceof Error ? error.message : 'Failed to save product scopes.'
    console.error('[product-scopes.patch] error', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
