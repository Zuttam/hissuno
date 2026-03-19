/**
 * Security-focused tests for email validation in contact-resolution.
 *
 * Extends the existing contact-resolution.test.ts with adversarial email
 * inputs: injection attempts, unicode exploits, boundary conditions.
 */

import { describe, it, expect } from 'vitest'
import {
  isValidEmail,
  extractEmailDomain,
  isGenericEmailDomain,
} from '@/lib/customers/contact-resolution'

// =============================================================================
// isValidEmail - Injection and Edge Cases
// =============================================================================

describe('isValidEmail - injection vectors', () => {
  // NOTE: The EMAIL_REGEX /^[^\s@]+@[^\s@]+\.[^\s@]+$/ is intentionally
  // permissive. It only rejects whitespace and @ in the wrong places.
  // Characters like <, >, null bytes, and unicode homoglyphs pass the regex.
  // This is acceptable because:
  // 1. Emails are used as DB lookup keys (parameterized queries)
  // 2. They are lowercased before storage
  // 3. They are not rendered in HTML contexts without escaping

  it('accepts email with angle brackets in local part (known gap)', () => {
    // The regex does not reject < > - they are not \s or @
    expect(isValidEmail('<script>@example.com')).toBe(true)
  })

  it('rejects email with SQL injection (spaces cause rejection)', () => {
    // The spaces in "' OR 1=1--" make the local part fail [^\s@]+
    expect(isValidEmail("' OR 1=1--@example.com")).toBe(false)
  })

  it('accepts SQL chars without spaces in local part (safe via parameterized queries)', () => {
    // Without spaces, the regex accepts SQL-like characters
    expect(isValidEmail("'OR'1=1@example.com")).toBe(true)
  })

  it('rejects email with newline character', () => {
    expect(isValidEmail('user\n@example.com')).toBe(false)
  })

  it('rejects email with carriage return', () => {
    expect(isValidEmail('user\r@example.com')).toBe(false)
  })

  it('rejects email with tab character', () => {
    expect(isValidEmail('user\t@example.com')).toBe(false)
  })

  it('accepts email with null byte (known gap - regex only rejects \\s and @)', () => {
    // Null byte is not \s or @, so the regex accepts it
    expect(isValidEmail('user\x00@example.com')).toBe(true)
  })

  it('rejects email with space in domain', () => {
    expect(isValidEmail('user@exam ple.com')).toBe(false)
  })

  it('rejects email with multiple @ signs', () => {
    expect(isValidEmail('user@host@example.com')).toBe(false)
  })

  it('rejects email with no local part', () => {
    expect(isValidEmail('@example.com')).toBe(false)
  })

  it('rejects email with no domain part', () => {
    expect(isValidEmail('user@')).toBe(false)
  })

  it('rejects email with no TLD', () => {
    expect(isValidEmail('user@domain')).toBe(false)
  })

  it('rejects email with only whitespace', () => {
    expect(isValidEmail('   ')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false)
  })

  it('rejects email with CRLF injection', () => {
    expect(isValidEmail('user@example.com\r\nBcc: evil@evil.com')).toBe(false)
  })

  it('accepts email with unicode homoglyph in domain (known gap)', () => {
    // Cyrillic 'a' U+0430 passes because it is not \s or @
    // In practice, extractEmailDomain lowercases the domain,
    // so homoglyphs would not match real domains.
    expect(isValidEmail('user@ex\u0430mple.com')).toBe(true)
  })
})

describe('isValidEmail - valid edge cases', () => {
  it('accepts email with + tag', () => {
    expect(isValidEmail('user+tag@example.com')).toBe(true)
  })

  it('accepts email with dots in local part', () => {
    expect(isValidEmail('first.last@example.com')).toBe(true)
  })

  it('accepts email with subdomain', () => {
    expect(isValidEmail('user@mail.example.com')).toBe(true)
  })

  it('accepts email with country code TLD', () => {
    expect(isValidEmail('user@example.co.uk')).toBe(true)
  })

  it('accepts email with numbers in local part', () => {
    expect(isValidEmail('user123@example.com')).toBe(true)
  })

  it('accepts email with hyphen in domain', () => {
    expect(isValidEmail('user@my-domain.com')).toBe(true)
  })
})

// =============================================================================
// extractEmailDomain - Edge Cases
// =============================================================================

describe('extractEmailDomain - edge cases', () => {
  it('lowercases mixed-case domain', () => {
    expect(extractEmailDomain('user@EXAMPLE.COM')).toBe('example.com')
  })

  it('returns null for no @ sign', () => {
    expect(extractEmailDomain('nodomain')).toBeNull()
  })

  it('returns null for multiple @ signs', () => {
    expect(extractEmailDomain('a@b@c.com')).toBeNull()
  })

  it('extracts domain from email with + tag', () => {
    expect(extractEmailDomain('user+tag@example.com')).toBe('example.com')
  })

  it('handles domain with multiple subdomains', () => {
    expect(extractEmailDomain('user@sub.domain.example.com')).toBe(
      'sub.domain.example.com'
    )
  })

  it('returns empty string domain for "user@"', () => {
    // email.split('@') = ['user', ''], parts[1] = ''
    expect(extractEmailDomain('user@')).toBe('')
  })

  it('handles @ at start', () => {
    // email.split('@') = ['', 'domain.com'], parts[1] = 'domain.com'
    expect(extractEmailDomain('@domain.com')).toBe('domain.com')
  })
})

// =============================================================================
// isGenericEmailDomain - Completeness
// =============================================================================

describe('isGenericEmailDomain - all known providers', () => {
  const genericDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'aol.com',
    'icloud.com',
    'protonmail.com',
    'proton.me',
    'mail.com',
    'yandex.com',
    'zoho.com',
    'fastmail.com',
    'tutanota.com',
    'gmx.com',
    'gmx.net',
    'live.com',
    'msn.com',
    'me.com',
    'mac.com',
  ]

  for (const domain of genericDomains) {
    it(`recognizes ${domain} as generic`, () => {
      expect(isGenericEmailDomain(domain)).toBe(true)
    })
  }

  it('does not flag custom business domains', () => {
    expect(isGenericEmailDomain('acme.com')).toBe(false)
    expect(isGenericEmailDomain('stripe.com')).toBe(false)
    expect(isGenericEmailDomain('startup.io')).toBe(false)
  })

  it('is case-sensitive (domain must be lowercase)', () => {
    // The Set contains lowercase. extractEmailDomain lowercases before checking,
    // but isGenericEmailDomain itself is case-sensitive.
    expect(isGenericEmailDomain('Gmail.com')).toBe(false)
    expect(isGenericEmailDomain('GMAIL.COM')).toBe(false)
  })

  it('does not match partial domain names', () => {
    expect(isGenericEmailDomain('notgmail.com')).toBe(false)
    expect(isGenericEmailDomain('gmail.com.evil.com')).toBe(false)
  })
})
