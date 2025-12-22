import { createBrowserClient } from '@supabase/ssr'
import { supabaseConfig } from '@/lib/config/supabase'

export function createClient() {
  return createBrowserClient(
    supabaseConfig.url!,
    supabaseConfig.anonKey!
  )
}
