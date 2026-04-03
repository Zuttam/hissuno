export type SearchMode = 'semantic' | 'keyword' | 'both'

export interface SearchByModeOptions<T> {
  logPrefix: string
  semanticSearch: () => Promise<T[]>
  keywordSearch: () => Promise<T[]>
  mode?: SearchMode
}

export function searchByMode<T>(
  options: SearchByModeOptions<T>
): Promise<T[]> {
  const mode = options.mode ?? 'semantic'

  if (mode === 'keyword') {
    return options.keywordSearch()
  }

  if (mode === 'semantic') {
    return options.semanticSearch()
  }

  // Default: run both in parallel, deduplicate
  return searchBoth(options)
}

async function searchBoth<T>(options: SearchByModeOptions<T>): Promise<T[]> {
  const [semanticResult, keywordResult] = await Promise.allSettled([
    options.semanticSearch(),
    options.keywordSearch(),
  ])

  const semantic =
    semanticResult.status === 'fulfilled' ? semanticResult.value : []
  const keyword =
    keywordResult.status === 'fulfilled' ? keywordResult.value : []

  if (semanticResult.status === 'rejected') {
    console.warn(`${options.logPrefix} semantic search failed`, semanticResult.reason)
  }
  if (keywordResult.status === 'rejected') {
    console.warn(`${options.logPrefix} keyword search failed`, keywordResult.reason)
  }

  // Deduplicate by id, preferring semantic (scored) results
  const seen = new Set<string>()
  const merged: T[] = []
  for (const item of [...semantic, ...keyword]) {
    const id = (item as Record<string, unknown>).id as string
    if (!seen.has(id)) {
      seen.add(id)
      merged.push(item)
    }
  }
  return merged
}
