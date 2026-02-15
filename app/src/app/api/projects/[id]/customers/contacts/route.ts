import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { listContacts, insertContact } from '@/lib/supabase/contacts'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/contacts
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)

    const filters = {
      projectId,
      companyId: searchParams.get('companyId') ?? undefined,
      isChampion: searchParams.get('isChampion') === 'true' ? true : undefined,
      search: searchParams.get('search') ?? undefined,
      role: searchParams.get('role') ?? undefined,
      title: searchParams.get('title') ?? undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const { contacts, total } = await listContacts(filters)
    return NextResponse.json({ contacts, total })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[contacts.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load contacts.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/customers/contacts
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }
    if (!body.email) {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 })
    }

    const contact = await insertContact(supabase, {
      projectId,
      name: body.name,
      email: body.email,
      companyId: body.company_id ?? null,
      role: body.role ?? null,
      title: body.title ?? null,
      phone: body.phone ?? null,
      companyUrl: body.company_url ?? null,
      isChampion: body.is_champion ?? false,
      lastContactedAt: body.last_contacted_at ?? null,
      notes: body.notes ?? null,
      customFields: body.custom_fields ?? {},
    })

    return NextResponse.json({ contact }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[contacts.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create contact.' }, { status: 500 })
  }
}
