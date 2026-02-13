import { NextResponse } from 'next/server'
import { verifyAdminApiSecret } from '@/lib/auth/admin-api'
import { UnauthorizedError } from '@/lib/auth/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { generateInviteCode } from '@/lib/invites/invite-service'

export const runtime = 'nodejs'

interface AddInvitesBody {
  count?: number
  promotion_code?: string
  promotion_description?: string
  user_id?: string
  email?: string
  filter?: {
    plan_name?: string
    is_activated?: boolean
    all?: boolean
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    verifyAdminApiSecret(request)

    const body = (await request.json()) as AddInvitesBody
    const { count = 1, promotion_code, promotion_description, user_id, email, filter } = body

    // Validate: exactly one targeting method required
    const targetCount = [user_id, email, filter].filter(Boolean).length
    if (targetCount === 0) {
      return NextResponse.json(
        { error: 'One of user_id, email, or filter is required.' },
        { status: 400 }
      )
    }
    if (targetCount > 1) {
      return NextResponse.json(
        { error: 'Only one of user_id, email, or filter may be specified.' },
        { status: 400 }
      )
    }

    if (count < 1 || count > 100) {
      return NextResponse.json(
        { error: 'count must be between 1 and 100.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    let userIds: string[] = []

    // Resolve target user(s)
    if (user_id) {
      userIds = [user_id]
    } else if (email) {
      const { data, error: lookupError } = await supabase.auth.admin.listUsers()
      if (lookupError) {
        console.error('[admin.invites.POST] Failed to list users', lookupError)
        return NextResponse.json({ error: 'Failed to look up user by email.' }, { status: 500 })
      }
      const matched = data.users.find((u) => u.email === email)
      if (!matched) {
        return NextResponse.json({ error: 'No user found with that email.' }, { status: 404 })
      }
      userIds = [matched.id]
    } else if (filter) {
      if (!filter.plan_name && filter.is_activated === undefined && !filter.all) {
        return NextResponse.json(
          { error: 'Filter must include at least one of: plan_name, is_activated, or all.' },
          { status: 400 }
        )
      }

      if (filter.all) {
        // Get all users from user_profiles
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('user_id')
        if (profilesError) {
          console.error('[admin.invites.POST] Failed to query user_profiles', profilesError)
          return NextResponse.json({ error: 'Failed to query users.' }, { status: 500 })
        }
        userIds = (profiles ?? []).map((p) => p.user_id)
      } else {
        // Build query with filters
        let query = supabase.from('user_profiles').select('user_id')

        if (filter.is_activated !== undefined) {
          query = query.eq('is_activated', filter.is_activated)
        }

        const { data: profiles, error: profilesError } = await query
        if (profilesError) {
          console.error('[admin.invites.POST] Failed to query user_profiles', profilesError)
          return NextResponse.json({ error: 'Failed to query users.' }, { status: 500 })
        }

        let matchedIds = (profiles ?? []).map((p) => p.user_id)

        // If plan_name filter, intersect with subscriptions
        if (filter.plan_name) {
          const { data: subs, error: subsError } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('plan_name', filter.plan_name)
          if (subsError) {
            console.error('[admin.invites.POST] Failed to query subscriptions', subsError)
            return NextResponse.json({ error: 'Failed to query subscriptions.' }, { status: 500 })
          }
          const subUserIds = new Set((subs ?? []).map((s) => s.user_id))
          matchedIds = matchedIds.filter((id) => subUserIds.has(id))
        }

        userIds = matchedIds
      }

      if (userIds.length === 0) {
        return NextResponse.json({ error: 'No users matched the filter.' }, { status: 404 })
      }
    }

    // Generate and insert invites
    const inviteRows = userIds.flatMap((uid) =>
      Array.from({ length: count }, () => ({
        code: generateInviteCode(),
        owner_user_id: uid,
        ...(promotion_code ? { promotion_code } : {}),
        ...(promotion_description ? { promotion_description } : {}),
      }))
    )

    const { error: insertError } = await supabase.from('invites').insert(inviteRows)

    if (insertError) {
      console.error('[admin.invites.POST] Failed to insert invites', insertError)
      return NextResponse.json({ error: 'Failed to create invites.' }, { status: 500 })
    }

    const invites = inviteRows.map((row) => ({ user_id: row.owner_user_id, code: row.code }))

    console.log(
      `[admin.invites.POST] Created ${invites.length} invite(s) for ${userIds.length} user(s)`
    )

    return NextResponse.json(
      { created: invites.length, users: userIds.length, invites },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[admin.invites.POST] unexpected error', error)
    return NextResponse.json({ error: 'Operation failed.' }, { status: 500 })
  }
}
