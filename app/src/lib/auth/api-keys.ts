import { randomBytes, createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import type { ApiKeyRecord, ApiKeyCreateResult } from '@/types/project-members'

const LOG_PREFIX = '[api-keys]'
const KEY_PREFIX = 'hiss_'
const KEY_RANDOM_BYTES = 36 // 48 base64 chars
const DISPLAY_PREFIX_LENGTH = 16
const MAX_ACTIVE_KEYS_PER_PROJECT = 25

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Create a new API key for a project.
 * Returns the full key once — it cannot be retrieved again.
 * Enforces max 25 active keys per project (H2 fix).
 */
export async function createApiKey(options: {
  projectId: string
  createdByUserId: string
  name: string
  expiresAt?: string | null
}): Promise<ApiKeyCreateResult> {
  const { projectId, createdByUserId, name, expiresAt } = options
  const supabase = createAdminClient()

  // Enforce max active keys per project (H2 fix)
  const { count, error: countError } = await supabase
    .from('project_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .is('revoked_at', null)

  if (countError) {
    console.error(`${LOG_PREFIX} Failed to count active keys`, countError)
    throw new Error('Failed to create API key.')
  }

  if ((count ?? 0) >= MAX_ACTIVE_KEYS_PER_PROJECT) {
    throw new Error(`Maximum of ${MAX_ACTIVE_KEYS_PER_PROJECT} active API keys per project.`)
  }

  const rawKey = randomBytes(KEY_RANDOM_BYTES).toString('base64url')
  const fullKey = `${KEY_PREFIX}${rawKey}`
  const keyHash = hashKey(fullKey)
  const keyPrefix = fullKey.slice(0, DISPLAY_PREFIX_LENGTH)

  const { data, error } = await supabase
    .from('project_api_keys')
    .insert({
      project_id: projectId,
      created_by_user_id: createdByUserId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      expires_at: expiresAt ?? null,
    })
    .select('id, project_id, created_by_user_id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at')
    .single()

  if (error || !data) {
    console.error(`${LOG_PREFIX} Failed to insert API key`, error)
    throw new Error('Failed to create API key.')
  }

  return {
    key: data as ApiKeyRecord,
    fullKey,
  }
}

/**
 * Resolve an API key from its raw value.
 * Validates not revoked/expired and verifies creator is_activated (C1 fix).
 * Updates last_used_at asynchronously (H4 fix).
 */
export async function resolveApiKey(key: string): Promise<{
  keyId: string
  projectId: string
  createdByUserId: string
} | null> {
  const keyHash = hashKey(key)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('project_api_keys')
    .select('id, project_id, created_by_user_id, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return null
  }

  // Check if revoked
  if (data.revoked_at) {
    return null
  }

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null
  }

  // Verify creator is activated (C1 fix)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_activated')
    .eq('user_id', data.created_by_user_id)
    .single()

  if (!profile?.is_activated) {
    return null
  }

  // Update last_used_at asynchronously (fire-and-forget, H4 fix)
  void supabase
    .from('project_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(({ error: updateError }) => {
      if (updateError) {
        console.error(`${LOG_PREFIX} Failed to update last_used_at`, updateError)
      }
    })

  return {
    keyId: data.id,
    projectId: data.project_id,
    createdByUserId: data.created_by_user_id,
  }
}

/**
 * Revoke a single API key.
 */
export async function revokeApiKey(keyId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('project_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)

  if (error) {
    console.error(`${LOG_PREFIX} Failed to revoke API key`, keyId, error)
    throw new Error('Failed to revoke API key.')
  }
}

/**
 * Revoke all API keys for a project (H2 fix).
 */
export async function revokeAllApiKeys(projectId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('project_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('revoked_at', null)

  if (error) {
    console.error(`${LOG_PREFIX} Failed to revoke all API keys for project`, projectId, error)
    throw new Error('Failed to revoke all API keys.')
  }
}

/**
 * List API keys for a project (prefix only, no hashes).
 */
export async function listApiKeys(projectId: string): Promise<ApiKeyRecord[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('project_api_keys')
    .select('id, project_id, created_by_user_id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error(`${LOG_PREFIX} Failed to list API keys`, projectId, error)
    throw new Error('Failed to list API keys.')
  }

  return (data ?? []) as ApiKeyRecord[]
}
