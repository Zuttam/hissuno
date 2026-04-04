import fs from 'fs'
import path from 'path'

interface DocMeta {
  title: string
  description: string
}

interface DocContent {
  meta: DocMeta
  content: string
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs')

function parseFrontmatter(raw: string): { meta: DocMeta; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)

  if (!match) {
    return {
      meta: { title: '', description: '' },
      content: raw,
    }
  }

  const frontmatter = match[1]
  const content = match[2]

  const meta: Record<string, string> = {}
  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue
    const key = line.slice(0, colonIndex).trim()
    let value = line.slice(colonIndex + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    meta[key] = value
  }

  return {
    meta: {
      title: meta.title || '',
      description: meta.description || '',
    },
    content,
  }
}

export function getDocContent(category: string, slug: string): DocContent | null {
  const filePath = path.join(CONTENT_DIR, category, `${slug}.md`)

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return parseFrontmatter(raw)
  } catch {
    return null
  }
}

export function getAllDocSlugs(): { category: string; slug: string }[] {
  const slugs: { category: string; slug: string }[] = []

  try {
    const categories = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })

    for (const cat of categories) {
      if (!cat.isDirectory()) continue

      const files = fs.readdirSync(path.join(CONTENT_DIR, cat.name))

      for (const file of files) {
        if (!file.endsWith('.md')) continue
        slugs.push({ category: cat.name, slug: file.replace(/\.md$/, '') })
      }
    }
  } catch {
    // Content directory doesn't exist yet
  }

  return slugs
}
