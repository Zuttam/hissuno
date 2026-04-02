/**
 * Contact Creation Policy
 *
 * Resolves a session's user metadata to a contact during graph evaluation.
 * Wraps the existing resolveContactForSession utility.
 * Fires cascading graph eval (discovery only) for newly created contacts.
 */

import { resolveContactForSession } from '@/lib/customers/contact-resolution'
import { fireGraphEval } from '@/lib/utils/graph-eval'

export interface ContactCreationInput {
  projectId: string
  sessionId: string
  userMetadata: Record<string, string> | null
}

export interface ContactCreationResult {
  contactId: string | null
  created: boolean
  companyId: string | null
}

/**
 * Run the contact creation policy for a session.
 *
 * 1. Calls resolveContactForSession (email extraction, lookup, auto-create)
 * 2. If a new contact was created, fires cascading graph eval (discovery only, no creation)
 */
export async function runContactCreationPolicy(
  input: ContactCreationInput
): Promise<ContactCreationResult> {
  const { projectId, sessionId, userMetadata } = input

  const result = await resolveContactForSession({
    projectId,
    sessionId,
    userMetadata,
  })

  // Fire cascading graph eval for newly created contacts (discovery only)
  if (result.created && result.contactId) {
    fireGraphEval(projectId, 'contact', result.contactId)
  }

  return {
    contactId: result.contactId,
    created: result.created,
    companyId: result.companyId,
  }
}
