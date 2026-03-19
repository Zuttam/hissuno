import { describe, it, expect } from 'vitest'
import { isValidEmail, extractEmailDomain, isGenericEmailDomain } from '@/lib/customers/contact-resolution'

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('john.doe@company.co.uk')).toBe(true)
    expect(isValidEmail('test+tag@gmail.com')).toBe(true)
  })

  it('rejects missing @', () => {
    expect(isValidEmail('userexample.com')).toBe(false)
  })

  it('rejects missing local part', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('rejects missing domain', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects strings with spaces', () => {
    expect(isValidEmail('user @example.com')).toBe(false)
  })

  it('rejects missing TLD', () => {
    expect(isValidEmail('user@domain')).toBe(false)
  })
})

describe('extractEmailDomain', () => {
  it('extracts domain from valid email', () => {
    expect(extractEmailDomain('user@example.com')).toBe('example.com')
  })

  it('lowercases the domain', () => {
    expect(extractEmailDomain('user@EXAMPLE.COM')).toBe('example.com')
  })

  it('returns null for string without @', () => {
    expect(extractEmailDomain('invalid')).toBeNull()
  })

  it('returns null for multiple @ signs', () => {
    expect(extractEmailDomain('a@b@c.com')).toBeNull()
  })
})

describe('isGenericEmailDomain', () => {
  it('returns true for gmail.com', () => {
    expect(isGenericEmailDomain('gmail.com')).toBe(true)
  })

  it('returns true for yahoo.com', () => {
    expect(isGenericEmailDomain('yahoo.com')).toBe(true)
  })

  it('returns true for hotmail.com', () => {
    expect(isGenericEmailDomain('hotmail.com')).toBe(true)
  })

  it('returns true for outlook.com', () => {
    expect(isGenericEmailDomain('outlook.com')).toBe(true)
  })

  it('returns true for icloud.com', () => {
    expect(isGenericEmailDomain('icloud.com')).toBe(true)
  })

  it('returns true for protonmail.com', () => {
    expect(isGenericEmailDomain('protonmail.com')).toBe(true)
  })

  it('returns true for proton.me', () => {
    expect(isGenericEmailDomain('proton.me')).toBe(true)
  })

  it('returns false for custom domains', () => {
    expect(isGenericEmailDomain('acme.com')).toBe(false)
    expect(isGenericEmailDomain('company.io')).toBe(false)
    expect(isGenericEmailDomain('startup.dev')).toBe(false)
  })
})
