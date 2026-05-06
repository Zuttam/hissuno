/**
 * GET    /api/automations/custom/[skillId]?projectId=...  — fetch SKILL.md content
 * DELETE /api/automations/custom/[skillId]?projectId=...  — remove the skill
 *
 * Per-project enable/disable + trigger overrides have moved to
 * `/api/automations/[skillId]/settings` (covers both bundled and custom
 * skills uniformly).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity, requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import {
  deleteCustomSkill,
  getCustomSkillDescriptor,
  readCustomSkillContent,
} from '@/lib/automations/custom-skills'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { skillId } = await context.params

    const descriptor = await getCustomSkillDescriptor(projectId, skillId)
    if (!descriptor) {
      return NextResponse.json({ error: 'Custom skill not found' }, { status: 404 })
    }

    const content = await readCustomSkillContent(projectId, skillId)
    return NextResponse.json({
      skillId: descriptor.id,
      frontmatter: descriptor.frontmatter,
      content,
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    const { skillId } = await context.params
    const removed = await deleteCustomSkill(projectId, skillId)
    if (!removed) {
      return NextResponse.json({ error: 'Custom skill not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return mapError(error)
  }
}

function mapError(error: unknown): NextResponse {
  if (error instanceof MissingProjectIdError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
  console.error('[automations.custom.detail] error', error)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
