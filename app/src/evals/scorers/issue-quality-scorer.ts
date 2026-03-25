/**
 * Issue Quality Scorer
 *
 * Uses LLM-based evaluation to assess the quality of issues created
 * by the PM agent, including title clarity, description completeness,
 * and appropriate priority assignment.
 */

import { openai } from '@ai-sdk/openai'
import { createScorer } from '@mastra/core/scores'
import { z } from 'zod'

/**
 * Input type for issue quality scorer
 */
export interface IssueQualityScorerInput {
  testCaseId: string
  testCaseName: string
  sessionMessages: Array<{ role: string; content: string }>
  expectedTitlePattern?: string
  expectedPriority?: string
  expectedDescriptionKeywords?: string[]
}

/**
 * Output type for issue quality scorer
 */
export interface IssueQualityScorerOutput {
  issueTitle?: string
  issueDescription?: string
  issuePriority?: string
  issueType?: string
  rawResponse: string
}

/**
 * Issue Quality Scorer
 *
 * Evaluates the quality of created issues on multiple dimensions:
 * - Title clarity and specificity
 * - Description completeness
 * - User quote inclusion
 * - Priority appropriateness
 */
export const issueQualityScorer = createScorer<
  IssueQualityScorerInput,
  IssueQualityScorerOutput
>({
  name: 'Issue Quality',
  description: 'Evaluates the quality of issues created by the PM agent',
  judge: {
    model: openai('gpt-5.4-mini'),
    instructions: `You are an expert Product Manager evaluating the quality of issue reports.
    
Your job is to assess whether an issue created from a support conversation is:
1. Clear and actionable
2. Well-titled (specific, not vague)
3. Well-described (includes context, user quotes, impact)
4. Appropriately prioritized

Be objective and fair in your assessment. Focus on whether the issue captures the user's problem effectively.`,
  },
})
  .preprocess(({ run }) => {
    // Extract issue details from the output
    const { issueTitle, issueDescription, issuePriority, issueType, rawResponse } =
      run.output

    // Check if an issue was actually created
    const hasIssue = !!(issueTitle || issueDescription)

    return {
      hasIssue,
      issueTitle: issueTitle || '',
      issueDescription: issueDescription || '',
      issuePriority: issuePriority || '',
      issueType: issueType || '',
      rawResponse,
    }
  })
  .analyze({
    description: 'Analyze the quality of the created issue',
    outputSchema: z.object({
      titleScore: z
        .number()
        .min(0)
        .max(1)
        .describe('Score for title clarity and specificity (0-1)'),
      descriptionScore: z
        .number()
        .min(0)
        .max(1)
        .describe('Score for description completeness (0-1)'),
      priorityScore: z
        .number()
        .min(0)
        .max(1)
        .describe('Score for priority appropriateness (0-1)'),
      userQuotesIncluded: z
        .boolean()
        .describe('Whether user quotes are included in description'),
      actionable: z.boolean().describe('Whether the issue is actionable'),
      feedback: z.string().describe('Brief feedback on the issue quality'),
    }),
    createPrompt: ({ run, results }) => {
      const { hasIssue, issueTitle, issueDescription, issuePriority } =
        results.preprocessStepResult
      const sessionMessages = run.input?.sessionMessages ?? []
      const expectedPriority = run.input?.expectedPriority
      const expectedDescriptionKeywords = run.input?.expectedDescriptionKeywords

      if (!hasIssue) {
        return `No issue was created for this session. Return scores of 0 for all dimensions.

Return JSON with:
- titleScore: 0
- descriptionScore: 0
- priorityScore: 0
- userQuotesIncluded: false
- actionable: false
- feedback: "No issue was created"`
      }

      const messagesText = sessionMessages
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
        .join('\n')

      return `Evaluate the quality of this issue created from a support conversation.

## Original Conversation:
${messagesText}

## Created Issue:
Title: ${issueTitle}
Description: ${issueDescription}
Priority: ${issuePriority}

## Evaluation Criteria:

1. **Title Score (0-1)**: Is the title specific, clear, and actionable?
   - 1.0: Specific, includes affected feature, describes the problem
   - 0.5: Somewhat clear but could be more specific
   - 0.0: Vague, generic, or confusing

2. **Description Score (0-1)**: Is the description complete and helpful?
   - Consider: problem statement, user impact, context, expected keywords: ${expectedDescriptionKeywords?.join(', ') || 'N/A'}
   - 1.0: Comprehensive with context, impact, and details
   - 0.5: Covers basics but missing some details
   - 0.0: Missing or very incomplete

3. **Priority Score (0-1)**: Is the priority appropriate?
   - Expected priority: ${expectedPriority || 'Not specified'}
   - 1.0: Priority matches the severity of the issue
   - 0.5: Priority is reasonable but could be adjusted
   - 0.0: Priority is clearly wrong

4. **User Quotes**: Does the description include direct quotes from the user?

5. **Actionable**: Can an engineer understand and start working on this issue?

Return your evaluation as JSON.`
    },
  })
  .generateScore(({ results }) => {
    const analysis = results.analyzeStepResult

    if (!analysis) {
      return 0
    }

    // Weighted average of quality dimensions
    const weights = {
      title: 0.25,
      description: 0.35,
      priority: 0.15,
      quotes: 0.1,
      actionable: 0.15,
    }

    const score =
      analysis.titleScore * weights.title +
      analysis.descriptionScore * weights.description +
      analysis.priorityScore * weights.priority +
      (analysis.userQuotesIncluded ? 1 : 0) * weights.quotes +
      (analysis.actionable ? 1 : 0) * weights.actionable

    return Math.round(score * 100) / 100
  })
  .generateReason(({ run, results, score }) => {
    const testCaseName = run.input?.testCaseName ?? 'Unknown'
    const testCaseId = run.input?.testCaseId ?? 'unknown'
    const analysis = results.analyzeStepResult

    if (!analysis) {
      return `[${testCaseId}] ${testCaseName}: Could not analyze issue quality`
    }

    const status = score >= 0.7 ? 'GOOD' : score >= 0.4 ? 'FAIR' : 'POOR'

    return `[${testCaseId}] ${testCaseName}: ${status} (${score.toFixed(2)}) - ${analysis.feedback}`
  })

/**
 * Helper function to run issue quality scorer on a single test case
 */
export async function scoreIssueQuality(
  input: IssueQualityScorerInput,
  output: IssueQualityScorerOutput
) {
  return issueQualityScorer.run({
    input,
    output,
  })
}

/**
 * Aggregate issue quality results
 */
export interface IssueQualityAggregateResult {
  total: number
  averageScore: number
  averageTitleScore: number
  averageDescriptionScore: number
  averagePriorityScore: number
  quotesIncludedRate: number
  actionableRate: number
  qualityDistribution: {
    good: number // >= 0.7
    fair: number // >= 0.4
    poor: number // < 0.4
  }
}

export function aggregateIssueQualityResults(
  results: Array<{
    testCaseId: string
    score: number
    titleScore: number
    descriptionScore: number
    priorityScore: number
    quotesIncluded: boolean
    actionable: boolean
  }>
): IssueQualityAggregateResult {
  const total = results.length

  if (total === 0) {
    return {
      total: 0,
      averageScore: 0,
      averageTitleScore: 0,
      averageDescriptionScore: 0,
      averagePriorityScore: 0,
      quotesIncludedRate: 0,
      actionableRate: 0,
      qualityDistribution: { good: 0, fair: 0, poor: 0 },
    }
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

  const averageScore = sum(results.map((r) => r.score)) / total
  const averageTitleScore = sum(results.map((r) => r.titleScore)) / total
  const averageDescriptionScore = sum(results.map((r) => r.descriptionScore)) / total
  const averagePriorityScore = sum(results.map((r) => r.priorityScore)) / total

  const quotesIncluded = results.filter((r) => r.quotesIncluded).length
  const actionable = results.filter((r) => r.actionable).length

  const good = results.filter((r) => r.score >= 0.7).length
  const fair = results.filter((r) => r.score >= 0.4 && r.score < 0.7).length
  const poor = results.filter((r) => r.score < 0.4).length

  return {
    total,
    averageScore,
    averageTitleScore,
    averageDescriptionScore,
    averagePriorityScore,
    quotesIncludedRate: quotesIncluded / total,
    actionableRate: actionable / total,
    qualityDistribution: { good, fair, poor },
  }
}
