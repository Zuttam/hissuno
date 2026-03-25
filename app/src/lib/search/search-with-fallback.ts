export interface SearchWithFallbackOptions<T> {
  logPrefix: string
  semanticSearch: () => Promise<T[]>
  textFallback: () => Promise<T[]>
}

export async function searchWithFallback<T>(
  options: SearchWithFallbackOptions<T>
): Promise<T[]> {
  try {
    const results = await options.semanticSearch()
    if (results.length > 0) return results
  } catch (err) {
    console.warn(`${options.logPrefix} semantic search failed, falling back to text search`, err)
  }
  return options.textFallback()
}
