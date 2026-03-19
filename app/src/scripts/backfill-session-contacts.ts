/**
 * Backfill Script: Link existing sessions to contacts
 *
 * Scans sessions that have an email in user_metadata but no contact_id,
 * and runs contact resolution for each.
 *
 * Usage: npx tsx app/src/scripts/backfill-session-contacts.ts
 */

import { db } from '@/lib/db'
import { sessions, entityRelationships } from '@/lib/db/schema/app'
import { isNotNull, asc, and, notInArray } from 'drizzle-orm'
import { resolveContactForSession } from '@/lib/customers/contact-resolution'

const BATCH_SIZE = 100

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
  }

  console.log('[backfill] Starting session-to-contact backfill...')

  let totalProcessed = 0
  let totalMatched = 0
  let totalCreated = 0
  let totalSkipped = 0
  let offset = 0

  while (true) {
    // Fetch sessions that have metadata but are NOT linked to a contact in entity_relationships
    const sessionsWithContact = db
      .select({ session_id: entityRelationships.session_id })
      .from(entityRelationships)
      .where(
        and(
          isNotNull(entityRelationships.session_id),
          isNotNull(entityRelationships.contact_id),
        ),
      )

    const batchSessions = await db
      .select({
        id: sessions.id,
        project_id: sessions.project_id,
        user_metadata: sessions.user_metadata,
      })
      .from(sessions)
      .where(
        and(
          notInArray(sessions.id, sessionsWithContact),
          isNotNull(sessions.user_metadata),
        ),
      )
      .orderBy(asc(sessions.created_at))
      .limit(BATCH_SIZE)
      .offset(offset)

    if (batchSessions.length === 0) {
      console.log('[backfill] No more sessions to process.')
      break
    }

    for (const session of batchSessions) {
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

      const result = await resolveContactForSession({
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

    console.log(`[backfill] Processed batch at offset ${offset}: ${batchSessions.length} sessions`)
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
