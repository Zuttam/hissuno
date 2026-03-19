import { describe, it, expect } from 'vitest'
import { generateSecretKey, validateSecretKey } from '@/lib/projects/keys'

describe('generateSecretKey', () => {
  it('starts with "sk_live_"', () => {
    const key = generateSecretKey()
    expect(key.startsWith('sk_live_')).toBe(true)
  })

  it('has correct total length (sk_live_ = 8 + 32 = 40)', () => {
    const key = generateSecretKey()
    expect(key.length).toBe(40)
  })

  it('generates unique keys on each call', () => {
    const key1 = generateSecretKey()
    const key2 = generateSecretKey()
    expect(key1).not.toBe(key2)
  })

  it('passes validateSecretKey', () => {
    const key = generateSecretKey()
    expect(validateSecretKey(key)).toBe(true)
  })

  it('random part contains only valid base64url chars', () => {
    const key = generateSecretKey()
    const randomPart = key.slice(8) // Remove "sk_live_"
    expect(randomPart).toMatch(/^[A-Za-z0-9_-]{32}$/)
  })
})

describe('validateSecretKey', () => {
  it('returns true for valid keys', () => {
    expect(validateSecretKey('sk_live_abcdefghijklmnopqrstuvwxyz012345')).toBe(true)
    expect(validateSecretKey('sk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345')).toBe(true)
    expect(validateSecretKey('sk_live_abcdefghABCDEFGH01234567_-aabbcc')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(validateSecretKey('')).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(validateSecretKey(null as unknown as string)).toBe(false)
    expect(validateSecretKey(undefined as unknown as string)).toBe(false)
  })

  it('returns false for wrong prefix', () => {
    expect(validateSecretKey('pk_live_abcdefghijklmnopqrstuvwxyz012345')).toBe(false)
    expect(validateSecretKey('sk_test_abcdefghijklmnopqrstuvwxyz012345')).toBe(false)
  })

  it('returns false for wrong length', () => {
    expect(validateSecretKey('sk_live_short')).toBe(false)
    expect(validateSecretKey('sk_live_abcdefghijklmnopqrstuvwxyz0123456')).toBe(false) // 33 chars
  })

  it('returns false for invalid characters', () => {
    expect(validateSecretKey('sk_live_abcdefghijklmnopqrstuvwxyz01234!')).toBe(false)
  })
})
