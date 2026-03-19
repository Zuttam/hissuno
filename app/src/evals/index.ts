/**
 * PM Agent Evaluation System
 *
 * This module provides tools for evaluating the PM agent's performance
 * in classifying sessions and managing issues.
 *
 * ## Components
 *
 * - **Datasets**: Test cases with realistic support conversations
 * - **Scorers**: Mastra-based evaluation scorers
 * - **Runner**: Script to run evaluations and generate reports
 *
 * ## Usage
 *
 * Run evaluations:
 * ```bash
 * npm run eval:pm-agent
 * npm run eval:pm-agent -- --filter=bug
 * npm run eval:pm-agent -- --verbose
 * npm run eval:pm-agent -- --dry-run
 * ```
 *
 * Run integration tests:
 * ```bash
 * npm run test:integration
 * ```
 */

// Dataset exports
export { pmEvalDataset, datasetStats } from './datasets/pm-agent-dataset'
export {
  getTestCasesByTag,
  getTestCasesByClassification,
  getDuplicateTestCases,
  getClassificationTestCases,
  getEdgeCases,
} from './datasets/pm-agent-dataset'

// Type exports
export type {
  PMEvalTestCase,
  PMEvalDataset,
  PMEvalSeedIssue,
  PMEvalResult,
  PMEvalMetrics,
  PMEvalExpectedOutcome,
  ExpectedClassification,
  TestMessage,
} from './datasets/types'

// Scorer exports
export {
  classificationAccuracyScorer,
  scoreClassification,
  aggregateClassificationResults,
  duplicateDetectionScorer,
  scoreDuplicateDetection,
  aggregateDuplicateResults,
  issueQualityScorer,
  scoreIssueQuality,
  aggregateIssueQualityResults,
} from './scorers'

export type {
  ClassificationScorerInput,
  ClassificationScorerOutput,
  ClassificationAggregateResult,
  DuplicateScorerInput,
  DuplicateScorerOutput,
  DuplicateAggregateResult,
  IssueQualityScorerInput,
  IssueQualityScorerOutput,
  IssueQualityAggregateResult,
} from './scorers'
