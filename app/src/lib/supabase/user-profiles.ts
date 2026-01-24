import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type UserProfilesTable = Database['public']['Tables']['user_profiles']

export type UserProfileRecord = UserProfilesTable['Row']

export const getUserProfile = cache(async (): Promise<UserProfileRecord | null> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('[user-profiles.queries] failed to resolve user for getUserProfile', userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile exists yet
        return null
      }
      console.error('[user-profiles.queries] failed to load profile', error)
      throw new Error('Unable to load profile from Supabase.')
    }

    return profile as UserProfileRecord
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[user-profiles.queries] unexpected error while loading profile', error)
    throw error
  }
})
