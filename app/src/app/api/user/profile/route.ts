import { NextResponse } from 'next/server'
import { requireSessionUser, UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const user = await requireSessionUser()
    const supabase = await createClient()

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (profile doesn't exist yet)
      console.error('[user.profile.get] failed to fetch profile', error)
      return NextResponse.json({ error: 'Unable to load profile.' }, { status: 500 })
    }

    return NextResponse.json({ profile: profile ?? null })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[user.profile.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load profile.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const user = await requireSessionUser()
    const supabase = await createClient()
    const body = await request.json()

    const {
      fullName,
      companyName,
      role,
      companySize,
      communicationChannels,
      onboardingCompleted,
      onboardingCurrentStep,
    } = body

    // Fetch existing profile to preserve fields not being updated
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Build update object - only include fields that were explicitly provided
    // This ensures partial updates don't reset other fields
    const updateData: Record<string, unknown> = {
      user_id: user.id,
    }

    // Profile fields - only update if provided (not undefined)
    if (fullName !== undefined) {
      updateData.full_name = fullName ?? null
    }
    if (companyName !== undefined) {
      updateData.company_name = companyName ?? null
    }
    if (role !== undefined) {
      updateData.role = role ?? null
    }
    if (companySize !== undefined) {
      updateData.company_size = companySize || null
    }
    if (communicationChannels !== undefined) {
      updateData.communication_channels = communicationChannels ?? []
    }

    // Onboarding step tracking
    if (onboardingCurrentStep !== undefined) {
      updateData.onboarding_current_step = onboardingCurrentStep
    }

    // Onboarding flags - only update if explicitly provided
    if (onboardingCompleted !== undefined) {
      updateData.onboarding_completed = onboardingCompleted
      // Only set completion timestamp when marking as completed
      if (onboardingCompleted && !existingProfile?.onboarding_completed) {
        updateData.onboarding_completed_at = new Date().toISOString()
      }
    }

    // Upsert profile with partial data
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(updateData, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      console.error('[user.profile.post] failed to save profile', error)
      return NextResponse.json({ error: 'Unable to save profile.' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[user.profile.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to save profile.' }, { status: 500 })
  }
}
