import { describe, it, expect } from 'vitest'
import { extractPageTitle } from '@/lib/integrations/notion/sync-knowledge-helpers'
import type { NotionPage } from '@/lib/integrations/notion/client'

function makePage(properties: Record<string, unknown>): NotionPage {
  return {
    id: 'page-1',
    object: 'page',
    parent: { type: 'workspace' },
    properties,
    url: 'https://notion.so/page-1',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-01T00:00:00.000Z',
  }
}

describe('extractPageTitle', () => {
  it('extracts title from title property', () => {
    const page = makePage({
      Name: {
        type: 'title',
        title: [{ plain_text: 'My Page Title' }],
      },
    })
    expect(extractPageTitle(page)).toBe('My Page Title')
  })

  it('returns Untitled when no title property exists', () => {
    const page = makePage({
      Status: {
        type: 'select',
        select: { name: 'Active' },
      },
    })
    expect(extractPageTitle(page)).toBe('Untitled')
  })

  it('returns Untitled when title array is empty', () => {
    const page = makePage({
      Name: {
        type: 'title',
        title: [],
      },
    })
    expect(extractPageTitle(page)).toBe('Untitled')
  })

  it('joins multiple rich_text segments', () => {
    const page = makePage({
      Name: {
        type: 'title',
        title: [
          { plain_text: 'Hello ' },
          { plain_text: 'World' },
        ],
      },
    })
    expect(extractPageTitle(page)).toBe('Hello World')
  })

  it('returns Untitled when title property is undefined', () => {
    const page = makePage({
      Name: {
        type: 'title',
        title: undefined,
      },
    })
    expect(extractPageTitle(page)).toBe('Untitled')
  })

  it('handles page with no properties', () => {
    const page = makePage({})
    expect(extractPageTitle(page)).toBe('Untitled')
  })
})
