/**
 * Backfill script for product scope embeddings
 *
 * Generates and stores embeddings for all existing product scopes
 * that don't have embeddings yet.
 *
 * Run: npx tsx app/src/scripts/backfill-product-scope-embeddings.ts
 */

import { db } from '@/lib/db'
import { productScopes, embeddings } from '@/lib/db/schema/app'
import { desc, eq } from 'drizzle-orm'
import { batchEmbedProductScopes } from '@/lib/product-scopes/embedding-service'

async function backfillProductScopeEmbeddings() {
  console.log('[backfill] Starting product scope embedding backfill...')

  const allScopes = await db
    .select({
      id: productScopes.id,
      project_id: productScopes.project_id,
      name: productScopes.name,
      description: productScopes.description,
      type: productScopes.type,
      goals: productScopes.goals,
    })
    .from(productScopes)
    .orderBy(desc(productScopes.created_at))

  if (allScopes.length === 0) {
    console.log('[backfill] No product scopes found to embed.')
    return
  }

  console.log(`[backfill] Found ${allScopes.length} product scopes to process`)

  const existingEmbeddingRows = await db
    .select({ entity_id: embeddings.entity_id })
    .from(embeddings)
    .where(eq(embeddings.entity_type, 'product_scope'))

  const existingIds = new Set(existingEmbeddingRows.map((e) => e.entity_id))
  const scopesToEmbed = allScopes.filter((s) => !existingIds.has(s.id))

  console.log(`[backfill] ${existingIds.size} product scopes already have embeddings`)
  console.log(`[backfill] ${scopesToEmbed.length} product scopes need embeddings`)

  if (scopesToEmbed.length === 0) {
    console.log('[backfill] All product scopes already have embeddings. Done!')
    return
  }

  const { embedded, errors } = await batchEmbedProductScopes(
    scopesToEmbed.map((s) => ({
      ...s,
      goals: (s.goals as Array<{ id: string; text: string }>) ?? null,
    }))
  )

  console.log('\n[backfill] Backfill complete!')
  console.log(`[backfill] Total embedded: ${embedded}/${scopesToEmbed.length}`)

  if (errors.length > 0) {
    console.log(`[backfill] Errors (${errors.length}):`)
    errors.forEach((e) => console.log(`  - ${e}`))
  }
}

backfillProductScopeEmbeddings()
  .then(() => {
    console.log('[backfill] Script finished.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[backfill] Script failed:', error)
    process.exit(1)
  })
