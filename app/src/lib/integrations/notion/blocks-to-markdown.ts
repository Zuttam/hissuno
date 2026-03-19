/**
 * Convert Notion blocks to Markdown.
 * Handles common block types: paragraphs, headings, lists, code, quotes, etc.
 */

import type { NotionBlock, NotionRichText } from './client'

/**
 * Convert an array of Notion blocks to a markdown string.
 */
export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = []

  for (const block of blocks) {
    const line = blockToMarkdown(block)
    if (line !== null) {
      lines.push(line)
    }
  }

  return lines.join('\n\n')
}

function richTextToMarkdown(richTexts: NotionRichText[]): string {
  if (!richTexts || !Array.isArray(richTexts)) return ''

  return richTexts
    .map((rt) => {
      let text = rt.plain_text || ''
      if (!text) return ''

      const annotations = rt.annotations
      if (annotations?.code) text = `\`${text}\``
      if (annotations?.bold) text = `**${text}**`
      if (annotations?.italic) text = `*${text}*`
      if (annotations?.strikethrough) text = `~~${text}~~`

      if (rt.href) {
        text = `[${text}](${rt.href})`
      }

      return text
    })
    .join('')
}

function getBlockRichText(block: NotionBlock): NotionRichText[] {
  const data = block[block.type] as Record<string, unknown> | undefined
  if (!data) return []
  return (data.rich_text as NotionRichText[]) || []
}

function blockToMarkdown(block: NotionBlock): string | null {
  const type = block.type

  switch (type) {
    case 'paragraph': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return text || ''
    }

    case 'heading_1': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `# ${text}`
    }

    case 'heading_2': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `## ${text}`
    }

    case 'heading_3': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `### ${text}`
    }

    case 'bulleted_list_item': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `- ${text}`
    }

    case 'numbered_list_item': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `1. ${text}`
    }

    case 'to_do': {
      const data = block[type] as Record<string, unknown> | undefined
      const checked = data?.checked === true
      const text = richTextToMarkdown(getBlockRichText(block))
      return `- [${checked ? 'x' : ' '}] ${text}`
    }

    case 'toggle': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `<details><summary>${text}</summary></details>`
    }

    case 'code': {
      const data = block[type] as Record<string, unknown> | undefined
      const language = (data?.language as string) || ''
      const text = richTextToMarkdown(getBlockRichText(block))
      return `\`\`\`${language}\n${text}\n\`\`\``
    }

    case 'quote': {
      const text = richTextToMarkdown(getBlockRichText(block))
      return `> ${text}`
    }

    case 'callout': {
      const data = block[type] as Record<string, unknown> | undefined
      const icon = data?.icon as { emoji?: string } | undefined
      const emoji = icon?.emoji || ''
      const text = richTextToMarkdown(getBlockRichText(block))
      return `> ${emoji} ${text}`
    }

    case 'divider':
      return '---'

    case 'table': {
      // Tables need child rows - return placeholder
      return '[Table]'
    }

    case 'image': {
      const data = block[type] as Record<string, unknown> | undefined
      const caption = (data?.caption as NotionRichText[]) || []
      const captionText = richTextToMarkdown(caption)
      let imageUrl = ''

      if (data?.type === 'external') {
        imageUrl = (data.external as { url: string })?.url || ''
      } else if (data?.type === 'file') {
        imageUrl = (data.file as { url: string })?.url || ''
      }

      return imageUrl ? `![${captionText || 'image'}](${imageUrl})` : captionText ? `[Image: ${captionText}]` : '[Image]'
    }

    case 'bookmark': {
      const data = block[type] as Record<string, unknown> | undefined
      const url = data?.url as string || ''
      const caption = (data?.caption as NotionRichText[]) || []
      const captionText = richTextToMarkdown(caption)
      return url ? `[${captionText || url}](${url})` : ''
    }

    case 'embed': {
      const data = block[type] as Record<string, unknown> | undefined
      const url = data?.url as string || ''
      return url ? `[Embed: ${url}](${url})` : ''
    }

    case 'child_page': {
      const data = block[type] as Record<string, unknown> | undefined
      const title = data?.title as string || 'Untitled'
      return `**[Child Page: ${title}]**`
    }

    case 'child_database': {
      const data = block[type] as Record<string, unknown> | undefined
      const title = data?.title as string || 'Untitled'
      return `**[Database: ${title}]**`
    }

    case 'equation': {
      const data = block[type] as Record<string, unknown> | undefined
      const expression = data?.expression as string || ''
      return `$$${expression}$$`
    }

    case 'table_of_contents':
      return '[Table of Contents]'

    case 'breadcrumb':
      return null // skip

    case 'column_list':
    case 'column':
      return null // handled by children

    default:
      return null
  }
}
