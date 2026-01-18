import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  getCustomTagById,
  updateCustomTag,
  deleteCustomTag,
} from '@/lib/supabase/custom-tags'
import {
  sanitizeTagDescription,
  isValidSlug,
  isValidTagName,
  detectInjectionAttempt,
} from '@/lib/security/sanitize'
import { SESSION_TAGS } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { id: string; tagId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const VALID_COLORS = ['info', 'success', 'danger', 'warning', 'default']

/**
 * GET /api/projects/[id]/settings/custom-tags/[tagId]
 *
 * Get a single custom tag by ID.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, tagId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[custom-tags.getOne] Supabase must be configured', projectId, tagId)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const tag = await getCustomTagById(tagId)

    if (!tag) {
      return NextResponse.json({ error: 'Custom tag not found.' }, { status: 404 })
    }

    // Verify the tag belongs to the requested project
    if (tag.project_id !== projectId) {
      return NextResponse.json({ error: 'Custom tag not found.' }, { status: 404 })
    }

    return NextResponse.json({ tag })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[custom-tags.getOne] unexpected error', projectId, tagId, error)
    return NextResponse.json({ error: 'Failed to load custom tag.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/settings/custom-tags/[tagId]
 *
 * Update an existing custom tag.
 *
 * Body (all optional):
 * - name: string (1-50 chars)
 * - slug: string (lowercase snake_case)
 * - description: string (1-500 chars, sanitized)
 * - color: string ('info' | 'success' | 'danger' | 'warning' | 'default')
 * - position: number (0-9)
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId, tagId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[custom-tags.patch] Supabase must be configured', projectId, tagId)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Verify the tag exists and belongs to this project
  try {
    const existingTag = await getCustomTagById(tagId)
    if (!existingTag || existingTag.project_id !== projectId) {
      return NextResponse.json({ error: 'Custom tag not found.' }, { status: 404 })
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    throw error
  }

  // Build updates object
  const updates: {
    name?: string
    slug?: string
    description?: string
    color?: string
    position?: number
  } = {}

  // Validate name
  if (payload.name !== undefined) {
    if (typeof payload.name !== 'string') {
      return NextResponse.json({ error: 'Invalid name.' }, { status: 400 })
    }
    const name = payload.name.trim()
    if (!isValidTagName(name)) {
      return NextResponse.json({ error: 'Name must be 1-50 characters.' }, { status: 400 })
    }
    updates.name = name
  }

  // Validate slug
  if (payload.slug !== undefined) {
    if (typeof payload.slug !== 'string') {
      return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 })
    }
    const slug = payload.slug.trim().toLowerCase()
    if (!isValidSlug(slug)) {
      return NextResponse.json({
        error: 'Slug must be lowercase, start with a letter, and contain only letters, numbers, and underscores.',
      }, { status: 400 })
    }
    // Check if slug conflicts with native tags
    if (SESSION_TAGS.includes(slug as (typeof SESSION_TAGS)[number])) {
      return NextResponse.json({
        error: 'Slug conflicts with a native tag. Please choose a different slug.',
      }, { status: 400 })
    }
    updates.slug = slug
  }

  // Validate description
  if (payload.description !== undefined) {
    if (typeof payload.description !== 'string') {
      return NextResponse.json({ error: 'Invalid description.' }, { status: 400 })
    }
    const rawDescription = payload.description.trim()
    if (rawDescription.length < 1 || rawDescription.length > 500) {
      return NextResponse.json({ error: 'Description must be 1-500 characters.' }, { status: 400 })
    }

    // Check for injection attempts
    const injectionPattern = detectInjectionAttempt(rawDescription)
    if (injectionPattern) {
      console.warn('[custom-tags.patch] Potential injection attempt detected', {
        projectId,
        tagId,
        pattern: injectionPattern,
      })
    }

    // Sanitize description
    const description = sanitizeTagDescription(rawDescription)
    if (description.length === 0) {
      return NextResponse.json({
        error: 'Description became empty after sanitization. Please provide a valid description.',
      }, { status: 400 })
    }
    updates.description = description
  }

  // Validate color
  if (payload.color !== undefined) {
    if (typeof payload.color !== 'string' || !VALID_COLORS.includes(payload.color)) {
      return NextResponse.json({
        error: `Invalid color. Must be one of: ${VALID_COLORS.join(', ')}.`,
      }, { status: 400 })
    }
    updates.color = payload.color
  }

  // Validate position
  if (payload.position !== undefined) {
    if (typeof payload.position !== 'number' || payload.position < 0 || payload.position >= 10) {
      return NextResponse.json({ error: 'Position must be a number between 0 and 9.' }, { status: 400 })
    }
    updates.position = payload.position
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
  }

  try {
    const tag = await updateCustomTag(tagId, updates)
    return NextResponse.json({ tag })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    console.error('[custom-tags.patch] unexpected error', projectId, tagId, error)
    return NextResponse.json({ error: 'Failed to update custom tag.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/settings/custom-tags/[tagId]
 *
 * Delete a custom tag.
 * Note: This does NOT remove the slug from existing sessions.tags arrays.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id: projectId, tagId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[custom-tags.delete] Supabase must be configured', projectId, tagId)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    // Verify the tag exists and belongs to this project
    const existingTag = await getCustomTagById(tagId)
    if (!existingTag || existingTag.project_id !== projectId) {
      return NextResponse.json({ error: 'Custom tag not found.' }, { status: 404 })
    }

    await deleteCustomTag(tagId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[custom-tags.delete] unexpected error', projectId, tagId, error)
    return NextResponse.json({ error: 'Failed to delete custom tag.' }, { status: 500 })
  }
}
