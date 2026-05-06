// @ts-nocheck -- TODO: re-enable after migrating tool execute signature/scorer typing to Mastra v1
/**
 * Duplicate Detection Scorer
 *
 * Evaluates whether the PM agent correctly identified existing issues
 * when analyzing sessions that are duplicates of known issues.
 */

import { createScorer } from '@mastra/core/scores'

/**
 * Input type for duplicate detection scorer
 */
export interface DuplicateScorerInput {
  shouldFindExisting: boolean
  existingIssueId?: string
  testCaseId: string
  testCaseName: string
}

/**
 * Output type for duplicate detection scorer
 */
export interface DuplicateScorerOutput {
  action: 'created' | 'upvoted' | 'skipped'
  foundExistingIssue: boolean
  foundIssueId?: string
  rawResponse: string
}

/**
 * Duplicate Detection Scorer
 *
 * Evaluates precision and recall for duplicate issue detection.
 * - Returns 1.0 if correctly found/not found existing issue
 * - Returns 0.0 if missed duplicate or false positive
 */
/* FIXME(mastra): Add a unique `id` parameter. See: https://mastra.ai/guides/migrations/upgrade-to-v1/mastra#required-id-parameter-for-all-mastra-primitives */
export const duplicateDetectionScorer = createScorer<
  DuplicateScorerInput,
  DuplicateScorerOutput
>({
  name: 'Duplicate Detection',
  description: 'Evaluates whether the PM agent correctly identified duplicate issues',
})
  .preprocess(({ run }) => {
    const { action, foundExistingIssue, foundIssueId, rawResponse } = run.output

    // For upvoted actions, the agent found an existing issue
    const detectedDuplicate = action === 'upvoted' || foundExistingIssue

    return {
      action,
      detectedDuplicate,
      foundIssueId,
      rawResponse,
    }
  })
  .analyze(({ run, results }) => {
    const shouldFindExisting = run.input?.shouldFindExisting ?? false
    const existingIssueId = run.input?.existingIssueId
    const { detectedDuplicate, foundIssueId } = results.preprocessStepResult

    // Determine outcome
    let outcome: 'true_positive' | 'true_negative' | 'false_positive' | 'false_negative'

    if (shouldFindExisting) {
      if (detectedDuplicate) {
        // Check if the right issue was found (if specified)
        if (existingIssueId && foundIssueId && foundIssueId !== existingIssueId) {
          outcome = 'false_positive' // Found wrong issue
        } else {
          outcome = 'true_positive' // Correctly found duplicate
        }
      } else {
        outcome = 'false_negative' // Missed duplicate
      }
    } else {
      if (detectedDuplicate) {
        outcome = 'false_positive' // Incorrectly claimed duplicate
      } else {
        outcome = 'true_negative' // Correctly identified as new
      }
    }

    const isCorrect = outcome === 'true_positive' || outcome === 'true_negative'

    return {
      shouldFindExisting,
      detectedDuplicate,
      existingIssueId,
      foundIssueId,
      outcome,
      isCorrect,
    }
  })
  .generateScore(({ results }) => {
    // Return 1.0 for correct detection, 0.0 for incorrect
    return results.analyzeStepResult.isCorrect ? 1.0 : 0.0
  })
  .generateReason(({ run, results }) => {
    const { outcome, shouldFindExisting, existingIssueId, foundIssueId } =
      results.analyzeStepResult
    const testCaseName = run.input?.testCaseName ?? 'Unknown'
    const testCaseId = run.input?.testCaseId ?? 'unknown'

    switch (outcome) {
      case 'true_positive':
        return `[${testCaseId}] ${testCaseName}: PASS - Correctly identified duplicate issue${existingIssueId ? ` (${existingIssueId})` : ''}`

      case 'true_negative':
        return `[${testCaseId}] ${testCaseName}: PASS - Correctly identified as new issue (no duplicate)`

      case 'false_positive':
        if (shouldFindExisting && foundIssueId !== existingIssueId) {
          return `[${testCaseId}] ${testCaseName}: FAIL - Found wrong duplicate: expected ${existingIssueId}, got ${foundIssueId}`
        }
        return `[${testCaseId}] ${testCaseName}: FAIL - Incorrectly identified as duplicate when it should be a new issue`

      case 'false_negative':
        return `[${testCaseId}] ${testCaseName}: FAIL - Missed duplicate: should have found existing issue ${existingIssueId}`

      default:
        return `[${testCaseId}] ${testCaseName}: Unknown outcome`
    }
  });

/**
 * Helper function to run duplicate scorer on a single test case
 */
export async function scoreDuplicateDetection(
  input: DuplicateScorerInput,
  output: DuplicateScorerOutput
) {
  return duplicateDetectionScorer.run({
    input,
    output,
  })
}

/**
 * Aggregate duplicate detection results
 */
export interface DuplicateAggregateResult {
  total: number
  correct: number
  truePositives: number
  trueNegatives: number
  falsePositives: number
  falseNegatives: number
  precision: number
  recall: number
  f1Score: number
  accuracy: number
}

export function aggregateDuplicateResults(
  results: Array<{
    testCaseId: string
    outcome: 'true_positive' | 'true_negative' | 'false_positive' | 'false_negative'
    score: number
  }>
): DuplicateAggregateResult {
  const total = results.length
  const truePositives = results.filter((r) => r.outcome === 'true_positive').length
  const trueNegatives = results.filter((r) => r.outcome === 'true_negative').length
  const falsePositives = results.filter((r) => r.outcome === 'false_positive').length
  const falseNegatives = results.filter((r) => r.outcome === 'false_negative').length

  const correct = truePositives + trueNegatives
  const accuracy = total > 0 ? correct / total : 0

  // Precision = TP / (TP + FP)
  const precision =
    truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0

  // Recall = TP / (TP + FN)
  const recall =
    truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0

  // F1 = 2 * (precision * recall) / (precision + recall)
  const f1Score =
    precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

  return {
    total,
    correct,
    truePositives,
    trueNegatives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1Score,
    accuracy,
  }
}