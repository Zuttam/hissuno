import { createServerClient, createBrowserClient as createSupabaseClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { supabaseConfig, isSupabaseConfigured, isServiceRoleConfigured } from '@/lib/config/supabase'
import { API_KEY_ID_HEADER, API_KEY_CREATED_BY_HEADER, API_KEY_PROJECT_ID_HEADER } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import type { Database } from '@/types/supabase'

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

export interface RequestScopedClient {
  supabase: SupabaseClient<Database>
  userId: string
  /** Non-null for API key requests. Cross-project queries MUST be scoped to this. */
  apiKeyProjectId: string | null
}

/**
 * Creates a request-scoped Supabase client by reading request headers to determine auth type.
 *
 * - User requests: Returns cookie-based client (RLS enforced) + user ID from getUser().
 * - API key requests: Returns admin client (bypasses RLS) + creator's user ID from headers.
 *
 * Safety: Admin client bypasses RLS, but API keys are always project-scoped.
 * All project-scoped routes pass projectId in queries, so data is correctly scoped.
 * The helper returns apiKeyProjectId for defense-in-depth guards in cross-project queries.
 */
export async function createRequestScopedClient(): Promise<RequestScopedClient> {
  const h = await headers()
  const apiKeyId = h.get(API_KEY_ID_HEADER)

  if (apiKeyId) {
    const createdBy = h.get(API_KEY_CREATED_BY_HEADER)
    const projectId = h.get(API_KEY_PROJECT_ID_HEADER)
    if (!createdBy || !projectId) throw new UnauthorizedError('Invalid API key headers.')
    return { supabase: createAdminClient(), userId: createdBy, apiKeyProjectId: projectId }
  }

  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new UnauthorizedError()
  return { supabase, userId: user.id, apiKeyProjectId: null }
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
