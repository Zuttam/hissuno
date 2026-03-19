import { generateDefaultName } from '@/lib/sessions/name-generator'

describe('generateDefaultName', () => {
  it('returns "User {userId} - {date}" for a known userId', () => {
    const result = generateDefaultName({
      userId: 'user123',
      source: 'widget',
      createdAt: '2025-01-20T12:00:00Z',
    })
    expect(result).toBe('User user123 - Jan 20')
  })

  it('returns "Anonymous - {date}" when userId is null', () => {
    const result = generateDefaultName({
      userId: null,
      source: 'widget',
      createdAt: '2025-06-15T08:00:00Z',
    })
    expect(result).toBe('Anonymous - Jun 15')
  })

  it('truncates user IDs longer than 12 characters with "..."', () => {
    const longId = 'abcdefghijklmnop' // 16 chars
    const result = generateDefaultName({
      userId: longId,
      source: 'api',
      createdAt: '2025-03-05T00:00:00Z',
    })
    expect(result).toBe('User abcdefghijkl... - Mar 5')
  })

  it('does not truncate short user IDs', () => {
    const shortId = 'abc'
    const result = generateDefaultName({
      userId: shortId,
      source: 'widget',
      createdAt: '2025-09-01T00:00:00Z',
    })
    expect(result).toBe('User abc - Sep 1')
  })

  it('does not truncate a userId that is exactly 12 characters', () => {
    const exactId = 'abcdefghijkl' // exactly 12 chars
    const result = generateDefaultName({
      userId: exactId,
      source: 'widget',
      createdAt: '2025-07-04T00:00:00Z',
    })
    expect(result).toBe('User abcdefghijkl - Jul 4')
  })

  it('formats dates correctly across different months', () => {
    expect(
      generateDefaultName({ userId: null, source: 'widget', createdAt: '2025-01-20T00:00:00Z' })
    ).toBe('Anonymous - Jan 20')

    expect(
      generateDefaultName({ userId: null, source: 'widget', createdAt: '2025-12-01T00:00:00Z' })
    ).toBe('Anonymous - Dec 1')

    expect(
      generateDefaultName({ userId: null, source: 'widget', createdAt: '2025-02-28T00:00:00Z' })
    ).toBe('Anonymous - Feb 28')
  })
})
