/**
 * GET /api/automations/[skillId]?projectId=...
 *
 * Returns the SKILL.md content plus frontmatter for either a bundled or
 * custom skill, used by the in-app skill viewer / download action.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { findSkill, readSkillBody } from '@/lib/automations/skills'
import {
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

    const custom = await getCustomSkillDescriptor(projectId, skillId)
    if (custom) {
      const content = await readCustomSkillContent(projectId, skillId)
      return NextResponse.json({
        skillId: custom.id,
        source: 'custom' as const,
        frontmatter: custom.frontmatter,
        content: content ?? '',
      })
    }

    const bundled = findSkill(skillId)
    if (bundled) {
      const content = readSkillBody(bundled)
      return NextResponse.json({
        skillId: bundled.id,
        source: 'bundled' as const,
        frontmatter: bundled.frontmatter,
        content,
      })
    }

    return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
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
    console.error('[automations.detail] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
