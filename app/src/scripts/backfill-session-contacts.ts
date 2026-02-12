/**
 * Backfill Script: Link existing sessions to contacts
 *
 * Scans sessions that have an email in user_metadata but no contact_id,
 * and runs contact resolution for each.
 *
 * Usage: npx tsx app/src/scripts/backfill-session-contacts.ts
 */

import { createClient } from '@supabase/supabase-js'
import { resolveContactForSession } from '@/lib/customers/contact-resolution'

const BATCH_SIZE = 100

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  console.log('[backfill] Starting session-to-contact backfill...')

  let totalProcessed = 0
  let totalMatched = 0
  let totalCreated = 0
  let totalSkipped = 0
  let offset = 0

  while (true) {
    // Fetch sessions with email in metadata but no contact_id
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('id, project_id, user_metadata')
      .is('contact_id', null)
      .not('user_metadata', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error('[backfill] Error fetching sessions:', error)
      break
    }

    if (!sessions || sessions.length === 0) {
      console.log('[backfill] No more sessions to process.')
      break
    }

    for (const session of sessions) {
      const metadata = session.user_metadata as Record<string, string> | null

      // Quick check: does metadata have an email-like field?
      const hasEmail = metadata && Object.entries(metadata).some(
        ([key, value]) =>
          key.toLowerCase().includes('email') &&
          typeof value === 'string' &&
          value.includes('@')
      )

      if (!hasEmail) {
        totalSkipped++
        continue
      }

      const result = await resolveContactForSession(supabase, {
        projectId: session.project_id,
        sessionId: session.id,
        userMetadata: metadata,
      })

      if (result.contactId) {
        if (result.created) {
          totalCreated++
        } else {
          totalMatched++
        }
      } else {
        totalSkipped++
      }

      totalProcessed++
    }

    console.log(`[backfill] Processed batch at offset ${offset}: ${sessions.length} sessions`)
    offset += BATCH_SIZE

    // Small delay to avoid hammering the DB
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  console.log('\n[backfill] Complete!')
  console.log(`  Total processed: ${totalProcessed}`)
  console.log(`  Matched existing contacts: ${totalMatched}`)
  console.log(`  Created new contacts: ${totalCreated}`)
  console.log(`  Skipped (no email or invalid): ${totalSkipped}`)
}

void main()
