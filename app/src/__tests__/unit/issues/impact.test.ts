import { describe, it, expect } from 'vitest'
import { computeImpact } from '@/lib/issues/impact'

describe('computeImpact', () => {
  describe('empty sessions', () => {
    it('returns score 1 with "No customer data" when sessions array is empty', () => {
      const result = computeImpact({ technicalImpactScore: null, sessions: [] })
      expect(result.score).toBe(1)
      expect(result.reasoning).toContain('No customer data')
    })
  })

  describe('no technical impact score', () => {
    it('returns customer score only when technicalImpactScore is null', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 250_000, companyStage: 'active' },
        ],
      })
      expect(result.reasoning).toMatch(/^Customer:/)
      // With 250K ARR (score 5), 1 company (breadth 1), active weight 1.2 -> bonus
      // rawScore = 5*0.6 + 1*0.3 + 0.5 = 3.8 -> round to 4
      expect(result.score).toBe(4)
    })
  })

  describe('blended scoring', () => {
    it('blends technical and customer scores at 40/60 split', () => {
      const result = computeImpact({
        technicalImpactScore: 5,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 250_000, companyStage: 'expansion' },
        ],
      })
      // Customer: ARR 250K -> arrScore=5, 1 company -> breadthScore=1, expansion weight 1.3 -> bonus
      // rawCustomer = 5*0.6 + 1*0.3 + 0.5 = 3.8 -> rounds to 4
      // blended = 5*0.4 + 4*0.6 = 2.0 + 2.4 = 4.4 -> rounds to 4
      expect(result.score).toBe(4)
      expect(result.reasoning).toContain('Technical: 5/5')
      expect(result.reasoning).toContain('Customer:')
    })

    it('returns score 1 when both inputs are at minimum', () => {
      const result = computeImpact({
        technicalImpactScore: 1,
        sessions: [],
      })
      // customer score=1, blended = 1*0.4 + 1*0.6 = 1.0
      expect(result.score).toBe(1)
    })

    it('returns score 5 when both inputs are at maximum', () => {
      const result = computeImpact({
        technicalImpactScore: 5,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 500_000, companyStage: 'expansion' },
          { contactId: 'c2', companyId: 'co2', companyArr: 500_000, companyStage: 'expansion' },
          { contactId: 'c3', companyId: 'co3', companyArr: 500_000, companyStage: 'active' },
          { contactId: 'c4', companyId: 'co4', companyArr: 500_000, companyStage: 'active' },
          { contactId: 'c5', companyId: 'co5', companyArr: 500_000, companyStage: 'active' },
        ],
      })
      // customer: arrScore=5 (2.5M total), breadthScore=5 (5 companies), stage bonus
      // rawCustomer = 5*0.6 + 5*0.3 + 0.5 = 5.0 -> score 5
      // blended = 5*0.4 + 5*0.6 = 5.0
      expect(result.score).toBe(5)
    })
  })

  describe('ARR buckets', () => {
    it('scores ARR >= 200K as arrScore 5', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [{ contactId: 'c1', companyId: 'co1', companyArr: 200_000, companyStage: null }],
      })
      // arrScore=5, breadthScore=1, no stage bonus -> rawScore = 5*0.6 + 1*0.3 + 0 = 3.3 -> 3
      expect(result.score).toBe(3)
      expect(result.reasoning).toContain('200K ARR')
    })

    it('scores ARR 50-200K as arrScore 4', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [{ contactId: 'c1', companyId: 'co1', companyArr: 50_000, companyStage: null }],
      })
      // arrScore=4, breadthScore=1, no stage bonus -> rawScore = 4*0.6 + 1*0.3 + 0 = 2.7 -> 3
      expect(result.score).toBe(3)
      expect(result.reasoning).toContain('50K ARR')
    })

    it('scores ARR 10-50K as arrScore 3', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [{ contactId: 'c1', companyId: 'co1', companyArr: 10_000, companyStage: null }],
      })
      // arrScore=3, breadthScore=1, no stage bonus -> rawScore = 3*0.6 + 1*0.3 + 0 = 2.1 -> 2
      expect(result.score).toBe(2)
      expect(result.reasoning).toContain('10K ARR')
    })

    it('scores ARR < 10K as arrScore 2', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [{ contactId: 'c1', companyId: 'co1', companyArr: 5_000, companyStage: null }],
      })
      // arrScore=2, breadthScore=1, no stage bonus -> rawScore = 2*0.6 + 1*0.3 + 0 = 1.5 -> 2
      expect(result.score).toBe(2)
      expect(result.reasoning).toContain('5K ARR')
    })

    it('scores no ARR as arrScore 1', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [{ contactId: 'c1', companyId: 'co1', companyArr: null, companyStage: null }],
      })
      // arrScore=1, breadthScore=1, no stage bonus -> rawScore = 1*0.6 + 1*0.3 + 0 = 0.9 -> 1
      expect(result.score).toBe(1)
      expect(result.reasoning).not.toContain('ARR')
    })

    it('formats large ARR as millions', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [{ contactId: 'c1', companyId: 'co1', companyArr: 1_500_000, companyStage: null }],
      })
      expect(result.reasoning).toContain('1.5M ARR')
    })
  })

  describe('breadth scoring', () => {
    it('scores 5+ companies as breadth 5', () => {
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        contactId: `c${i}`,
        companyId: `co${i}`,
        companyArr: null as number | null,
        companyStage: null as string | null,
      }))
      const result = computeImpact({ technicalImpactScore: null, sessions })
      // arrScore=1, breadthScore=5, no stage bonus -> rawScore = 1*0.6 + 5*0.3 + 0 = 2.1 -> 2
      expect(result.score).toBe(2)
      expect(result.reasoning).toContain('5 contact(s), 5 companies')
    })

    it('scores 3+ companies as breadth 4', () => {
      const sessions = Array.from({ length: 3 }, (_, i) => ({
        contactId: `c${i}`,
        companyId: `co${i}`,
        companyArr: null as number | null,
        companyStage: null as string | null,
      }))
      const result = computeImpact({ technicalImpactScore: null, sessions })
      // arrScore=1, breadthScore=4, no stage bonus -> rawScore = 1*0.6 + 4*0.3 + 0 = 1.8 -> 2
      expect(result.score).toBe(2)
      expect(result.reasoning).toContain('3 contact(s), 3 companies')
    })

    it('scores 2+ companies as breadth 3', () => {
      const sessions = [
        { contactId: 'c1', companyId: 'co1', companyArr: null, companyStage: null },
        { contactId: 'c2', companyId: 'co2', companyArr: null, companyStage: null },
      ]
      const result = computeImpact({ technicalImpactScore: null, sessions })
      // arrScore=1, breadthScore=3, no stage bonus -> rawScore = 1*0.6 + 3*0.3 + 0 = 1.5 -> 2
      expect(result.score).toBe(2)
      expect(result.reasoning).toContain('2 contact(s), 2 companies')
    })

    it('scores 2+ contacts with 1 company as breadth 2', () => {
      const sessions = [
        { contactId: 'c1', companyId: 'co1', companyArr: null, companyStage: null },
        { contactId: 'c2', companyId: 'co1', companyArr: null, companyStage: null },
      ]
      const result = computeImpact({ technicalImpactScore: null, sessions })
      // arrScore=1, breadthScore=2, no stage bonus -> rawScore = 1*0.6 + 2*0.3 + 0 = 1.2 -> 1
      expect(result.score).toBe(1)
      expect(result.reasoning).toContain('2 contact(s), 1 company')
    })
  })

  describe('stage weighting', () => {
    it('includes expansion customer in reasoning (weight 1.3)', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 100_000, companyStage: 'expansion' },
        ],
      })
      expect(result.reasoning).toContain('includes expansion customer')
    })

    it('does not add stage bonus for prospect (weight 0.8)', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 100_000, companyStage: 'prospect' },
        ],
      })
      expect(result.reasoning).not.toContain('includes')
    })

    it('adds stage bonus for active customers (weight 1.2)', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 100_000, companyStage: 'active' },
        ],
      })
      expect(result.reasoning).toContain('includes active customer')
    })
  })

  describe('reasoning format', () => {
    it('includes contact and company counts', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: 50_000, companyStage: null },
        ],
      })
      expect(result.reasoning).toContain('1 contact(s), 1 company')
    })

    it('pluralizes companies correctly', () => {
      const result = computeImpact({
        technicalImpactScore: null,
        sessions: [
          { contactId: 'c1', companyId: 'co1', companyArr: null, companyStage: null },
          { contactId: 'c2', companyId: 'co2', companyArr: null, companyStage: null },
        ],
      })
      expect(result.reasoning).toContain('companies')
    })
  })
})
