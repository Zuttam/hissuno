import { z } from 'zod'

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
})

const parsed = supabaseEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})

export const supabaseConfig = {
  url: parsed.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey)
}

export function isServiceRoleConfigured(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.serviceRoleKey)
}

