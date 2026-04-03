/**
 * Pure helper functions extracted from Intercom sync logic.
 * These have no side effects and are easy to test independently.
 */

import type { IntercomContact, IntercomConversation } from './client'
import { stripHtml } from '@/lib/integrations/shared/sync-utils'

/**
 * Map Intercom author type to Hissuno sender type
 */
export function mapAuthorTypeToSenderType(authorType: string): 'user' | 'ai' | 'human_agent' {
  switch (authorType) {
    case 'user':
      // Intercom "user" is the contact (customer)
      return 'user'
    case 'admin':
      // Intercom "admin" is a team member
      return 'human_agent'
    case 'bot':
      // Intercom bot
      return 'ai'
    case 'team':
      // Team responses
      return 'human_agent'
    default:
      return 'human_agent'
  }
}

/**
 * Generate a session ID from Intercom conversation
 */
export function generateSessionId(conversationId: string): string {
  return `intercom-${conversationId}-${Date.now()}`
}

/**
 * Build enriched user metadata from a full Intercom contact
 */
export function buildUserMetadata(
  conversationId: string,
  contact: IntercomContact | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    intercom_conversation_id: conversationId,
  }
  if (!contact) return metadata

  if (contact.name) metadata.name = contact.name
  if (contact.email) metadata.email = contact.email
  if (contact.phone) metadata.phone = contact.phone
  if (contact.role) metadata.role = contact.role
  if (contact.location?.city) metadata.city = contact.location.city
  if (contact.location?.region) metadata.region = contact.location.region
  if (contact.location?.country) metadata.country = contact.location.country
  if (contact.companies?.companies?.[0]?.name) {
    metadata.company = contact.companies.companies[0].name
  }
  if (contact.browser) metadata.browser = contact.browser
  if (contact.os) metadata.os = contact.os
  if (contact.last_seen_at) {
    metadata.last_seen_at = new Date(contact.last_seen_at * 1000).toISOString()
  }
  if (contact.signed_up_at) {
    metadata.signed_up_at = new Date(contact.signed_up_at * 1000).toISOString()
  }
  if (contact.tags?.tags?.length) {
    metadata.tags = contact.tags.tags.map((t) => t.name).join(', ')
  }
  if (contact.social_profiles?.data?.length) {
    for (const profile of contact.social_profiles.data) {
      metadata[`social_${profile.name.toLowerCase()}`] = profile.url
    }
  }
  if (contact.custom_attributes) {
    for (const [key, value] of Object.entries(contact.custom_attributes)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        metadata[`custom_${key}`] = String(value)
      }
    }
  }

  return metadata
}

/**
 * Generate session name from conversation
 */
export function generateSessionName(conversation: IntercomConversation): string {
  if (conversation.title) {
    return conversation.title
  }

  const firstMessage = conversation.source?.body
  if (firstMessage) {
    const cleaned = stripHtml(firstMessage)
    if (cleaned.length > 50) {
      return cleaned.substring(0, 47) + '...'
    }
    return cleaned || 'Intercom Conversation'
  }

  return 'Intercom Conversation'
}
