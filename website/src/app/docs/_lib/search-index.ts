import { getAllDocSlugs, getDocContent } from './markdown'
import { DOCS_NAV } from '../_config/docs-nav'

export interface SearchIndexEntry {
  title: string
  description: string
  category: string
  categoryTitle: string
  slug: string
  href: string
  content: string
}

/** Strip markdown syntax to produce plain text for search indexing */
function stripMarkdown(md: string): string {
  return (
    md
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove table formatting
      .replace(/\|/g, ' ')
      .replace(/^[-:\s|]+$/gm, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Collapse whitespace
      .replace(/\n{2,}/g, '\n')
      .replace(/\s{2,}/g, ' ')
      .trim()
  )
}

function getCategoryTitle(category: string): string {
  for (const cat of DOCS_NAV) {
    if (cat.slug === category) return cat.title
    // Check if the category is inside a subsection
    for (const sub of cat.subsections ?? []) {
      for (const item of sub.items) {
        if (item.href === `/docs/${category}`) return cat.title
      }
    }
  }
  return category
}

let cachedIndex: SearchIndexEntry[] | null = null

export function generateSearchIndex(): SearchIndexEntry[] {
  if (cachedIndex) return cachedIndex

  const slugs = getAllDocSlugs()
  const entries: SearchIndexEntry[] = []

  for (const { category, slug } of slugs) {
    const doc = getDocContent(category, slug)
    if (!doc) continue

    entries.push({
      title: doc.meta.title,
      description: doc.meta.description,
      category,
      categoryTitle: getCategoryTitle(category),
      slug,
      href: `/docs/${category}/${slug}`,
      content: stripMarkdown(doc.content).slice(0, 2000),
    })
  }

  cachedIndex = entries
  return entries
}
