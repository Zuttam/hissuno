import { describe, it, expect } from 'vitest'
import {
  updateIssue,
  updateFeedback,
  updateContact,
  updateCompany,
  VALID_ISSUE_STATUSES,
  VALID_ISSUE_PRIORITIES,
  VALID_ISSUE_TYPES,
  VALID_SESSION_STATUSES,
  VALID_COMPANY_STAGES,
} from './update.js'

const EMPTY = {}

// ─── updateIssue ─────────────────────────────────────────

describe('updateIssue', () => {
  it('sets status when valid', async () => {
    const result = await updateIssue(EMPTY, { status: 'in_progress' })
    expect(result).toEqual({ status: 'in_progress' })
  })

  it('rejects invalid status', async () => {
    await expect(updateIssue(EMPTY, { status: 'invalid' })).rejects.toThrow('Invalid status')
  })

  it('accepts all valid statuses', async () => {
    for (const status of VALID_ISSUE_STATUSES) {
      const result = await updateIssue(EMPTY, { status })
      expect(result.status).toBe(status)
    }
  })

  it('sets priority with manual override flag', async () => {
    const result = await updateIssue(EMPTY, { priority: 'high' })
    expect(result).toEqual({ priority: 'high', priority_manual_override: true })
  })

  it('rejects invalid priority', async () => {
    await expect(updateIssue(EMPTY, { priority: 'urgent' })).rejects.toThrow('Invalid priority')
  })

  it('accepts all valid priorities', async () => {
    for (const priority of VALID_ISSUE_PRIORITIES) {
      const result = await updateIssue(EMPTY, { priority })
      expect(result.priority).toBe(priority)
    }
  })

  it('sets name and description', async () => {
    const result = await updateIssue(EMPTY, { name: 'New title', description: 'New desc' })
    expect(result).toEqual({ name: 'New title', description: 'New desc' })
  })

  it('sets issue type', async () => {
    const result = await updateIssue(EMPTY, { issueType: 'bug' })
    expect(result).toEqual({ type: 'bug' })
  })

  it('rejects invalid issue type', async () => {
    await expect(updateIssue(EMPTY, { issueType: 'epic' })).rejects.toThrow('Invalid issue type')
  })

  it('accepts all valid issue types', async () => {
    for (const issueType of VALID_ISSUE_TYPES) {
      const result = await updateIssue(EMPTY, { issueType })
      expect(result.type).toBe(issueType)
    }
  })

  it('returns empty object when no options provided', async () => {
    const result = await updateIssue(EMPTY, {})
    expect(result).toEqual({})
  })

  it('handles multiple options at once', async () => {
    const result = await updateIssue(EMPTY, {
      status: 'resolved',
      priority: 'high',
      name: 'Fixed bug',
      issueType: 'bug',
    })
    expect(result).toEqual({
      status: 'resolved',
      priority: 'high',
      priority_manual_override: true,
      name: 'Fixed bug',
      type: 'bug',
    })
  })
})

// ─── updateFeedback ──────────────────────────────────────

describe('updateFeedback', () => {
  it('sets status when valid', async () => {
    const result = await updateFeedback(EMPTY, { status: 'closed' })
    expect(result).toEqual({ status: 'closed' })
  })

  it('rejects invalid status', async () => {
    await expect(updateFeedback(EMPTY, { status: 'open' })).rejects.toThrow('Invalid status')
  })

  it('accepts all valid session statuses', async () => {
    for (const status of VALID_SESSION_STATUSES) {
      const result = await updateFeedback(EMPTY, { status })
      expect(result.status).toBe(status)
    }
  })

  it('sets name and description', async () => {
    const result = await updateFeedback(EMPTY, { name: 'Session name', description: 'Desc' })
    expect(result).toEqual({ name: 'Session name', description: 'Desc' })
  })

  it('sets contact_id', async () => {
    const result = await updateFeedback(EMPTY, { contactId: 'abc-123' })
    expect(result).toEqual({ contact_id: 'abc-123' })
  })

  it('clears contact_id with empty string', async () => {
    const result = await updateFeedback(EMPTY, { contactId: '' })
    expect(result).toEqual({ contact_id: null })
  })

  it('returns empty object when no options provided', async () => {
    const result = await updateFeedback(EMPTY, {})
    expect(result).toEqual({})
  })
})

// ──�� updateContact ───────────────────────────────────────

describe('updateContact', () => {
  it('sets basic fields', async () => {
    const result = await updateContact(EMPTY, {
      name: 'Jane Doe',
      email: 'jane@example.com',
      role: 'CTO',
    })
    expect(result).toEqual({ name: 'Jane Doe', email: 'jane@example.com', role: 'CTO' })
  })

  it('sets company_id', async () => {
    const result = await updateContact(EMPTY, { companyId: 'comp-123' })
    expect(result).toEqual({ company_id: 'comp-123' })
  })

  it('clears company_id with empty string', async () => {
    const result = await updateContact(EMPTY, { companyId: '' })
    expect(result).toEqual({ company_id: null })
  })

  it('sets is_champion from string', async () => {
    expect(await updateContact(EMPTY, { isChampion: 'true' })).toEqual({ is_champion: true })
    expect(await updateContact(EMPTY, { isChampion: 'false' })).toEqual({ is_champion: false })
  })

  it('clears nullable fields with empty string', async () => {
    const result = await updateContact(EMPTY, { role: '', title: '', phone: '', notes: '' })
    expect(result).toEqual({ role: null, title: null, phone: null, notes: null })
  })

  it('returns empty object when no options provided', async () => {
    const result = await updateContact(EMPTY, {})
    expect(result).toEqual({})
  })
})

// ─── updateCompany ───────────────────────────────────────

describe('updateCompany', () => {
  it('sets basic fields', async () => {
    const result = await updateCompany(EMPTY, { name: 'Acme Inc', domain: 'acme.com' })
    expect(result).toEqual({ name: 'Acme Inc', domain: 'acme.com' })
  })

  it('sets stage when valid', async () => {
    const result = await updateCompany(EMPTY, { stage: 'active' })
    expect(result).toEqual({ stage: 'active' })
  })

  it('rejects invalid stage', async () => {
    await expect(updateCompany(EMPTY, { stage: 'invalid' })).rejects.toThrow('Invalid stage')
  })

  it('accepts all valid stages', async () => {
    for (const stage of VALID_COMPANY_STAGES) {
      const result = await updateCompany(EMPTY, { stage })
      expect(result.stage).toBe(stage)
    }
  })

  it('converts arr to number', async () => {
    const result = await updateCompany(EMPTY, { arr: '50000' })
    expect(result).toEqual({ arr: 50000 })
  })

  it('clears arr with empty string', async () => {
    const result = await updateCompany(EMPTY, { arr: '' })
    expect(result).toEqual({ arr: null })
  })

  it('converts employee_count to number', async () => {
    const result = await updateCompany(EMPTY, { employeeCount: '200' })
    expect(result).toEqual({ employee_count: 200 })
  })

  it('clears nullable fields with empty string', async () => {
    const result = await updateCompany(EMPTY, {
      industry: '',
      planTier: '',
      country: '',
      notes: '',
    })
    expect(result).toEqual({
      industry: null,
      plan_tier: null,
      country: null,
      notes: null,
    })
  })

  it('returns empty object when no options provided', async () => {
    const result = await updateCompany(EMPTY, {})
    expect(result).toEqual({})
  })

  it('handles multiple fields at once', async () => {
    const result = await updateCompany(EMPTY, {
      name: 'Acme',
      stage: 'expansion',
      arr: '100000',
      employeeCount: '500',
      country: 'US',
    })
    expect(result).toEqual({
      name: 'Acme',
      stage: 'expansion',
      arr: 100000,
      employee_count: 500,
      country: 'US',
    })
  })
})
