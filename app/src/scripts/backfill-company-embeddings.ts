/**
 * Backfill script for company embeddings
 *
 * Generates and stores embeddings for all existing companies
 * that don't have embeddings yet.
 *
 * Run: npx tsx app/src/scripts/backfill-company-embeddings.ts
 */

import { db } from '@/lib/db'
import { companies, embeddings } from '@/lib/db/schema/app'
import { desc, eq } from 'drizzle-orm'
import { batchEmbedCompanies } from '@/lib/customers/customer-embedding-service'

async function backfillCompanyEmbeddings() {
  console.log('[backfill] Starting company embedding backfill...')

  const allCompanies = await db
    .select({
      id: companies.id,
      project_id: companies.project_id,
      name: companies.name,
      domain: companies.domain,
      industry: companies.industry,
      country: companies.country,
      stage: companies.stage,
      plan_tier: companies.plan_tier,
      product_used: companies.product_used,
      notes: companies.notes,
    })
    .from(companies)
    .orderBy(desc(companies.created_at))

  if (allCompanies.length === 0) {
    console.log('[backfill] No companies found to embed.')
    return
  }

  console.log(`[backfill] Found ${allCompanies.length} companies to process`)

  const existingEmbeddingRows = await db
    .select({ entity_id: embeddings.entity_id })
    .from(embeddings)
    .where(eq(embeddings.entity_type, 'company'))

  const existingIds = new Set(existingEmbeddingRows.map((e) => e.entity_id))
  const companiesToEmbed = allCompanies.filter((c) => !existingIds.has(c.id))

  console.log(`[backfill] ${existingIds.size} companies already have embeddings`)
  console.log(`[backfill] ${companiesToEmbed.length} companies need embeddings`)

  if (companiesToEmbed.length === 0) {
    console.log('[backfill] All companies already have embeddings. Done!')
    return
  }

  const batchSize = 10
  let totalEmbedded = 0
  const allErrors: string[] = []

  for (let i = 0; i < companiesToEmbed.length; i += batchSize) {
    const batch = companiesToEmbed.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(companiesToEmbed.length / batchSize)

    console.log(`[backfill] Processing batch ${batchNum}/${totalBatches}...`)

    const { embedded, errors } = await batchEmbedCompanies(batch)
    totalEmbedded += embedded
    allErrors.push(...errors)

    if (i + batchSize < companiesToEmbed.length) {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  console.log('\n[backfill] Backfill complete!')
  console.log(`[backfill] Total embedded: ${totalEmbedded}/${companiesToEmbed.length}`)

  if (allErrors.length > 0) {
    console.log(`[backfill] Errors (${allErrors.length}):`)
    allErrors.forEach((e) => console.log(`  - ${e}`))
  }
}

backfillCompanyEmbeddings()
  .then(() => {
    console.log('[backfill] Script finished.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[backfill] Script failed:', error)
    process.exit(1)
  })
