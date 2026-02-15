/**
 * Contacts Database Layer
 *
 * Pure database operations for contacts.
 */

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from './server'
import type {
  ContactRecord,
  ContactWithCompany,
  ContactFilters,
  UpdateContactInput,
} from '@/types/customer'
import type { SessionSource } from '@/types/session'
import type { IssueType, IssueStatus } from '@/types/issue'

/** Escape special PostgREST filter characters to prevent filter injection. */
function sanitizeSearchInput(input: string): string {
  return input.replace(/[\\%_.,()]/g, '\\$&')
}

const selectContactWithCompany = '*, company:companies(id, name, domain)'

// ============================================================================
// Pure DB Operations (accept Supabase client)
// ============================================================================

export interface InsertContactData {
  projectId: string
  name: string
  email: string
  companyId?: string | null
  role?: string | null
  title?: string | null
  phone?: string | null
  companyUrl?: string | null
  isChampion?: boolean
  lastContactedAt?: string | null
  notes?: string | null
  customFields?: Record<string, unknown>
}

export async function insertContact(
  supabase: SupabaseClient,
  data: InsertContactData
): Promise<ContactRecord> {
  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      project_id: data.projectId,
      name: data.name,
      email: data.email,
      company_id: data.companyId ?? null,
      role: data.role ?? null,
      title: data.title ?? null,
      phone: data.phone ?? null,
      company_url: data.companyUrl ?? null,
      is_champion: data.isChampion ?? false,
      last_contacted_at: data.lastContactedAt ?? null,
      notes: data.notes ?? null,
      custom_fields: data.customFields ?? {},
      is_archived: false,
    })
    .select()
    .single()

  if (error || !contact) {
    console.error('[supabase.contacts.insertContact] Failed', error)
    throw new Error(`Failed to insert contact: ${error?.message ?? 'Unknown error'}`)
  }

  return contact as ContactRecord
}

export async function updateContactById(
  supabase: SupabaseClient,
  contactId: string,
  data: UpdateContactInput
): Promise<ContactRecord> {
  const updates: Record<string, unknown> = {}

  if (data.name !== undefined) updates.name = data.name
  if (data.email !== undefined) updates.email = data.email
  if (data.company_id !== undefined) updates.company_id = data.company_id
  if (data.role !== undefined) updates.role = data.role
  if (data.title !== undefined) updates.title = data.title
  if (data.phone !== undefined) updates.phone = data.phone
  if (data.company_url !== undefined) updates.company_url = data.company_url
  if (data.is_champion !== undefined) updates.is_champion = data.is_champion
  if (data.last_contacted_at !== undefined) updates.last_contacted_at = data.last_contacted_at
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.custom_fields !== undefined) updates.custom_fields = data.custom_fields

  const { data: contact, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', contactId)
    .select()
    .single()

  if (error || !contact) {
    console.error('[supabase.contacts.updateContactById] Failed', contactId, error)
    throw new Error(`Failed to update contact: ${error?.message ?? 'Unknown error'}`)
  }

  return contact as ContactRecord
}

export async function deleteContactById(
  supabase: SupabaseClient,
  contactId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)

  if (error) {
    console.error('[supabase.contacts.deleteContactById] Failed', contactId, error)
    throw new Error(`Failed to delete contact: ${error.message}`)
  }

  return true
}

export async function updateContactArchiveStatus(
  supabase: SupabaseClient,
  contactId: string,
  isArchived: boolean
): Promise<ContactRecord> {
  const { data, error } = await supabase
    .from('contacts')
    .update({
      is_archived: isArchived,
    })
    .eq('id', contactId)
    .select()
    .single()

  if (error || !data) {
    console.error('[supabase.contacts.updateContactArchiveStatus] Failed', contactId, error)
    throw new Error(`Failed to update contact archive status: ${error?.message ?? 'Unknown error'}`)
  }

  return data as ContactRecord
}

// ============================================================================
// Query Functions (use user-authenticated client, with caching)
// ============================================================================

export const listContacts = cache(async (filters: ContactFilters = {}): Promise<{ contacts: ContactWithCompany[], total: number }> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    // Build query
    let query = supabase
      .from('contacts')
      .select(selectContactWithCompany, { count: 'exact' })
      .order('updated_at', { ascending: false })

    // Filter archived (hidden by default)
    if (!filters.showArchived) {
      query = query.eq('is_archived', false)
    }

    // Apply filters
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId)
    }
    if (filters.companyId) {
      query = query.eq('company_id', filters.companyId)
    }
    if (filters.isChampion !== undefined) {
      query = query.eq('is_champion', filters.isChampion)
    }
    if (filters.search) {
      const s = sanitizeSearchInput(filters.search)
      query = query.or(`name.ilike.%${s}%,email.ilike.%${s}%`)
    }
    if (filters.role) {
      query = query.ilike('role', `%${sanitizeSearchInput(filters.role)}%`)
    }
    if (filters.title) {
      query = query.ilike('title', `%${sanitizeSearchInput(filters.title)}%`)
    }

    // Pagination
    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0
    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      console.error('[supabase.contacts] failed to list contacts', error)
      throw new Error('Unable to load contacts.')
    }

    return { contacts: (data ?? []) as ContactWithCompany[], total: count ?? 0 }
  } catch (error) {
    console.error('[supabase.contacts] unexpected error listing contacts', error)
    throw error
  }
})

export const getContactById = cache(async (contactId: string): Promise<ContactWithCompany | null> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .select(selectContactWithCompany)
      .eq('id', contactId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[supabase.contacts] failed to get contact', contactId, error)
      throw new Error('Unable to load contact.')
    }

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', contact.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return null
    }

    return contact as ContactWithCompany
  } catch (error) {
    console.error('[supabase.contacts] unexpected error getting contact', contactId, error)
    throw error
  }
})

// ============================================================================
// Linked Sessions & Issues for Contact Sidebar
// ============================================================================

export interface ContactLinkedSession {
  id: string
  name: string | null
  source: SessionSource
  message_count: number
  created_at: string
  status: string
}

export interface ContactLinkedIssue {
  id: string
  title: string
  type: IssueType
  status: IssueStatus
  upvote_count: number
  created_at: string
}

/**
 * Get sessions linked to a contact.
 */
export const getContactLinkedSessions = cache(async (contactId: string, limit = 20): Promise<ContactLinkedSession[]> => {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sessions')
      .select('id, name, source, message_count, created_at, status')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[supabase.contacts] failed to get contact sessions', contactId, error)
      return []
    }

    return (data ?? []) as ContactLinkedSession[]
  } catch (error) {
    console.error('[supabase.contacts] unexpected error getting contact sessions', contactId, error)
    return []
  }
})

/**
 * Get issues linked to a contact (through sessions via issue_sessions junction).
 */
export const getContactLinkedIssues = cache(async (contactId: string, limit = 20): Promise<ContactLinkedIssue[]> => {
  if (!isSupabaseConfigured()) {
    return []
  }

  try {
    const supabase = await createClient()

    // Single query: sessions -> issue_sessions -> issues (replaces 2 sequential queries)
    const { data } = await supabase
      .from('sessions')
      .select('issue_sessions(issue:issues(id, title, type, status, upvote_count, created_at))')
      .eq('contact_id', contactId)

    if (!data) {
      return []
    }

    // Deduplicate issues (one issue can be linked to multiple sessions from same contact)
    const issueMap = new Map<string, ContactLinkedIssue>()
    for (const session of data) {
      const issueSessionLinks = (session as unknown as { issue_sessions: Array<{ issue: unknown }> }).issue_sessions ?? []
      for (const link of issueSessionLinks) {
        const issue = Array.isArray(link.issue) ? link.issue[0] : link.issue
        if (issue && typeof issue === 'object' && 'id' in issue && !issueMap.has((issue as ContactLinkedIssue).id)) {
          issueMap.set((issue as ContactLinkedIssue).id, issue as ContactLinkedIssue)
        }
      }
    }

    return Array.from(issueMap.values()).slice(0, limit)
  } catch (error) {
    console.error('[supabase.contacts] unexpected error getting contact issues', contactId, error)
    return []
  }
})
