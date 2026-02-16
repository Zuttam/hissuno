/**
 * Tests for buildDataToolset
 *
 * Verifies:
 * - null contactId returns user-mode tools
 * - non-null contactId returns contact-mode tools
 * - correct tool IDs in each mode
 */

import { describe, it, expect } from 'vitest'
import { buildDataToolset } from '@/mastra/tools/data-tools'

describe('buildDataToolset', () => {
  it('returns user-mode tools when contactId is null', () => {
    const toolset = buildDataToolset(null)

    // Should have user-mode tools
    expect(toolset).toHaveProperty('list-issues')
    expect(toolset).toHaveProperty('get-issue')
    expect(toolset).toHaveProperty('list-feedback')
    expect(toolset).toHaveProperty('get-feedback')
    expect(toolset).toHaveProperty('list-contacts')
    expect(toolset).toHaveProperty('get-contact')

    // Should NOT have contact-mode tools
    expect(toolset).not.toHaveProperty('my-issues')
    expect(toolset).not.toHaveProperty('my-conversations')
    expect(toolset).not.toHaveProperty('get-conversation')
  })

  it('returns contact-mode tools when contactId is set', () => {
    const toolset = buildDataToolset('contact-123')

    // Should have contact-mode tools
    expect(toolset).toHaveProperty('my-issues')
    expect(toolset).toHaveProperty('my-conversations')
    expect(toolset).toHaveProperty('get-conversation')

    // Should NOT have user-mode tools
    expect(toolset).not.toHaveProperty('list-issues')
    expect(toolset).not.toHaveProperty('get-issue')
    expect(toolset).not.toHaveProperty('list-feedback')
    expect(toolset).not.toHaveProperty('get-feedback')
    expect(toolset).not.toHaveProperty('list-contacts')
    expect(toolset).not.toHaveProperty('get-contact')
  })

  it('returns exactly 6 tools in user mode', () => {
    const toolset = buildDataToolset(null)
    expect(Object.keys(toolset)).toHaveLength(6)
  })

  it('returns exactly 3 tools in contact mode', () => {
    const toolset = buildDataToolset('contact-123')
    expect(Object.keys(toolset)).toHaveLength(3)
  })
})
