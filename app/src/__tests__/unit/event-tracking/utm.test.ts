import { describe, it, expect } from 'vitest'
import { parseUTMFromURL, parseUTMFromObject, buildUTMQueryString } from '@/lib/event_tracking/utm'

describe('parseUTMFromURL', () => {
  it('extracts all 5 UTM params', () => {
    const params = new URLSearchParams(
      'utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=feedback&utm_content=hero'
    )
    const result = parseUTMFromURL(params)
    expect(result).toEqual({
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'launch',
      utm_term: 'feedback',
      utm_content: 'hero',
    })
  })

  it('ignores non-UTM params', () => {
    const params = new URLSearchParams('utm_source=google&ref=twitter&page=1')
    const result = parseUTMFromURL(params)
    expect(result).toEqual({ utm_source: 'google' })
    expect(result).not.toHaveProperty('ref')
    expect(result).not.toHaveProperty('page')
  })

  it('handles partial UTM params', () => {
    const params = new URLSearchParams('utm_source=google')
    const result = parseUTMFromURL(params)
    expect(result).toEqual({ utm_source: 'google' })
    expect(result).not.toHaveProperty('utm_medium')
  })

  it('returns empty object for no UTM params', () => {
    const params = new URLSearchParams('page=1&sort=asc')
    const result = parseUTMFromURL(params)
    expect(result).toEqual({})
  })

  it('returns empty object for empty search params', () => {
    const params = new URLSearchParams('')
    const result = parseUTMFromURL(params)
    expect(result).toEqual({})
  })
})

describe('parseUTMFromObject', () => {
  it('extracts string values', () => {
    const result = parseUTMFromObject({ utm_source: 'google', utm_medium: 'cpc' })
    expect(result).toEqual({ utm_source: 'google', utm_medium: 'cpc' })
  })

  it('takes first value from array', () => {
    const result = parseUTMFromObject({ utm_source: ['google', 'bing'] })
    expect(result).toEqual({ utm_source: 'google' })
  })

  it('ignores undefined values', () => {
    const result = parseUTMFromObject({ utm_source: 'google', utm_medium: undefined })
    expect(result).toEqual({ utm_source: 'google' })
    expect(result).not.toHaveProperty('utm_medium')
  })

  it('returns empty object for empty input', () => {
    const result = parseUTMFromObject({})
    expect(result).toEqual({})
  })

  it('ignores non-UTM keys', () => {
    const result = parseUTMFromObject({ utm_source: 'google', other: 'value' })
    expect(result).toEqual({ utm_source: 'google' })
  })
})

describe('buildUTMQueryString', () => {
  it('builds correct query string', () => {
    const result = buildUTMQueryString({ utm_source: 'google', utm_medium: 'cpc' })
    expect(result).toBe('utm_source=google&utm_medium=cpc')
  })

  it('returns empty string for empty params', () => {
    expect(buildUTMQueryString({})).toBe('')
  })

  it('encodes special characters', () => {
    const result = buildUTMQueryString({ utm_campaign: 'hello world' })
    expect(result).toBe('utm_campaign=hello%20world')
  })

  it('skips falsy values', () => {
    const result = buildUTMQueryString({ utm_source: 'google', utm_medium: undefined })
    expect(result).toBe('utm_source=google')
  })
})
