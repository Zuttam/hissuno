/**
 * Unit tests for Notion blocks-to-markdown converter.
 */

import { describe, it, expect } from 'vitest'
import { blocksToMarkdown } from '@/lib/integrations/notion/blocks-to-markdown'
import type { NotionBlock, NotionRichText } from '@/lib/integrations/notion/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rt(text: string, opts: Partial<NotionRichText> = {}): NotionRichText {
  return {
    type: 'text',
    plain_text: text,
    ...opts,
  }
}

function block(type: string, data: Record<string, unknown> = {}, id = 'block-1'): NotionBlock {
  return {
    id,
    type,
    has_children: false,
    [type]: { rich_text: [], ...data },
  }
}

function blockWithText(type: string, text: string, extra: Record<string, unknown> = {}): NotionBlock {
  return block(type, { rich_text: [rt(text)], ...extra })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('blocksToMarkdown', () => {
  it('returns plain text for a paragraph block', () => {
    const result = blocksToMarkdown([blockWithText('paragraph', 'Hello world')])
    expect(result).toBe('Hello world')
  })

  it('returns # prefix for heading_1', () => {
    const result = blocksToMarkdown([blockWithText('heading_1', 'Title')])
    expect(result).toBe('# Title')
  })

  it('returns ## prefix for heading_2', () => {
    const result = blocksToMarkdown([blockWithText('heading_2', 'Subtitle')])
    expect(result).toBe('## Subtitle')
  })

  it('returns ### prefix for heading_3', () => {
    const result = blocksToMarkdown([blockWithText('heading_3', 'Section')])
    expect(result).toBe('### Section')
  })

  it('returns "- " prefix for bulleted_list_item', () => {
    const result = blocksToMarkdown([blockWithText('bulleted_list_item', 'bullet')])
    expect(result).toBe('- bullet')
  })

  it('returns "1. " prefix for numbered_list_item', () => {
    const result = blocksToMarkdown([blockWithText('numbered_list_item', 'step')])
    expect(result).toBe('1. step')
  })

  it('returns "- [x]" for checked to_do', () => {
    const result = blocksToMarkdown([blockWithText('to_do', 'done task', { checked: true })])
    expect(result).toBe('- [x] done task')
  })

  it('returns "- [ ]" for unchecked to_do', () => {
    const result = blocksToMarkdown([blockWithText('to_do', 'open task', { checked: false })])
    expect(result).toBe('- [ ] open task')
  })

  it('returns <details><summary> wrapper for toggle', () => {
    const result = blocksToMarkdown([blockWithText('toggle', 'Toggle title')])
    expect(result).toBe('<details><summary>Toggle title</summary></details>')
  })

  it('returns fenced code block with language for code', () => {
    const result = blocksToMarkdown([blockWithText('code', 'const x = 1', { language: 'typescript' })])
    expect(result).toBe('```typescript\nconst x = 1\n```')
  })

  it('returns "> " prefix for quote', () => {
    const result = blocksToMarkdown([blockWithText('quote', 'wise words')])
    expect(result).toBe('> wise words')
  })

  it('returns "> " with emoji for callout', () => {
    const result = blocksToMarkdown([
      blockWithText('callout', 'important note', { icon: { emoji: '!' } }),
    ])
    expect(result).toBe('> ! important note')
  })

  it('returns "---" for divider', () => {
    const result = blocksToMarkdown([block('divider')])
    expect(result).toBe('---')
  })

  it('returns image markdown for external URL with caption', () => {
    const b: NotionBlock = {
      id: 'img-1',
      type: 'image',
      has_children: false,
      image: {
        type: 'external',
        external: { url: 'https://example.com/pic.png' },
        caption: [rt('a photo')],
      },
    }
    expect(blocksToMarkdown([b])).toBe('![a photo](https://example.com/pic.png)')
  })

  it('returns image markdown for file URL without caption', () => {
    const b: NotionBlock = {
      id: 'img-2',
      type: 'image',
      has_children: false,
      image: {
        type: 'file',
        file: { url: 'https://s3.aws/img.jpg' },
        caption: [],
      },
    }
    expect(blocksToMarkdown([b])).toBe('![image](https://s3.aws/img.jpg)')
  })

  it('returns bookmark link with caption', () => {
    const b: NotionBlock = {
      id: 'bm-1',
      type: 'bookmark',
      has_children: false,
      bookmark: {
        url: 'https://example.com',
        caption: [rt('Example')],
      },
    }
    expect(blocksToMarkdown([b])).toBe('[Example](https://example.com)')
  })

  it('returns embed link', () => {
    const b: NotionBlock = {
      id: 'em-1',
      type: 'embed',
      has_children: false,
      embed: { url: 'https://youtube.com/watch?v=123' },
    }
    expect(blocksToMarkdown([b])).toBe('[Embed: https://youtube.com/watch?v=123](https://youtube.com/watch?v=123)')
  })

  it('returns $$expression$$ for equation', () => {
    const b: NotionBlock = {
      id: 'eq-1',
      type: 'equation',
      has_children: false,
      equation: { expression: 'E = mc^2' },
    }
    expect(blocksToMarkdown([b])).toBe('$$E = mc^2$$')
  })

  it('returns bold link for child_page', () => {
    const b: NotionBlock = {
      id: 'aaaa-bbbb',
      type: 'child_page',
      has_children: false,
      child_page: { title: 'Sub Page' },
    }
    expect(blocksToMarkdown([b])).toBe('**[Sub Page](https://www.notion.so/aaaabbbb)**')
  })

  it('returns bold label for child_database', () => {
    const b: NotionBlock = {
      id: 'db-1',
      type: 'child_database',
      has_children: false,
      child_database: { title: 'Tasks DB' },
    }
    expect(blocksToMarkdown([b])).toBe('**[Database: Tasks DB]**')
  })

  // -- Rich text annotations --------------------------------------------------

  it('renders bold annotation', () => {
    const b = block('paragraph', {
      rich_text: [rt('strong', { annotations: { bold: true } })],
    })
    expect(blocksToMarkdown([b])).toBe('**strong**')
  })

  it('renders italic annotation', () => {
    const b = block('paragraph', {
      rich_text: [rt('emphasis', { annotations: { italic: true } })],
    })
    expect(blocksToMarkdown([b])).toBe('*emphasis*')
  })

  it('renders strikethrough annotation', () => {
    const b = block('paragraph', {
      rich_text: [rt('removed', { annotations: { strikethrough: true } })],
    })
    expect(blocksToMarkdown([b])).toBe('~~removed~~')
  })

  it('renders code annotation', () => {
    const b = block('paragraph', {
      rich_text: [rt('snippet', { annotations: { code: true } })],
    })
    expect(blocksToMarkdown([b])).toBe('`snippet`')
  })

  it('renders href as markdown link', () => {
    const b = block('paragraph', {
      rich_text: [rt('click here', { href: 'https://example.com' })],
    })
    expect(blocksToMarkdown([b])).toBe('[click here](https://example.com)')
  })

  // -- Multi-block and edge cases ---------------------------------------------

  it('joins multiple blocks with double newlines', () => {
    const result = blocksToMarkdown([
      blockWithText('heading_1', 'Title'),
      blockWithText('paragraph', 'Body text'),
    ])
    expect(result).toBe('# Title\n\nBody text')
  })

  it('handles empty blocks array', () => {
    expect(blocksToMarkdown([])).toBe('')
  })

  it('skips null-producing block types like breadcrumb', () => {
    const result = blocksToMarkdown([
      block('breadcrumb'),
      blockWithText('paragraph', 'visible'),
    ])
    expect(result).toBe('visible')
  })
})
