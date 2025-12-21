import { createServerClient, createBrowserClient as createSupabaseClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseConfig, isSupabaseConfigured, isServiceRoleConfigured } from '@/lib/config/supabase'

export { isSupabaseConfigured, isServiceRoleConfigured }

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super('Supabase environment variables are not configured.')
    this.name = 'SupabaseNotConfiguredError'
  }
}

export class ServiceRoleNotConfiguredError extends Error {
  constructor() {
    super('Supabase service role key is not configured.')
    this.name = 'ServiceRoleNotConfiguredError'
  }
}

export async function createClient() {
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError()
  }

  const cookieStore = await cookies()

  return createServerClient(
    supabaseConfig.url!,
    supabaseConfig.anonKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Creates a Supabase client with service role privileges.
 * This bypasses RLS and should only be used for server-side operations
 * that don't have a user context (e.g., widget session tracking).
 */
export function createAdminClient() {
  if (!isServiceRoleConfigured()) {
    throw new ServiceRoleNotConfiguredError()
  }

  return createSupabaseClient(
    supabaseConfig.url!,
    supabaseConfig.serviceRoleKey!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
