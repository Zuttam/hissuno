export interface TocItem {
  id: string
  title: string
  level: 2 | 3
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    // Skip headings inside code blocks
    if (line.startsWith('```')) continue

    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (!match) continue

    const level = match[1].length as 2 | 3
    const title = match[2].trim()
    const id = slugify(title)

    items.push({ id, title, level })
  }

  return items
}
