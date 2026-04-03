/**
 * Pure helper functions for Notion knowledge sync.
 */

import type { NotionPage } from './client'

/** Extract the page title from a Notion page's properties. */
export function extractPageTitle(page: NotionPage): string {
  const properties = page.properties as Record<string, Record<string, unknown>>
  for (const prop of Object.values(properties)) {
    if (prop.type === 'title') {
      const titleArray = prop.title as Array<{ plain_text: string }> | undefined
      if (titleArray && titleArray.length > 0) {
        return titleArray.map((t) => t.plain_text).join('')
      }
    }
  }
  return 'Untitled'
}
