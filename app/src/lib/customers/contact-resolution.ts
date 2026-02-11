/**
 * Contact Resolution Service
 *
 * Resolves session user metadata to contacts. Handles:
 * - Email extraction from user_metadata (case-insensitive key lookup)
 * - Matching against existing contacts by email
 * - Auto-creating contacts when no match found
 * - Company resolution from email domain
 * - Updating session contact_id FK
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContactRecord } from '@/types/customer'

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
 * Uses admin client since this runs in the session review workflow (no user auth).
 */
export async function resolveContactForSession(
  supabase: SupabaseClient,
  params: {
    projectId: string
    sessionId: string
    userMetadata: Record<string, string> | null
  }
): Promise<ContactResolutionResult> {
  const { projectId, sessionId, userMetadata } = params

  // 1. Extract and validate email
  const email = extractEmail(userMetadata)
  if (!email || !isValidEmail(email)) {
    return { contactId: null, created: false, companyId: null }
  }

  try {
    // 2. Look up existing contact
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, company_id')
      .eq('project_id', projectId)
      .eq('email', email)
      .single()

    if (existingContact) {
      // 3. Update last_contacted_at and link to session
      await Promise.all([
        supabase
          .from('contacts')
          .update({ last_contacted_at: new Date().toISOString() })
          .eq('id', existingContact.id),
        supabase
          .from('sessions')
          .update({ contact_id: existingContact.id })
          .eq('id', sessionId),
      ])

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
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('project_id', projectId)
        .eq('domain', domain)
        .single()

      if (company) {
        companyId = company.id
      }
    }

    // 6. Insert new contact
    const { data: newContact, error: insertError } = await supabase
      .from('contacts')
      .insert({
        project_id: projectId,
        name,
        email,
        company_id: companyId,
        role: role,
        title: title,
        phone: phone,
        is_champion: false,
        last_contacted_at: new Date().toISOString(),
        custom_fields: {},
        is_archived: false,
      })
      .select('id')
      .single()

    if (insertError || !newContact) {
      // Handle race condition: another process may have created the same contact
      if (insertError?.code === '23505') {
        // Unique constraint violation -- contact was created concurrently
        const { data: raceContact } = await supabase
          .from('contacts')
          .select('id, company_id')
          .eq('project_id', projectId)
          .eq('email', email)
          .single()

        if (raceContact) {
          await supabase
            .from('sessions')
            .update({ contact_id: raceContact.id })
            .eq('id', sessionId)

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

    // 7. Link session to new contact
    await supabase
      .from('sessions')
      .update({ contact_id: newContact.id })
      .eq('id', sessionId)

    return {
      contactId: newContact.id,
      created: true,
      companyId,
    }
  } catch (error) {
    console.error('[contact-resolution] Unexpected error resolving contact', error)
    return { contactId: null, created: false, companyId: null }
  }
}
