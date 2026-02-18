import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/analytics
 * Returns aggregate customer stats.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Fetch companies
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('stage, arr')
      .eq('project_id', projectId)
      .eq('is_archived', false)

    if (companiesError) {
      console.error('[customers.analytics] failed to get companies', companiesError)
      throw new Error('Unable to load company analytics.')
    }

    // Fetch contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('is_champion')
      .eq('project_id', projectId)
      .eq('is_archived', false)

    if (contactsError) {
      console.error('[customers.analytics] failed to get contacts', contactsError)
      throw new Error('Unable to load contact analytics.')
    }

    const totalCompanies = companies?.length ?? 0
    const totalContacts = contacts?.length ?? 0
    const champions = contacts?.filter((c) => c.is_champion).length ?? 0

    const arrValues = (companies ?? [])
      .map((c) => Number(c.arr))
      .filter((v) => !isNaN(v) && v > 0)
    const totalARR = arrValues.reduce((sum, v) => sum + v, 0)
    const avgARR = arrValues.length > 0 ? Math.round(totalARR / arrValues.length) : 0

    // By stage breakdown
    const stageCounts: Record<string, number> = {}
    for (const c of companies ?? []) {
      const stage = c.stage || 'prospect'
      stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
    }
    const byStage = Object.entries(stageCounts).map(([label, value]) => ({
      label,
      value,
      percentage: totalCompanies > 0 ? Math.round((value / totalCompanies) * 100) : 0,
    }))

    return NextResponse.json({
      data: {
        totalCompanies,
        totalContacts,
        champions,
        totalARR,
        avgARR,
        byStage,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[customers.analytics] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load customer analytics.' }, { status: 500 })
  }
}
