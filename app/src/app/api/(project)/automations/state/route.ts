/**
 * Skill state KV — durable per-(project, skill) state for sync cursors and
 * other resumable bookkeeping. Used by skill scripts via:
 *   hissuno automations state get --skill <skillId>
 *   hissuno automations state set --skill <skillId> --json -
 *
 * GET  /api/automations/state?projectId=...&skillId=...        → { state }
 * PUT  /api/automations/state?projectId=...&skillId=...  body: { state }
 *
 * The shape of `state` is opaque to core; each skill defines its own schema.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireProjectId } from '@/lib/auth/project-context'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getSkillState,
  setSkillState,
  deleteSkillState,
} from '@/lib/db/queries/automation-skill-state'

export const runtime = 'nodejs'

function requireSkillId(request: NextRequest): string {
  const skillId = request.nextUrl.searchParams.get('skillId')
  if (!skillId) {
    const err = new Error('skillId query parameter is required.') as Error & { status: number }
    err.status = 400
    throw err
  }
  return skillId
}

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }
    const projectId = requireProjectId(request)
    const skillId = requireSkillId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const state = await getSkillState(projectId, skillId)
    return NextResponse.json({ state: state ?? {} })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }
    const projectId = requireProjectId(request)
    const skillId = requireSkillId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = (await request.json().catch(() => ({}))) as { state?: Record<string, unknown> }
    if (!body.state || typeof body.state !== 'object') {
      return NextResponse.json({ error: 'body.state must be an object.' }, { status: 400 })
    }

    const row = await setSkillState(projectId, skillId, body.state)
    return NextResponse.json({ state: row.state, updatedAt: row.updated_at })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }
    const projectId = requireProjectId(request)
    const skillId = requireSkillId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    await deleteSkillState(projectId, skillId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
}

function errorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number })?.status ?? 400
  return NextResponse.json({ error: message }, { status })
}
