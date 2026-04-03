/**
 * Pure helper functions for Zendesk ticket sync.
 */

import type { ZendeskTicket, ZendeskUser, ZendeskOrganization } from './client'

export function mapAuthorToSenderType(authorId: number, requesterId: number): 'user' | 'human_agent' {
  return authorId === requesterId ? 'user' : 'human_agent'
}

/** Deterministic session ID for deduplication. */
export function generateSessionId(ticketId: number, projectId: string): string {
  return `zendesk-${ticketId}-${projectId}`
}

export function buildUserMetadata(
  ticket: ZendeskTicket,
  user: ZendeskUser | null,
  organization: ZendeskOrganization | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    zendesk_ticket_id: ticket.id,
  }

  if (ticket.tags?.length) {
    metadata.zendesk_tags = ticket.tags.join(', ')
  }
  if (ticket.priority) {
    metadata.zendesk_priority = ticket.priority
  }
  if (ticket.group_id) {
    metadata.zendesk_group_id = String(ticket.group_id)
  }

  if (user) {
    if (user.name) metadata.name = user.name
    if (user.email) metadata.email = user.email
    if (user.phone) metadata.phone = user.phone
    if (user.time_zone) metadata.timezone = user.time_zone
    if (user.tags?.length) {
      metadata.zendesk_user_tags = user.tags.join(', ')
    }
  }

  if (organization) {
    metadata.company = organization.name
    if (organization.domain_names?.length) {
      metadata.company_domain = organization.domain_names[0]
    }
  }

  return metadata
}
