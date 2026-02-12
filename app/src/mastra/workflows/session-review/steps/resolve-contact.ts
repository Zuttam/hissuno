/**
 * Step: Resolve Contact
 *
 * Deterministic step (no AI calls) that resolves the session's user to a contact.
 * Matches by email from user_metadata, auto-creates contact if not found.
 * Also resolves company from email domain.
 */

import { createStep } from '@mastra/core/workflows'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveContactForSession } from '@/lib/customers/contact-resolution'
import { preparedPMContextSchema } from '../schemas'

export const resolveContact = createStep({
  id: 'resolve-contact',
  description: 'Resolve session user to a contact by email matching',
  inputSchema: preparedPMContextSchema,
  outputSchema: preparedPMContextSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId, session } = inputData
    logger?.info('[resolve-contact] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Resolving contact...' })

    const supabase = createAdminClient()

    const result = await resolveContactForSession(supabase, {
      projectId,
      sessionId,
      userMetadata: session.userMetadata,
    })

    if (result.contactId) {
      logger?.info('[resolve-contact] Resolved', {
        contactId: result.contactId,
        created: result.created,
        companyId: result.companyId,
      })
      await writer?.write({
        type: 'progress',
        message: result.created ? 'Created new contact' : 'Matched existing contact',
      })
    } else {
      logger?.info('[resolve-contact] No email found, skipping')
      await writer?.write({ type: 'progress', message: 'No email found, skipping contact resolution' })
    }

    // Pass through all data unchanged -- the contact link is now on the session row
    return inputData
  },
})
