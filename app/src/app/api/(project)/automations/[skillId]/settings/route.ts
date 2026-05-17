/**
 * PATCH /api/automations/[skillId]/settings?projectId=...
 *
 * Updates per-project settings (enabled and/or triggers override) for any
 * skill (bundled or custom). The skill must exist in the project's catalog.
 *
 * Body shape (all fields optional, at least one required):
 *   {
 *     enabled?: boolean,
 *     triggers?: { manual?: {...}, scheduled?: {...}, events?: [...] } | null
 *   }
 *
 * `triggers: null` clears the override (skill falls back to SKILL.md
 * frontmatter). Omitting the key leaves the override untouched.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseExpression } from 'cron-parser'
import { z } from 'zod'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listSkillsForProject } from '@/lib/automations/dispatch'
import { upsertProjectSkillSetting } from '@/lib/db/queries/project-skill-settings'

export const runtime = 'nodejs'

const triggersSchema = z
  .object({
    manual: z
      .object({
        entity: z
          .enum([
            'issue',
            'customer',
            'scope',
            'session',
            'feedback',
            'knowledge_source',
            'package',
          ])
          .optional(),
      })
      .optional(),
    scheduled: z
      .object({
        cron: z
          .string()
          .min(1)
          .refine(
            (v) => {
              try {
                parseExpression(v)
                return true
              } catch {
                return false
              }
            },
            { message: 'Invalid cron expression.' },
          ),
      })
      .optional(),
    events: z
      .array(
        z.enum([
          'issue.created',
          'feedback.created',
          'contact.created',
          'company.created',
          'session.created',
          'session.closed',
          'knowledge.created',
        ]),
      )
      .optional(),
  })
  .nullable()

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    triggers: triggersSchema.optional(),
  })
  .refine((v) => v.enabled !== undefined || v.triggers !== undefined, {
    message: 'At least one of `enabled` or `triggers` must be provided.',
  })

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ skillId: string }> },
) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { skillId } = await context.params

    const rawBody = (await request.json().catch(() => null)) as unknown
    const parsed = patchSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', issues: parsed.error.issues },
        { status: 400 },
      )
    }

    // Validate the skill exists in this project's catalog.
    const catalog = await listSkillsForProject(projectId)
    const found = catalog.find((s) => s.id === skillId)
    if (!found) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    const row = await upsertProjectSkillSetting(projectId, skillId, parsed.data)
    return NextResponse.json({
      skillId: row.skill_id,
      enabled: row.enabled,
      triggers: row.triggers ?? null,
      updatedAt: row.updated_at.toISOString(),
    })
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
    console.error('[automations.settings] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
