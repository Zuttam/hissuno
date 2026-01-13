import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  listProjectCustomTags,
  createCustomTag,
  canAddCustomTag,
} from '@/lib/supabase/custom-tags'
import {
  sanitizeTagDescription,
  isValidSlug,
  isValidTagName,
  generateSlugFromName,
  detectInjectionAttempt,
} from '@/lib/security/sanitize'
import { SESSION_TAGS } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const VALID_COLORS = ['info', 'success', 'danger', 'warning', 'default']

/**
 * GET /api/projects/[id]/settings/custom-tags
 *
 * List all custom tags for a project.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[custom-tags.get] Supabase must be configured', projectId)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const tags = await listProjectCustomTags(projectId)
    return NextResponse.json({ tags })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[custom-tags.get] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to load custom tags.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/settings/custom-tags
 *
 * Create a new custom tag for a project.
 *
 * Body:
 * - name: string (1-50 chars)
 * - slug?: string (optional, auto-generated from name if not provided)
 * - description: string (1-500 chars, sanitized for prompt injection)
 * - color?: string ('info' | 'success' | 'danger' | 'warning' | 'default')
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[custom-tags.post] Supabase must be configured', projectId)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Validate name
  if (typeof payload.name !== 'string') {
    return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  }
  const name = payload.name.trim()
  if (!isValidTagName(name)) {
    return NextResponse.json({ error: 'Name must be 1-50 characters.' }, { status: 400 })
  }

  // Validate/generate slug
  let slug: string
  if (typeof payload.slug === 'string' && payload.slug.trim().length > 0) {
    slug = payload.slug.trim().toLowerCase()
    if (!isValidSlug(slug)) {
      return NextResponse.json({
        error: 'Slug must be lowercase, start with a letter, and contain only letters, numbers, and underscores.',
      }, { status: 400 })
    }
  } else {
    slug = generateSlugFromName(name)
    if (!isValidSlug(slug)) {
      return NextResponse.json({
        error: 'Could not generate valid slug from name. Please provide a slug manually.',
      }, { status: 400 })
    }
  }

  // Check if slug conflicts with native tags
  if (SESSION_TAGS.includes(slug as (typeof SESSION_TAGS)[number])) {
    return NextResponse.json({
      error: 'Slug conflicts with a native tag. Please choose a different name.',
    }, { status: 400 })
  }

  // Validate description
  if (typeof payload.description !== 'string') {
    return NextResponse.json({ error: 'Description is required.' }, { status: 400 })
  }
  const rawDescription = payload.description.trim()
  if (rawDescription.length < 1 || rawDescription.length > 500) {
    return NextResponse.json({ error: 'Description must be 1-500 characters.' }, { status: 400 })
  }

  // Check for injection attempts (log but don't block - sanitization will handle it)
  const injectionPattern = detectInjectionAttempt(rawDescription)
  if (injectionPattern) {
    console.warn('[custom-tags.post] Potential injection attempt detected', {
      projectId,
      pattern: injectionPattern,
    })
  }

  // Sanitize description for prompt injection
  const description = sanitizeTagDescription(rawDescription)
  if (description.length === 0) {
    return NextResponse.json({
      error: 'Description became empty after sanitization. Please provide a valid description.',
    }, { status: 400 })
  }

  // Validate color
  const color = typeof payload.color === 'string' && VALID_COLORS.includes(payload.color)
    ? payload.color
    : 'info'

  try {
    // Check if project can add more tags
    const canAdd = await canAddCustomTag(projectId)
    if (!canAdd) {
      return NextResponse.json({
        error: 'Maximum of 10 custom tags per project.',
      }, { status: 400 })
    }

    const tag = await createCustomTag(projectId, {
      name,
      slug,
      description,
      color,
    })

    return NextResponse.json({ tag }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const message = error instanceof Error ? error.message : 'Unknown error'

    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    console.error('[custom-tags.post] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to create custom tag.' }, { status: 500 })
  }
}
