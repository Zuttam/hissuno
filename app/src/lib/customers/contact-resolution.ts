/**
 * Contact Resolution Service
 *
 * Resolves session user metadata to contacts. Handles:
 * - Email extraction from user_metadata (case-insensitive key lookup)
 * - Matching against existing contacts by email
 * - Auto-creating contacts when no match found
 * - Company resolution from email domain
 * - Linking session to contact via entity_relationships
 */

import { db } from '@/lib/db'
import { contacts, companies, entityRelationships } from '@/lib/db/schema/app'
import { isUniqueViolation } from '@/lib/db/errors'
import { eq, and, isNotNull } from 'drizzle-orm'
import type { ContactRecord } from '@/types/customer'
import { buildContactEmbeddingText } from '@/lib/customers/customer-embedding-service'
import { fireEmbedding } from '@/lib/utils/embeddings'
import { setSessionContact } from '@/lib/db/queries/entity-relationships'

// ============================================================================
// Email Utilities
// ============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const GENERIC_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'fastmail.com',
  'tutanota.com',
  'gmx.com',
  'gmx.net',
  'live.com',
  'msn.com',
  'me.com',
  'mac.com',
])

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function extractEmailDomain(email: string): string | null {
  const parts = email.split('@')
  if (parts.length !== 2) return null
  return parts[1].toLowerCase()
}

export function isGenericEmailDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain)
}

/**
 * Extract email from user_metadata with case-insensitive key lookup.
 */
function extractEmail(userMetadata: Record<string, string> | null): string | null {
  if (!userMetadata) return null

  // Try common key variants
  const emailKeys = ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'emailAddress', 'email_address']
  for (const key of emailKeys) {
    const value = userMetadata[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase()
    }
  }

  return null
}

/**
 * Extract name from user_metadata with case-insensitive key lookup.
 */
function extractName(userMetadata: Record<string, string> | null): string | null {
  if (!userMetadata) return null

  const nameKeys = ['name', 'Name', 'NAME', 'fullName', 'full_name', 'displayName', 'display_name']
  for (const key of nameKeys) {
    const value = userMetadata[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

/**
 * Generate a display name from an email address.
 * e.g., "john.doe@acme.com" -> "John Doe"
 */
function nameFromEmail(email: string): string {
  const localPart = email.split('@')[0]
  return localPart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============================================================================
// Resolution Result
// ============================================================================

export interface ContactResolutionResult {
  contactId: string | null
  created: boolean
  companyId: string | null
}

// ============================================================================
// Main Resolution Function
// ============================================================================

/**
 * Resolve a contact for a session based on user metadata.
 *
 * 1. Extracts email from userMetadata
 * 2. Looks up existing contact by (project_id, email)
 * 3. If found: updates last_contacted_at, sets session.contact_id
 * 4. If not found: creates contact, resolves company from domain, sets session.contact_id
 * 5. If no email: returns null (session stays anonymous)
 *
 * Uses db directly since this runs in the session review workflow (no user auth).
 */
export async function resolveContactForSession(
  params: {
    projectId: string
    sessionId: string
    userMetadata: Record<string, string> | null
  }
): Promise<ContactResolutionResult> {
  const { projectId, sessionId, userMetadata } = params

  // 0. If session already has a contact via entity_relationships, skip resolution (preserve manual edits)
  const existingContactLinks = await db
    .select({ contact_id: entityRelationships.contact_id })
    .from(entityRelationships)
    .where(
      and(
        eq(entityRelationships.session_id, sessionId),
        isNotNull(entityRelationships.contact_id),
      ),
    )
    .limit(1)

  const existingContactId = existingContactLinks[0]?.contact_id

  if (existingContactId) {
    return { contactId: existingContactId, created: false, companyId: null }
  }

  // 1. Extract and validate email
  const email = extractEmail(userMetadata)
  if (!email || !isValidEmail(email)) {
    return { contactId: null, created: false, companyId: null }
  }

  try {
    // 2. Look up existing contact
    const existingContacts = await db
      .select({ id: contacts.id, company_id: contacts.company_id })
      .from(contacts)
      .where(
        and(
          eq(contacts.project_id, projectId),
          eq(contacts.email, email)
        )
      )
      .limit(1)

    const existingContact = existingContacts[0]

    if (existingContact) {
      // 3. Update last_contacted_at and link to session via entity_relationships
      await db
        .update(contacts)
        .set({ last_contacted_at: new Date() })
        .where(eq(contacts.id, existingContact.id))

      await setSessionContact(projectId, sessionId, existingContact.id)

      return {
        contactId: existingContact.id,
        created: false,
        companyId: existingContact.company_id,
      }
    }

    // 4. No existing contact -- create one
    const name = extractName(userMetadata) ?? nameFromEmail(email)
    const phone = userMetadata?.phone ?? userMetadata?.Phone ?? null
    const role = userMetadata?.role ?? userMetadata?.Role ?? null
    const title = userMetadata?.title ?? userMetadata?.Title ?? null

    // 5. Resolve company from email domain
    let companyId: string | null = null
    const domain = extractEmailDomain(email)
    if (domain && !isGenericEmailDomain(domain)) {
      const companyRows = await db
        .select({ id: companies.id })
        .from(companies)
        .where(
          and(
            eq(companies.project_id, projectId),
            eq(companies.domain, domain)
          )
        )
        .limit(1)

      const company = companyRows[0]
      if (company) {
        companyId = company.id
      }
    }

    // 6. Insert new contact
    try {
      const [newContact] = await db
        .insert(contacts)
        .values({
          project_id: projectId,
          name,
          email,
          company_id: companyId,
          role: role,
          title: title,
          phone: phone,
          is_champion: false,
          last_contacted_at: new Date(),
          custom_fields: {},
          is_archived: false,
        })
        .returning({ id: contacts.id })

      if (!newContact) {
        console.error('[contact-resolution] Failed to create contact')
        return { contactId: null, created: false, companyId: null }
      }

      // 7. Link session to new contact via entity_relationships
      await setSessionContact(projectId, sessionId, newContact.id)

      // 8. Fire-and-forget: generate embedding for semantic search
      const companyName = companyId
        ? await db
            .select({ name: companies.name })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1)
            .then((rows) => rows[0]?.name ?? null)
        : null
      const embeddingText = buildContactEmbeddingText({ name, email, role, title, companyName })
      fireEmbedding(newContact.id, 'contact', projectId, embeddingText)

      return {
        contactId: newContact.id,
        created: true,
        companyId,
      }
    } catch (insertError: unknown) {
      // Handle race condition: another process may have created the same contact
      if (isUniqueViolation(insertError)) {
        // Unique constraint violation -- contact was created concurrently
        const raceContacts = await db
          .select({ id: contacts.id, company_id: contacts.company_id })
          .from(contacts)
          .where(
            and(
              eq(contacts.project_id, projectId),
              eq(contacts.email, email)
            )
          )
          .limit(1)

        const raceContact = raceContacts[0]

        if (raceContact) {
          await setSessionContact(projectId, sessionId, raceContact.id)

          return {
            contactId: raceContact.id,
            created: false,
            companyId: raceContact.company_id,
          }
        }
      }

      console.error('[contact-resolution] Failed to create contact', insertError)
      return { contactId: null, created: false, companyId: null }
    }
  } catch (error) {
    console.error('[contact-resolution] Unexpected error resolving contact', error)
    return { contactId: null, created: false, companyId: null }
  }
}
