import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { UnauthorizedError } from './server'

type DbClient = SupabaseClient<Database>

export async function assertUserOwnsProject(client: DbClient, userId: string, projectId: string) {
  const { data, error } = await client
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('[auth] Failed verifying project ownership', { projectId, userId }, error)
    throw new Error('Unable to verify resource ownership.')
  }

  if (!data) {
    throw new UnauthorizedError()
  }
}
