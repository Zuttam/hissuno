import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; companyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/companies/[companyId]/activity
 * Returns sessions and issues linked to all contacts in this company.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, companyId } = await context.params
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Get all contacts for this company
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .eq('project_id', projectId)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ sessions: [], issues: [] })
    }

    const contactIds = contacts.map((c) => c.id)

    // Get sessions for these contacts
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, name, source, created_at')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(20)

    // Get issues through sessions
    const { data: sessionIds } = await supabase
      .from('sessions')
      .select('id')
      .in('contact_id', contactIds)

    let issues: Array<{ id: string; title: string; type: string; status: string }> = []
    if (sessionIds && sessionIds.length > 0) {
      const { data: issueLinks } = await supabase
        .from('issue_sessions')
        .select('issue:issues(id, title, type, status)')
        .in('session_id', sessionIds.map((s) => s.id))

      if (issueLinks) {
        const issueMap = new Map<string, { id: string; title: string; type: string; status: string }>()
        for (const link of issueLinks) {
          const issue = Array.isArray(link.issue) ? link.issue[0] : link.issue
          if (issue && !issueMap.has(issue.id)) {
            issueMap.set(issue.id, issue as { id: string; title: string; type: string; status: string })
          }
        }
        issues = Array.from(issueMap.values())
      }
    }

    return NextResponse.json({ sessions: sessions ?? [], issues })
  } catch (error) {
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
