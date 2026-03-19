/**
 * Backfill script for session and contact embeddings
 *
 * Generates and stores embeddings for all existing sessions/contacts
 * that don't have embeddings yet.
 *
 * Run: npx tsx app/src/scripts/backfill-embeddings.ts [sessions|contacts|all]
 */

import { db } from '@/lib/db'
import { sessions, sessionEmbeddings, contacts, contactEmbeddings, companies } from '@/lib/db/schema/app'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { batchEmbedSessions } from '@/lib/sessions/embedding-service'
import { batchEmbedContacts } from '@/lib/customers/contact-embedding-service'

async function backfillSessionEmbeddings() {
  console.log('\n[backfill] Starting session embedding backfill...')

  // Get all sessions with non-null name + description
  const allSessions = await db
    .select({
      id: sessions.id,
      project_id: sessions.project_id,
      name: sessions.name,
      description: sessions.description,
    })
    .from(sessions)
    .where(and(isNotNull(sessions.name), isNotNull(sessions.description)))
    .orderBy(desc(sessions.created_at))

  if (allSessions.length === 0) {
    console.log('[backfill] No sessions found to embed.')
    return { embedded: 0, errors: [] as string[] }
  }

  console.log(`[backfill] Found ${allSessions.length} sessions with name+description`)

  // Check which sessions already have embeddings
  const existingEmbeddingRows = await db
    .select({ session_id: sessionEmbeddings.session_id })
    .from(sessionEmbeddings)

  const existingIds = new Set(existingEmbeddingRows.map((e) => e.session_id))
  const sessionsToEmbed = allSessions.filter((s) => !existingIds.has(s.id))

  console.log(`[backfill] ${existingIds.size} sessions already have embeddings`)
  console.log(`[backfill] ${sessionsToEmbed.length} sessions need embeddings`)

  if (sessionsToEmbed.length === 0) {
    console.log('[backfill] All sessions already have embeddings. Done!')
    return { embedded: 0, errors: [] as string[] }
  }

  // Process in batches of 10
  const batchSize = 10
  let totalEmbedded = 0
  const allErrors: string[] = []

  for (let i = 0; i < sessionsToEmbed.length; i += batchSize) {
    const batch = sessionsToEmbed.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(sessionsToEmbed.length / batchSize)

    console.log(`[backfill] Processing session batch ${batchNum}/${totalBatches}...`)

    const { embedded, errors } = await batchEmbedSessions(
      batch.map((s) => ({
        id: s.id,
        project_id: s.project_id,
        name: s.name!,
        description: s.description!,
      }))
    )
    totalEmbedded += embedded
    allErrors.push(...errors)

    if (i + batchSize < sessionsToEmbed.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return { embedded: totalEmbedded, errors: allErrors }
}

async function backfillContactEmbeddings() {
  console.log('\n[backfill] Starting contact embedding backfill...')

  // Get all non-archived contacts with company data
  const allContacts = await db
    .select({
      id: contacts.id,
      project_id: contacts.project_id,
      name: contacts.name,
      email: contacts.email,
      role: contacts.role,
      title: contacts.title,
      notes: contacts.notes,
      companyName: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.company_id, companies.id))
    .where(eq(contacts.is_archived, false))
    .orderBy(desc(contacts.created_at))

  if (allContacts.length === 0) {
    console.log('[backfill] No contacts found to embed.')
    return { embedded: 0, errors: [] as string[] }
  }

  console.log(`[backfill] Found ${allContacts.length} contacts`)

  // Check which contacts already have embeddings
  const existingEmbeddingRows = await db
    .select({ contact_id: contactEmbeddings.contact_id })
    .from(contactEmbeddings)

  const existingIds = new Set(existingEmbeddingRows.map((e) => e.contact_id))
  const contactsToEmbed = allContacts.filter((c) => !existingIds.has(c.id))

  console.log(`[backfill] ${existingIds.size} contacts already have embeddings`)
  console.log(`[backfill] ${contactsToEmbed.length} contacts need embeddings`)

  if (contactsToEmbed.length === 0) {
    console.log('[backfill] All contacts already have embeddings. Done!')
    return { embedded: 0, errors: [] as string[] }
  }

  // Process in batches of 10
  const batchSize = 10
  let totalEmbedded = 0
  const allErrors: string[] = []

  for (let i = 0; i < contactsToEmbed.length; i += batchSize) {
    const batch = contactsToEmbed.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(contactsToEmbed.length / batchSize)

    console.log(`[backfill] Processing contact batch ${batchNum}/${totalBatches}...`)

    const { embedded, errors } = await batchEmbedContacts(
      batch.map((c) => ({
        id: c.id,
        project_id: c.project_id,
        name: c.name,
        email: c.email,
        role: c.role,
        title: c.title,
        companyName: c.companyName ?? null,
        notes: c.notes,
      }))
    )
    totalEmbedded += embedded
    allErrors.push(...errors)

    if (i + batchSize < contactsToEmbed.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  return { embedded: totalEmbedded, errors: allErrors }
}

async function main() {
  const target = process.argv[2] ?? 'all'

  if (!['sessions', 'contacts', 'all'].includes(target)) {
    console.error('Usage: npx tsx app/src/scripts/backfill-embeddings.ts [sessions|contacts|all]')
    process.exit(1)
  }

  console.log(`[backfill] Starting embedding backfill (target: ${target})...`)

  if (target === 'sessions' || target === 'all') {
    const { embedded, errors } = await backfillSessionEmbeddings()
    console.log(`[backfill] Sessions embedded: ${embedded}`)
    if (errors.length > 0) {
      console.log(`[backfill] Session errors (${errors.length}):`)
      errors.forEach((e) => console.log(`  - ${e}`))
    }
  }

  if (target === 'contacts' || target === 'all') {
    const { embedded, errors } = await backfillContactEmbeddings()
    console.log(`[backfill] Contacts embedded: ${embedded}`)
    if (errors.length > 0) {
      console.log(`[backfill] Contact errors (${errors.length}):`)
      errors.forEach((e) => console.log(`  - ${e}`))
    }
  }

  console.log('\n[backfill] Backfill complete!')
}

main()
  .then(() => {
    console.log('[backfill] Script finished.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[backfill] Script failed:', error)
    process.exit(1)
  })
