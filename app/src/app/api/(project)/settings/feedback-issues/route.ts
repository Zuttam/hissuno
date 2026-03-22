import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { listProjectCustomTags, syncCustomTags, type SyncTagInput } from '@/lib/db/queries/custom-tags'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

/**
 * GET /api/settings/feedback-issues?projectId=...
 *
 * Unified endpoint returning custom tags and issue tracking settings
 * for the Feedback & Issues configuration tab.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const customTags = await listProjectCustomTags(projectId)

    return NextResponse.json({ customTags })
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

    console.error('[settings.feedback-issues.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load feedback & issues settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/feedback-issues?projectId=...
 *
 * Update custom tags and/or issue tracking settings.
 * Accepts partial payload: { custom_tags?: array, issue_tracking_enabled?: boolean }
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const payload = await request.json().catch(() => null)

    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
    }

    // Handle custom tags sync
    if (!Array.isArray(payload.custom_tags)) {
      return NextResponse.json({ error: 'No valid fields provided.' }, { status: 400 })
    }

    const validationError = validateCustomTags(payload.custom_tags)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const customTags = await syncCustomTags(projectId, payload.custom_tags as SyncTagInput[])

    return NextResponse.json({ customTags })
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

    console.error('[settings.feedback-issues.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update feedback & issues settings.' }, { status: 500 })
  }
}

/**
 * Validate custom tags array structure
 */
function validateCustomTags(tags: unknown[]): string | null {
  if (tags.length > 10) {
    return 'Maximum of 10 custom tags per project.'
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]
    if (!tag || typeof tag !== 'object') {
      return `Invalid tag at index ${i}.`
    }

    const t = tag as Record<string, unknown>

    if (typeof t.id !== 'string' || !t.id.trim()) {
      return `Tag at index ${i} must have an id.`
    }

    if (typeof t.name !== 'string' || !t.name.trim()) {
      return `Tag at index ${i} must have a name.`
    }

    if (t.name.length > 50) {
      return `Tag name at index ${i} must be 50 characters or less.`
    }

    if (typeof t.slug !== 'string' || !t.slug.trim()) {
      return `Tag at index ${i} must have a slug.`
    }

    if (!/^[a-z][a-z0-9_]*$/.test(t.slug)) {
      return `Tag slug at index ${i} must start with a letter and contain only lowercase letters, numbers, and underscores.`
    }

    if (typeof t.description !== 'string' || !t.description.trim()) {
      return `Tag at index ${i} must have a description.`
    }

    if (t.description.length > 500) {
      return `Tag description at index ${i} must be 500 characters or less.`
    }

    if (typeof t.color !== 'string') {
      return `Tag at index ${i} must have a color.`
    }

    const validColors = ['info', 'success', 'warning', 'danger', 'default']
    if (!validColors.includes(t.color)) {
      return `Tag color at index ${i} must be one of: ${validColors.join(', ')}.`
    }

    if (typeof t.position !== 'number' || t.position < 0) {
      return `Tag at index ${i} must have a valid position.`
    }
  }

  // Check for duplicate slugs
  const slugs = tags.map((t) => (t as Record<string, unknown>).slug as string)
  const uniqueSlugs = new Set(slugs)
  if (slugs.length !== uniqueSlugs.size) {
    return 'Duplicate tag slugs are not allowed.'
  }

  return null
}
