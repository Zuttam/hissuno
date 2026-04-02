import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { contacts, sessions, issues, entityRelationships } from '@/lib/db/schema/app'
import { eq, and, inArray, desc, isNotNull } from 'drizzle-orm'

export const runtime = 'nodejs'

type RouteParams = { companyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/companies/[companyId]/activity?projectId=...
 * Returns sessions and issues linked to all contacts in this company.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const { companyId } = await context.params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get all contacts for this company
    const companyContacts = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.company_id, companyId),
          eq(contacts.project_id, projectId)
        )
      )

    if (companyContacts.length === 0) {
      return NextResponse.json({ sessions: [], issues: [] })
    }

    const contactIds = companyContacts.map((c) => c.id)

    // Get session IDs linked to these contacts via entity_relationships
    const sessionLinks = await db
      .select({ session_id: entityRelationships.session_id })
      .from(entityRelationships)
      .where(
        and(
          inArray(entityRelationships.contact_id, contactIds),
          isNotNull(entityRelationships.session_id),
        ),
      )

    const allSessionIds = [...new Set(
      sessionLinks
        .map((r) => r.session_id)
        .filter((id): id is string => id !== null),
    )]

    // Get sessions and issue links in parallel (independent queries)
    const [companySessions, issueLinks] = await Promise.all([
      allSessionIds.length > 0
        ? db.select({ id: sessions.id, name: sessions.name, source: sessions.source, created_at: sessions.created_at })
            .from(sessions).where(inArray(sessions.id, allSessionIds)).orderBy(desc(sessions.created_at)).limit(20)
        : Promise.resolve([]),
      allSessionIds.length > 0
        ? db.select({ issue_id: entityRelationships.issue_id })
            .from(entityRelationships).where(and(inArray(entityRelationships.session_id, allSessionIds), isNotNull(entityRelationships.issue_id)))
        : Promise.resolve([]),
    ])

    const issueIds = [...new Set(issueLinks.map((r) => r.issue_id).filter((id): id is string => id !== null))]
    let companyIssues: Array<{ id: string; name: string; type: string; status: string }> = []
    if (issueIds.length > 0) {
      const issueRows = await db
        .select({ id: issues.id, name: issues.name, type: issues.type, status: issues.status })
        .from(issues)
        .where(inArray(issues.id, issueIds))

      companyIssues = issueRows.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type ?? 'bug',
        status: i.status ?? 'open',
      }))
    }

    return NextResponse.json({
      sessions: companySessions.map((s) => ({
        ...s,
        created_at: s.created_at?.toISOString() ?? new Date().toISOString(),
      })),
      issues: companyIssues,
    })
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
    console.error('[api.companies.activity.GET] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch company activity.' }, { status: 500 })
  }
}
