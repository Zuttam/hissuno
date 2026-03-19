import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getProductScopeById,
  updateProductScope,
  deleteProductScope,
  type UpdateProductScopeInput,
} from '@/lib/db/queries/product-scopes'
import { generateSlugFromName } from '@/lib/security/sanitize'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import type { ProductScopeGoal } from '@/types/product-scope'
import { MAX_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_GOAL_TEXT_LENGTH, MAX_GOALS_PER_SCOPE, VALID_TYPES } from '../validation'

export const runtime = 'nodejs'

type RouteParams = { scopeId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/product-scopes/[scopeId]?projectId=...
 *
 * Get a single product scope by ID.
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

    const scope = await getProductScopeById(scopeId)
    if (!scope || scope.project_id !== projectId) {
      return NextResponse.json({ error: 'Product scope not found.' }, { status: 404 })
    }

    return NextResponse.json({ scope })
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

    console.error('[product-scopes.get-one] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load product scope.' }, { status: 500 })
  }
}

/**
 * PATCH /api/product-scopes/[scopeId]?projectId=...
 *
 * Update a single product scope (name, description, type, goals, etc.).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { scopeId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify scope belongs to this project
    const existing = await getProductScopeById(scopeId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Product scope not found.' }, { status: 404 })
    }

    const body = await request.json()
    const { name, slug, description, color, type, goals } = body as {
      name?: string
      slug?: string
      description?: string
      color?: string
      type?: string
      goals?: ProductScopeGoal[]
    }

    // Validate name
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name must be a non-empty string.' }, { status: 400 })
      }
      if (name.trim().length > MAX_NAME_LENGTH) {
        return NextResponse.json({ error: `Name must be ${MAX_NAME_LENGTH} characters or less.` }, { status: 400 })
      }
    }

    // Validate slug
    if (slug !== undefined && slug !== null) {
      if (!/^[a-z][a-z0-9_]*$/.test(slug)) {
        return NextResponse.json({ error: 'Slug must start with a letter and contain only lowercase alphanumeric and underscores.' }, { status: 400 })
      }
    }

    // Validate description
    if (description !== undefined && description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json({ error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` }, { status: 400 })
    }

    // Validate type
    if (type !== undefined && !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: `Invalid type "${type}". Must be "product_area" or "initiative".` }, { status: 400 })
    }

    // Validate goals
    if (goals !== undefined) {
      if (goals !== null && !Array.isArray(goals)) {
        return NextResponse.json({ error: 'Goals must be an array or null.' }, { status: 400 })
      }
      if (Array.isArray(goals)) {
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
    }

    // Auto-generate slug from name if name changed but slug not provided
    const resolvedSlug = slug ?? (name ? generateSlugFromName(name.trim()) : undefined)

    const input: UpdateProductScopeInput = {}
    if (name !== undefined) input.name = name.trim()
    if (resolvedSlug !== undefined) input.slug = resolvedSlug
    if (description !== undefined) input.description = description
    if (color !== undefined) input.color = color
    if (type !== undefined) input.type = type as UpdateProductScopeInput['type']
    if (goals !== undefined) input.goals = goals ?? null

    const scope = await updateProductScope(scopeId, input)
    return NextResponse.json({ scope })
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

    const message = error instanceof Error ? error.message : 'Failed to update product scope.'
    console.error('[product-scopes.update] error', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/product-scopes/[scopeId]?projectId=...
 *
 * Delete a product scope. Cannot delete the default scope.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { scopeId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Verify scope belongs to this project
    const existing = await getProductScopeById(scopeId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Product scope not found.' }, { status: 404 })
    }

    await deleteProductScope(scopeId)
    return NextResponse.json({ success: true })
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

    const message = error instanceof Error ? error.message : 'Failed to delete product scope.'
    console.error('[product-scopes.delete] error', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
