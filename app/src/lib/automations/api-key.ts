/**
 * Project-scoped automation API key.
 *
 * Skill-runner sandboxes need a `hissuno` API key to call back into the
 * project. Rather than minting a fresh key per run (DB churn, audit noise,
 * 25-keys-per-project limit pressure), we keep one long-lived "automations"
 * key per project. The plaintext is encrypted at rest with
 * AUTOMATION_KEY_ENC_SECRET so a DB compromise alone doesn't reveal it.
 *
 * The key is created on demand the first time a project runs an automation.
 * Rotation is exposed via `rotateAutomationApiKey` (revokes the old, mints
 * + stores a fresh one).
 */

import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectMembers, projectSettings } from '@/lib/db/schema/app'
import { createApiKey, revokeApiKey } from '@/lib/auth/api-keys'

const ENV_VAR = 'AUTOMATION_KEY_ENC_SECRET'

class MissingEncryptionSecret extends Error {
  constructor() {
    super(
      `Set ${ENV_VAR} (32 raw bytes hex-encoded). Generate with: openssl rand -hex 32`,
    )
  }
}

function loadEncryptionKey(): Buffer {
  const raw = process.env[ENV_VAR]
  if (!raw || raw.length === 0) {
    throw new MissingEncryptionSecret()
  }
  // Accept either hex (64 chars = 32 bytes) or base64 (44 chars padded). For
  // any other length, hash it down to 32 bytes deterministically — this keeps
  // dev setups simple ("paste a passphrase") while production should still
  // use a real 32-byte secret.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  if (raw.length === 44 || raw.length === 43) {
    try {
      const buf = Buffer.from(raw, 'base64')
      if (buf.length === 32) return buf
    } catch {
      // fall through
    }
  }
  return createHash('sha256').update(raw).digest()
}

const SEPARATOR = ':'

function encryptString(plaintext: string): string {
  const key = loadEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    SEPARATOR,
  )
}

function decryptString(payload: string): string {
  const key = loadEncryptionKey()
  const parts = payload.split(SEPARATOR)
  if (parts.length !== 3) throw new Error('Malformed encrypted payload.')
  const [ivB64, tagB64, ctB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

async function findAutomationActor(projectId: string): Promise<string> {
  const row = await db
    .select({ user_id: projectMembers.user_id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.role, 'owner'),
        eq(projectMembers.status, 'active'),
      ),
    )
    .orderBy(asc(projectMembers.created_at))
    .limit(1)
  const userId = row[0]?.user_id
  if (!userId) {
    throw new Error(
      `No active owner found for project ${projectId}; cannot create automation API key.`,
    )
  }
  return userId
}

/**
 * Returns the project's long-lived automation API key plaintext, creating
 * it (and storing the encrypted form on project_settings) if missing.
 */
export async function getOrCreateAutomationApiKey(
  projectId: string,
): Promise<{ keyId: string; fullKey: string }> {
  const [existing] = await db
    .select({
      automation_key_id: projectSettings.automation_key_id,
      automation_key_ciphertext: projectSettings.automation_key_ciphertext,
    })
    .from(projectSettings)
    .where(eq(projectSettings.project_id, projectId))
    .limit(1)

  if (existing?.automation_key_id && existing.automation_key_ciphertext) {
    return {
      keyId: existing.automation_key_id,
      fullKey: decryptString(existing.automation_key_ciphertext),
    }
  }

  const createdByUserId = await findAutomationActor(projectId)
  const minted = await createApiKey({
    projectId,
    createdByUserId,
    name: 'automations',
    expiresAt: null,
  })

  const ciphertext = encryptString(minted.fullKey)

  // project_settings has a row per project; upsert by primary key. If the row
  // doesn't exist yet we insert it (callers usually have one already).
  if (existing) {
    await db
      .update(projectSettings)
      .set({
        automation_key_id: minted.key.id,
        automation_key_ciphertext: ciphertext,
        updated_at: new Date(),
      })
      .where(eq(projectSettings.project_id, projectId))
  } else {
    await db.insert(projectSettings).values({
      project_id: projectId,
      automation_key_id: minted.key.id,
      automation_key_ciphertext: ciphertext,
    })
  }

  return { keyId: minted.key.id, fullKey: minted.fullKey }
}

/**
 * Revoke the existing automation key and mint a fresh one. Used by a future
 * "Rotate automation key" admin action; not exposed in v1 UI.
 */
export async function rotateAutomationApiKey(
  projectId: string,
): Promise<{ keyId: string; fullKey: string }> {
  const [row] = await db
    .select({ automation_key_id: projectSettings.automation_key_id })
    .from(projectSettings)
    .where(eq(projectSettings.project_id, projectId))
    .limit(1)
  if (row?.automation_key_id) {
    await revokeApiKey(row.automation_key_id, projectId).catch((err) => {
      console.error('[automation-key] failed to revoke before rotate', err)
    })
  }

  // Clear the stored key so getOrCreateAutomationApiKey mints a new one.
  await db
    .update(projectSettings)
    .set({
      automation_key_id: null,
      automation_key_ciphertext: null,
      updated_at: new Date(),
    })
    .where(eq(projectSettings.project_id, projectId))

  return getOrCreateAutomationApiKey(projectId)
}
