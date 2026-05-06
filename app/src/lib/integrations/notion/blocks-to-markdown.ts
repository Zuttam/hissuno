/**
 * Notion blocks → Markdown converter.
 *
 * Used by the in-process knowledge analyzer (`knowledge-service.analyzeSource`)
 * to turn a fetched Notion page into searchable markdown text.
 */

interface RichTextItem {
  plain_text?: string
  annotations?: {
    bold?: boolean
    italic?: boolean
    code?: boolean
    strikethrough?: boolean
  }
  href?: string | null
}

interface NotionBlock {
  id: string
  type: string
  has_children?: boolean
  paragraph?: { rich_text?: RichTextItem[] }
  heading_1?: { rich_text?: RichTextItem[] }
  heading_2?: { rich_text?: RichTextItem[] }
  heading_3?: { rich_text?: RichTextItem[] }
  bulleted_list_item?: { rich_text?: RichTextItem[] }
  numbered_list_item?: { rich_text?: RichTextItem[] }
  to_do?: { rich_text?: RichTextItem[]; checked?: boolean }
  toggle?: { rich_text?: RichTextItem[] }
  quote?: { rich_text?: RichTextItem[] }
  callout?: { rich_text?: RichTextItem[] }
  code?: { rich_text?: RichTextItem[]; language?: string }
  divider?: Record<string, unknown>
  child_page?: { title?: string }
}

export function blocksToMarkdown(blocks: NotionBlock[]): string {
  const lines: string[] = []
  for (const block of blocks) {
    const rendered = renderBlock(block)
    if (rendered !== null) lines.push(rendered)
  }
  return lines.filter((line) => line.length > 0).join('\n\n').trim()
}

function renderBlock(block: NotionBlock): string | null {
  switch (block.type) {
    case 'paragraph':
      return renderRichText(block.paragraph?.rich_text)
    case 'heading_1':
      return `# ${renderRichText(block.heading_1?.rich_text)}`
    case 'heading_2':
      return `## ${renderRichText(block.heading_2?.rich_text)}`
    case 'heading_3':
      return `### ${renderRichText(block.heading_3?.rich_text)}`
    case 'bulleted_list_item':
      return `- ${renderRichText(block.bulleted_list_item?.rich_text)}`
    case 'numbered_list_item':
      return `1. ${renderRichText(block.numbered_list_item?.rich_text)}`
    case 'to_do': {
      const checked = block.to_do?.checked ? 'x' : ' '
      return `- [${checked}] ${renderRichText(block.to_do?.rich_text)}`
    }
    case 'toggle':
      return `> ${renderRichText(block.toggle?.rich_text)}`
    case 'quote':
      return `> ${renderRichText(block.quote?.rich_text)}`
    case 'callout':
      return `> ${renderRichText(block.callout?.rich_text)}`
    case 'code': {
      const lang = block.code?.language ?? ''
      return `\`\`\`${lang}\n${renderRichText(block.code?.rich_text)}\n\`\`\``
    }
    case 'divider':
      return '---'
    case 'child_page':
      return `[Child page: ${block.child_page?.title ?? 'Untitled'}]`
    default:
      return null
  }
}

function renderRichText(items: RichTextItem[] | undefined): string {
  if (!items || items.length === 0) return ''
  return items.map((item) => {
    let text = item.plain_text ?? ''
    const ann = item.annotations
    if (ann?.code) text = `\`${text}\``
    if (ann?.bold) text = `**${text}**`
    if (ann?.italic) text = `_${text}_`
    if (ann?.strikethrough) text = `~~${text}~~`
    if (item.href) text = `[${text}](${item.href})`
    return text
  }).join('')
}
