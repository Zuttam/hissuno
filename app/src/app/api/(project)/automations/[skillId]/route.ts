/**
 * PATCH /api/automations/[skillId]?projectId=...
 *
 * Toggle a skill's enabled state for the current project. Body:
 *   { enabled: boolean }
 *
 * Affects all triggers (manual, scheduled, event). Default behaviour for
 * any skill not in project_skill_settings is enabled - so PATCHing a row
 * with `enabled: true` is only meaningful as an explicit re-enable after
 * a previous disable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { setSkillEnabled } from '@/lib/db/queries/project-skill-settings'

export const runtime = 'nodejs'

const bodySchema = z.object({ enabled: z.boolean() }).strict()

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    const { skillId } = await context.params

    const rawBody = (await request.json().catch(() => null)) as unknown
    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    await setSkillEnabled(projectId, skillId, parsed.data.enabled)

    return NextResponse.json({ ok: true, skillId, enabled: parsed.data.enabled })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[automations.toggle] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
