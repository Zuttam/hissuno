/**
 * Backfill script for issue embeddings
 *
 * This script generates and stores embeddings for all existing issues
 * that don't have embeddings yet.
 *
 * Run: npx tsx app/src/scripts/backfill-issue-embeddings.ts
 */

import { createAdminClient } from '@/lib/supabase/server'
import { batchEmbedIssues } from '@/lib/issues/embedding-service'

async function backfillIssueEmbeddings() {
  console.log('[backfill] Starting issue embedding backfill...')

  const supabase = createAdminClient()

  // Get all issues that don't have embeddings yet
  const { data: issues, error } = await supabase
    .from('issues')
    .select('id, project_id, title, description')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[backfill] Failed to fetch issues:', error.message)
    process.exit(1)
  }

  if (!issues || issues.length === 0) {
    console.log('[backfill] No issues found to embed.')
    return
  }

  console.log(`[backfill] Found ${issues.length} issues to process`)

  // Check which issues already have embeddings
  const { data: existingEmbeddings } = await supabase
    .from('issue_embeddings')
    .select('issue_id')

  const existingIds = new Set((existingEmbeddings ?? []).map((e) => e.issue_id))
  const issuesToEmbed = issues.filter((i) => !existingIds.has(i.id))

  console.log(`[backfill] ${existingIds.size} issues already have embeddings`)
  console.log(`[backfill] ${issuesToEmbed.length} issues need embeddings`)

  if (issuesToEmbed.length === 0) {
    console.log('[backfill] All issues already have embeddings. Done!')
    return
  }

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10
  let totalEmbedded = 0
  const allErrors: string[] = []

  for (let i = 0; i < issuesToEmbed.length; i += batchSize) {
    const batch = issuesToEmbed.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(issuesToEmbed.length / batchSize)

    console.log(`[backfill] Processing batch ${batchNum}/${totalBatches}...`)

    const { embedded, errors } = await batchEmbedIssues(batch)
    totalEmbedded += embedded
    allErrors.push(...errors)

    // Small delay between batches to avoid rate limits
    if (i + batchSize < issuesToEmbed.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  console.log('\n[backfill] Backfill complete!')
  console.log(`[backfill] Total embedded: ${totalEmbedded}/${issuesToEmbed.length}`)

  if (allErrors.length > 0) {
    console.log(`[backfill] Errors (${allErrors.length}):`)
    allErrors.forEach((e) => console.log(`  - ${e}`))
  }
}

// Run the backfill
backfillIssueEmbeddings()
  .then(() => {
    console.log('[backfill] Script finished.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[backfill] Script failed:', error)
    process.exit(1)
  })
