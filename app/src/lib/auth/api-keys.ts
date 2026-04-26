import { randomBytes, createHash } from 'crypto'
import { db } from '@/lib/db'
import { projectApiKeys, projectMembers } from '@/lib/db/schema/app'
import { eq, and, isNull, desc, count as drizzleCount, asc } from 'drizzle-orm'
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

  // Enforce max active keys per project (H2 fix)
  const [countResult] = await db
    .select({ count: drizzleCount() })
    .from(projectApiKeys)
    .where(
      and(
        eq(projectApiKeys.project_id, projectId),
        isNull(projectApiKeys.revoked_at)
      )
    )

  if ((countResult?.count ?? 0) >= MAX_ACTIVE_KEYS_PER_PROJECT) {
    throw new Error(`Maximum of ${MAX_ACTIVE_KEYS_PER_PROJECT} active API keys per project.`)
  }

  const rawKey = randomBytes(KEY_RANDOM_BYTES).toString('base64url')
  const fullKey = `${KEY_PREFIX}${rawKey}`
  const keyHash = hashKey(fullKey)
  const keyPrefix = fullKey.slice(0, DISPLAY_PREFIX_LENGTH)

  const [data] = await db
    .insert(projectApiKeys)
    .values({
      project_id: projectId,
      created_by_user_id: createdByUserId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      expires_at: expiresAt ? new Date(expiresAt) : null,
    })
    .returning({
      id: projectApiKeys.id,
      project_id: projectApiKeys.project_id,
      created_by_user_id: projectApiKeys.created_by_user_id,
      name: projectApiKeys.name,
      key_prefix: projectApiKeys.key_prefix,
      last_used_at: projectApiKeys.last_used_at,
      expires_at: projectApiKeys.expires_at,
      revoked_at: projectApiKeys.revoked_at,
      created_at: projectApiKeys.created_at,
    })

  if (!data) {
    console.error(`${LOG_PREFIX} Failed to insert API key`)
    throw new Error('Failed to create API key.')
  }

  return {
    key: {
      ...data,
      last_used_at: data.last_used_at?.toISOString() ?? null,
      expires_at: data.expires_at?.toISOString() ?? null,
      revoked_at: data.revoked_at?.toISOString() ?? null,
      created_at: data.created_at?.toISOString() ?? null,
    } as ApiKeyRecord,
    fullKey,
  }
}

/**
 * Mint a short-TTL, project-scoped API key for an automation run.
 *
 * Used by the dispatcher to pre-authenticate the `hissuno` CLI inside the
 * agent sandbox. The plaintext only lives in the run's process memory;
 * once the run finishes the dispatcher revokes the key.
 *
 * The audit `created_by_user_id` defaults to the project's earliest admin
 * member — automations are implicitly authorized by whoever enabled them
 * for the project, and event-triggered runs have no current user.
 */
export async function mintAutomationApiKey(options: {
  projectId: string
  runId: string
  ttlMs?: number
}): Promise<{ keyId: string; fullKey: string }> {
  const ttlMs = options.ttlMs ?? 60 * 60 * 1000

  const adminRow = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, options.projectId),
        eq(projectMembers.role, 'admin'),
        eq(projectMembers.status, 'active'),
      ),
    )
    .orderBy(asc(projectMembers.created_at))
    .limit(1)
  const createdByUserId = adminRow[0]?.user_id
  if (!createdByUserId) {
    throw new Error(
      `No active admin found for project ${options.projectId}; cannot mint automation API key.`,
    )
  }

  const result = await createApiKey({
    projectId: options.projectId,
    createdByUserId,
    name: `automation:${options.runId}`,
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
  })

  return { keyId: result.key.id, fullKey: result.fullKey }
}

/**
 * Resolve an API key from its raw value.
 * Validates not revoked/expired.
 * Updates last_used_at asynchronously (H4 fix).
 */
export async function resolveApiKey(key: string): Promise<{
  keyId: string
  projectId: string
  createdByUserId: string
} | null> {
  const keyHash = hashKey(key)

  const [data] = await db
    .select({
      id: projectApiKeys.id,
      project_id: projectApiKeys.project_id,
      created_by_user_id: projectApiKeys.created_by_user_id,
      revoked_at: projectApiKeys.revoked_at,
      expires_at: projectApiKeys.expires_at,
    })
    .from(projectApiKeys)
    .where(eq(projectApiKeys.key_hash, keyHash))
    .limit(1)

  if (!data) {
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

  // Update last_used_at asynchronously (fire-and-forget, H4 fix)
  void db
    .update(projectApiKeys)
    .set({ last_used_at: new Date() })
    .where(eq(projectApiKeys.id, data.id))
    .then(undefined, (updateError) => {
      console.error(`${LOG_PREFIX} Failed to update last_used_at`, updateError)
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
export async function revokeApiKey(keyId: string, projectId: string): Promise<void> {
  const result = await db
    .update(projectApiKeys)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(projectApiKeys.id, keyId),
        eq(projectApiKeys.project_id, projectId)
      )
    )
    .returning({ id: projectApiKeys.id })

  if (result.length === 0) {
    console.error(`${LOG_PREFIX} Failed to revoke API key`, keyId)
    throw new Error('Failed to revoke API key.')
  }
}

/**
 * Revoke all API keys for a project (H2 fix).
 */
export async function revokeAllApiKeys(projectId: string): Promise<void> {
  await db
    .update(projectApiKeys)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(projectApiKeys.project_id, projectId),
        isNull(projectApiKeys.revoked_at)
      )
    )
}

/**
 * List API keys for a project (prefix only, no hashes).
 */
export async function listApiKeys(projectId: string): Promise<ApiKeyRecord[]> {
  const data = await db
    .select({
      id: projectApiKeys.id,
      project_id: projectApiKeys.project_id,
      created_by_user_id: projectApiKeys.created_by_user_id,
      name: projectApiKeys.name,
      key_prefix: projectApiKeys.key_prefix,
      last_used_at: projectApiKeys.last_used_at,
      expires_at: projectApiKeys.expires_at,
      revoked_at: projectApiKeys.revoked_at,
      created_at: projectApiKeys.created_at,
    })
    .from(projectApiKeys)
    .where(eq(projectApiKeys.project_id, projectId))
    .orderBy(desc(projectApiKeys.created_at))

  return data.map((row) => ({
    ...row,
    last_used_at: row.last_used_at?.toISOString() ?? null,
    expires_at: row.expires_at?.toISOString() ?? null,
    revoked_at: row.revoked_at?.toISOString() ?? null,
    created_at: row.created_at?.toISOString() ?? null,
  })) as ApiKeyRecord[]
}
