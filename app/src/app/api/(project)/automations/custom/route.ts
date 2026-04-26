/**
 * GET  /api/automations/custom?projectId=...   — list project's custom skills
 * POST /api/automations/custom?projectId=...   — upload a new custom skill
 *                                                 (or replace an existing one)
 *
 * The POST body is a JSON object with:
 *   { skillId: string, content: string }
 * where `content` is the full SKILL.md (frontmatter + markdown body). The
 * server parses + validates the frontmatter, writes the blob, and upserts
 * the metadata row.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listCustomSkills } from '@/lib/db/queries/custom-skills'
import {
  CustomSkillValidationError,
  saveCustomSkill,
} from '@/lib/automations/custom-skills'

export const runtime = 'nodejs'

const uploadSchema = z
  .object({
    skillId: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'skillId must be kebab-case'),
    content: z.string().min(20).max(200_000),
  })
  .strict()

export async function GET(request: NextRequest) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const rows = await listCustomSkills(projectId)
    return NextResponse.json({
      skills: rows.map((r) => ({
        skillId: r.skill_id,
        name: r.name,
        description: r.description,
        version: r.version,
        enabled: r.enabled,
        frontmatter: r.frontmatter,
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      })),
    })
  } catch (error) {
    return mapError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    const rawBody = (await request.json().catch(() => null)) as unknown
    const parsed = uploadSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    try {
      const row = await saveCustomSkill({
        projectId,
        skillId: parsed.data.skillId,
        content: parsed.data.content,
        createdByUserId: identity.userId,
      })
      return NextResponse.json({
        skillId: row.skill_id,
        name: row.name,
        description: row.description,
        version: row.version,
      })
    } catch (err) {
      if (err instanceof CustomSkillValidationError) {
        return NextResponse.json(
          { error: 'Skill validation failed', issues: err.issues },
          { status: 400 },
        )
      }
      throw err
    }
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
  console.error('[automations.custom] error', error)
  return NextResponse.json({ error: 'Internal error' }, { status: 500 })
}
