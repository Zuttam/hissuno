import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listContacts } from '@/lib/db/queries/contacts'
import { createContact } from '@/lib/customers/customers-service'
import { isDatabaseConfigured } from '@/lib/db/config'
import { upsertExternalRecord } from '@/lib/db/queries/external-records'

export const runtime = 'nodejs'

/**
 * GET /api/contacts?projectId=...
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

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

    const { contacts, total } = await listContacts(projectId, filters)
    return NextResponse.json({ contacts, total })
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
    console.error('[contacts.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load contacts.' }, { status: 500 })
  }
}

type ContactItemInput = {
  name?: string
  email?: string
  company_id?: string | null
  role?: string | null
  title?: string | null
  phone?: string | null
  company_url?: string | null
  is_champion?: boolean
  last_contacted_at?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
  external_id?: string
  external_source?: string
}

async function createContactFromItem(projectId: string, item: ContactItemInput) {
  if (!item.name) throw new Error('name is required.')
  if (!item.email) throw new Error('email is required.')

  const contact = await createContact({
    projectId,
    name: item.name,
    email: item.email,
    companyId: item.company_id ?? null,
    role: item.role ?? null,
    title: item.title ?? null,
    phone: item.phone ?? null,
    companyUrl: item.company_url ?? null,
    isChampion: item.is_champion ?? false,
    lastContactedAt: item.last_contacted_at ?? null,
    notes: item.notes ?? null,
    customFields: item.custom_fields ?? {},
  })

  if (item.external_id && item.external_source && contact?.id) {
    await upsertExternalRecord({
      projectId,
      source: item.external_source,
      externalId: item.external_id,
      resourceType: 'contact',
      resourceId: contact.id,
    })
  }

  return contact
}

/**
 * POST /api/contacts?projectId=...
 *
 * Body shapes:
 *   - Single:  { name, email, ... }
 *   - Batch:   { items: [{ name, email, ... }, ...] }
 *
 * Each item may include `external_id` + `external_source` to register an
 * external→hissuno mapping in `external_records` after the contact is created.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = (await request.json()) as ContactItemInput & { items?: ContactItemInput[] }

    if (Array.isArray(body.items)) {
      const created: unknown[] = []
      const errors: { index: number; error: string }[] = []
      for (let i = 0; i < body.items.length; i++) {
        try {
          const contact = await createContactFromItem(projectId, body.items[i])
          created.push(contact)
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : String(err) })
        }
      }
      return NextResponse.json({ created, errors }, { status: errors.length === 0 ? 201 : 207 })
    }

    if (!body.name) return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    if (!body.email) return NextResponse.json({ error: 'email is required.' }, { status: 400 })

    const contact = await createContactFromItem(projectId, body)
    return NextResponse.json({ contact }, { status: 201 })
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
    console.error('[contacts.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create contact.' }, { status: 500 })
  }
}
