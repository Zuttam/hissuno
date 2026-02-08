import { NextResponse } from 'next/server'
import { verifyAdminApiSecret } from '@/lib/auth/admin-api'
import { UnauthorizedError } from '@/lib/auth/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getPlanByName } from '@/lib/billing/plans-cache'

export const runtime = 'nodejs'

interface CreateUserBody {
  email: string
  name: string
  password?: string
  plan_name?: string
  sessions_limit?: number | null
  projects_limit?: number | null
  onboarding_completed?: boolean
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    verifyAdminApiSecret(request)

    const body = (await request.json()) as CreateUserBody
    const { email, name, password, plan_name = 'pro', sessions_limit, projects_limit, onboarding_completed } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required.' }, { status: 400 })
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }

    // Resolve plan: look up by name, fall back to admin_custom
    let resolvedPlanId = 'admin_custom'
    let defaultSessionsLimit: number | null = null
    let defaultProjectsLimit: number | null = null

    const plan = await getPlanByName(plan_name)
    if (plan) {
      resolvedPlanId = plan.id
      defaultSessionsLimit = plan.limits.sessions_limit
      defaultProjectsLimit = plan.limits.projects_limit
    }

    const finalSessionsLimit = sessions_limit !== undefined ? sessions_limit : defaultSessionsLimit
    const finalProjectsLimit = projects_limit !== undefined ? projects_limit : defaultProjectsLimit

    const supabase = createAdminClient()

    // Create auth user with confirmed email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      ...(password ? { password } : {}),
      user_metadata: { full_name: name },
    })

    if (authError) {
      if (authError.message?.toLowerCase().includes('already') || authError.status === 422) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
      }
      console.error('[admin.users.POST] Failed to create auth user', authError)
      return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })
    }

    const userId = authData.user.id

    // Upsert user profile
    const { error: profileError } = await supabase.from('user_profiles').upsert(
      {
        user_id: userId,
        full_name: name,
        is_activated: true,
        onboarding_completed: onboarding_completed ?? false,
      },
      { onConflict: 'user_id' }
    )

    if (profileError) {
      console.error('[admin.users.POST] Failed to upsert user profile', profileError)
    }

    // Upsert subscription
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          plan_id: resolvedPlanId,
          plan_name: plan_name,
          sessions_limit: finalSessionsLimit,
          projects_limit: finalProjectsLimit,
          status: 'active',
        },
        { onConflict: 'user_id' }
      )
      .select('id, plan_name, sessions_limit, projects_limit')
      .single()

    if (subError) {
      console.error('[admin.users.POST] Failed to upsert subscription', subError)
      return NextResponse.json({ error: 'User created but subscription failed.' }, { status: 500 })
    }

    console.log(`[admin.users.POST] Created user ${email} (${userId}) with plan ${plan_name}`)

    return NextResponse.json(
      {
        user: { id: userId, email },
        subscription: {
          id: subscription.id,
          plan_name: subscription.plan_name,
          sessions_limit: subscription.sessions_limit,
          projects_limit: subscription.projects_limit,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[admin.users.POST] unexpected error', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Operation failed.', detail: message }, { status: 500 })
  }
}
