/**
 * Classification Accuracy Scorer
 *
 * Evaluates whether the PM agent correctly classified a session
 * as bug, feature_request, change_request, or skip.
 */

import { createScorer } from '@mastra/core/evals'
import type { ExpectedClassification } from '../datasets/types'

type ScorerRun = {
  input?: ClassificationScorerInput
  output: ClassificationScorerOutput
}

/**
 * Input type for classification scorer
 */
export interface ClassificationScorerInput {
  expectedClassification: ExpectedClassification
  testCaseId: string
  testCaseName: string
}

/**
 * Output type for classification scorer
 */
export interface ClassificationScorerOutput {
  actualClassification: ExpectedClassification | null
  action: 'created' | 'upvoted' | 'skipped'
  issueType?: string
  rawResponse: string
}

/**
 * Classification Accuracy Scorer
 *
 * Compares the agent's classification against the expected classification.
 * Returns 1.0 for exact match, 0.0 for mismatch.
 */
export const classificationAccuracyScorer = createScorer<
  ClassificationScorerInput,
  ClassificationScorerOutput
>({
  id: 'classification-accuracy',
  name: 'Classification Accuracy',
  description: 'Evaluates whether the PM agent correctly classified a session',
})
  .preprocess(({ run }: { run: ScorerRun }) => {
    // Extract the raw response text
    const rawResponse = run.output.rawResponse || ''
    const textLower = rawResponse.toLowerCase()

    // Determine the action from the response
    let action: 'created' | 'upvoted' | 'skipped' = 'skipped'
    if (textLower.includes('created') && textLower.includes('issue')) {
      action = 'created'
    } else if (textLower.includes('upvoted') || textLower.includes('upvote')) {
      action = 'upvoted'
    }

    // Determine classification from response
    let actualClassification: ExpectedClassification | null = null

    if (action === 'skipped') {
      actualClassification = 'skip'
    } else {
      // Look for classification keywords
      if (textLower.includes('bug') && !textLower.includes('feature')) {
        actualClassification = 'bug'
      } else if (
        textLower.includes('feature request') ||
        textLower.includes('feature_request') ||
        (textLower.includes('feature') && !textLower.includes('bug'))
      ) {
        actualClassification = 'feature_request'
      } else if (
        textLower.includes('change request') ||
        textLower.includes('change_request') ||
        textLower.includes('ux improvement') ||
        textLower.includes('improvement')
      ) {
        actualClassification = 'change_request'
      }
    }

    return {
      action,
      actualClassification,
      rawResponse,
    }
  })
  .analyze(({ run, results }: { run: ScorerRun; results: { preprocessStepResult: { actualClassification: ExpectedClassification | null } } }) => {
    const { actualClassification } = results.preprocessStepResult
    const expectedClassification = run.input?.expectedClassification ?? 'skip'

    // Compare classifications
    const isCorrect = actualClassification === expectedClassification

    // Build confusion matrix info
    const confusionInfo = {
      expected: expectedClassification,
      actual: actualClassification,
      isCorrect,
      matchType: isCorrect
        ? 'exact'
        : actualClassification === null
          ? 'no_classification'
          : 'mismatch',
    }

    return confusionInfo
  })
  .generateScore(({ results }: { results: { analyzeStepResult: { isCorrect: boolean } } }) => {
    // Return 1.0 for correct classification, 0.0 for incorrect
    return results.analyzeStepResult.isCorrect ? 1.0 : 0.0
  })
  .generateReason(({ run, results, score }: { run: ScorerRun; results: { analyzeStepResult: { expected: ExpectedClassification | null; actual: ExpectedClassification | null; matchType: string } }; score: number }) => {
    const { expected, actual, matchType } = results.analyzeStepResult
    const testCaseName = run.input?.testCaseName ?? 'Unknown'
    const testCaseId = run.input?.testCaseId ?? 'unknown'

    if (score === 1.0) {
      return `[${testCaseId}] ${testCaseName}: PASS - Correctly classified as "${expected}"`
    }

    if (matchType === 'no_classification') {
      return `[${testCaseId}] ${testCaseName}: FAIL - Expected "${expected}" but could not determine classification from response`
    }

    return `[${testCaseId}] ${testCaseName}: FAIL - Expected "${expected}" but got "${actual}"`
  });

/**
 * Helper function to run classification scorer on a single test case
 */
export async function scoreClassification(
  input: ClassificationScorerInput,
  output: ClassificationScorerOutput
) {
  return classificationAccuracyScorer.run({
    input,
    output,
  })
}

/**
 * Aggregate classification results for multiple test cases
 */
export interface ClassificationAggregateResult {
  total: number
  correct: number
  accuracy: number
  confusionMatrix: {
    [expected: string]: {
      [actual: string]: number
    }
  }
  errors: Array<{
    testCaseId: string
    expected: ExpectedClassification
    actual: ExpectedClassification | null
  }>
}

export function aggregateClassificationResults(
  results: Array<{
    testCaseId: string
    expected: ExpectedClassification
    actual: ExpectedClassification | null
    score: number
  }>
): ClassificationAggregateResult {
  const total = results.length
  const correct = results.filter((r) => r.score === 1.0).length
  const accuracy = total > 0 ? correct / total : 0

  // Build confusion matrix
  const confusionMatrix: ClassificationAggregateResult['confusionMatrix'] = {}
  const errors: ClassificationAggregateResult['errors'] = []

  for (const result of results) {
    const expected = result.expected
    const actual = result.actual || 'unknown'

    if (!confusionMatrix[expected]) {
      confusionMatrix[expected] = {}
    }
    confusionMatrix[expected][actual] = (confusionMatrix[expected][actual] || 0) + 1

    if (result.score !== 1.0) {
      errors.push({
        testCaseId: result.testCaseId,
        expected: result.expected,
        actual: result.actual,
      })
    }
  }

  return {
    total,
    correct,
    accuracy,
    confusionMatrix,
    errors,
  }
}
