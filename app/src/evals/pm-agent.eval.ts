/**
 * PM Agent Evaluation Runner
 *
 * Runs the PM agent against the evaluation dataset and scores the results
 * using classification, duplicate detection, and issue quality scorers.
 *
 * Usage:
 *   npx tsx src/evals/pm-agent.eval.ts
 *   npx tsx src/evals/pm-agent.eval.ts --filter=bug
 *   npx tsx src/evals/pm-agent.eval.ts --filter=duplicate
 */

import { RequestContext } from '@mastra/core/request-context'
import { mastra } from '@/mastra'
import {
  pmEvalDataset,
  getTestCasesByTag,
  datasetStats,
} from './datasets/pm-agent-dataset'
import type { PMEvalTestCase, PMEvalResult, PMEvalMetrics } from './datasets/types'
import {
  aggregateClassificationResults,
  aggregateDuplicateResults,
} from './scorers'

/**
 * Parse command line arguments
 */
function parseArgs(): { filter?: string; verbose: boolean; dryRun: boolean } {
  const args = process.argv.slice(2)
  let filter: string | undefined
  let verbose = false
  let dryRun = false

  for (const arg of args) {
    if (arg.startsWith('--filter=')) {
      filter = arg.replace('--filter=', '')
    }
    if (arg === '--verbose' || arg === '-v') {
      verbose = true
    }
    if (arg === '--dry-run') {
      dryRun = true
    }
  }

  return { filter, verbose, dryRun }
}

/**
 * Create a mock project and seed issues for testing
 */
async function setupTestEnvironment(): Promise<{
  projectId: string
  issueIdMap: Map<string, string>
}> {
  // For now, we'll use a placeholder project ID
  // In a full implementation, this would create a test project in Supabase
  const projectId = 'test-project-eval'
  const issueIdMap = new Map<string, string>()

  // Map seed issue IDs to actual IDs (would be created in DB)
  for (const seedIssue of pmEvalDataset.seedIssues) {
    issueIdMap.set(seedIssue.id, `real-${seedIssue.id}`)
  }

  return { projectId, issueIdMap }
}

/**
 * Format session messages as a conversation string for the PM agent
 */
function formatSessionAsPrompt(testCase: PMEvalTestCase): string {
  const messages = testCase.session.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')

  return `Analyze this support session for actionable feedback:

Session Title: ${testCase.session.title}
Page URL: ${testCase.session.pageUrl || 'Unknown'}

Conversation:
${messages}

Based on this conversation:
1. Determine if there's actionable feedback (bug, feature request, or change request)
2. If actionable, check for similar existing issues
3. Either create a new issue or upvote an existing one
4. If skipping, explain why`
}

/**
 * Parse the PM agent response to extract classification and action
 */
function parseAgentResponse(responseText: string): {
  action: 'created' | 'upvoted' | 'skipped'
  classification: 'bug' | 'feature_request' | 'change_request' | 'skip' | null
  issueTitle?: string
  issueDescription?: string
  issuePriority?: string
  foundIssueId?: string
} {
  const textLower = responseText.toLowerCase()

  // Determine action
  let action: 'created' | 'upvoted' | 'skipped' = 'skipped'
  if (textLower.includes('created') && textLower.includes('issue')) {
    action = 'created'
  } else if (textLower.includes('upvoted') || textLower.includes('upvote')) {
    action = 'upvoted'
  }

  // Determine classification
  let classification: 'bug' | 'feature_request' | 'change_request' | 'skip' | null = null
  if (action === 'skipped') {
    classification = 'skip'
  } else if (textLower.includes('bug')) {
    classification = 'bug'
  } else if (textLower.includes('feature request') || textLower.includes('feature_request')) {
    classification = 'feature_request'
  } else if (textLower.includes('change request') || textLower.includes('change_request')) {
    classification = 'change_request'
  }

  // Try to extract issue title (look for common patterns)
  let issueTitle: string | undefined
  const titleMatch = responseText.match(/title[:\s]+["']?([^"'\n]+)["']?/i)
  if (titleMatch) {
    issueTitle = titleMatch[1].trim()
  }

  // Try to extract priority
  let issuePriority: string | undefined
  if (textLower.includes('high priority') || textLower.includes('priority: high')) {
    issuePriority = 'high'
  } else if (textLower.includes('medium priority') || textLower.includes('priority: medium')) {
    issuePriority = 'medium'
  } else if (textLower.includes('low priority') || textLower.includes('priority: low')) {
    issuePriority = 'low'
  }

  return {
    action,
    classification,
    issueTitle,
    issuePriority,
  }
}

/**
 * Run evaluation on a single test case
 */
async function evaluateTestCase(
  testCase: PMEvalTestCase,
  projectId: string,
  verbose: boolean
): Promise<PMEvalResult> {
  const pmAgent = mastra.getAgent('productManagerAgent')

  if (!pmAgent) {
    return {
      testCaseId: testCase.id,
      classificationCorrect: false,
      actualClassification: null,
      duplicateDetectionCorrect: false,
      foundExistingIssue: false,
      titlePatternMatched: false,
      priorityCorrect: false,
      error: 'Product Manager agent not found',
    }
  }

  try {
    // Create runtime context with project ID
    const requestContext = new RequestContext()
    requestContext.set('projectId', projectId)

    // Format the session as a prompt
    const prompt = formatSessionAsPrompt(testCase)

    if (verbose) {
      console.log(`\n[${testCase.id}] Running: ${testCase.name}`)
    }

    // Run the PM agent
    const response = await pmAgent.generate(prompt, { requestContext })
    const responseText = typeof response.text === 'string' ? response.text : ''

    if (verbose) {
      console.log(`[${testCase.id}] Response length: ${responseText.length} chars`)
    }

    // Parse the response
    const parsed = parseAgentResponse(responseText)

    // Evaluate classification
    const classificationCorrect =
      parsed.classification === testCase.expected.classification

    // Evaluate duplicate detection
    const foundExistingIssue = parsed.action === 'upvoted'
    const duplicateDetectionCorrect =
      testCase.expected.shouldFindExisting === foundExistingIssue

    // Evaluate title pattern
    let titlePatternMatched = false
    if (testCase.expected.issueTitlePattern && parsed.issueTitle) {
      const pattern = new RegExp(testCase.expected.issueTitlePattern, 'i')
      titlePatternMatched = pattern.test(parsed.issueTitle)
    } else if (!testCase.expected.issueTitlePattern) {
      titlePatternMatched = true // No pattern to match
    }

    // Evaluate priority
    const priorityCorrect =
      !testCase.expected.priority ||
      parsed.issuePriority === testCase.expected.priority

    return {
      testCaseId: testCase.id,
      classificationCorrect,
      actualClassification: parsed.classification,
      duplicateDetectionCorrect,
      foundExistingIssue,
      foundIssueId: parsed.foundIssueId,
      titlePatternMatched,
      priorityCorrect,
      rawResponse: responseText,
    }
  } catch (error) {
    return {
      testCaseId: testCase.id,
      classificationCorrect: false,
      actualClassification: null,
      duplicateDetectionCorrect: false,
      foundExistingIssue: false,
      titlePatternMatched: false,
      priorityCorrect: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Calculate aggregate metrics from results
 */
function calculateMetrics(
  results: PMEvalResult[],
  testCases: PMEvalTestCase[]
): PMEvalMetrics {
  const total = results.length
  const passed = results.filter(
    (r) =>
      r.classificationCorrect && r.duplicateDetectionCorrect && !r.error
  ).length

  // Classification accuracy
  const classificationResults = results.map((r, i) => ({
    testCaseId: r.testCaseId,
    expected: testCases[i].expected.classification,
    actual: r.actualClassification,
    score: r.classificationCorrect ? 1.0 : 0.0,
  }))
  const classificationAgg = aggregateClassificationResults(classificationResults)

  // Duplicate detection (only for cases that expect duplicates)
  const duplicateTestCases = testCases.filter((tc) => tc.tags.includes('duplicate'))
  const duplicateResults = results
    .filter((r) => duplicateTestCases.some((tc) => tc.id === r.testCaseId))
    .map((r) => {
      const tc = duplicateTestCases.find((tc) => tc.id === r.testCaseId)!
      return {
        testCaseId: r.testCaseId,
        outcome: r.duplicateDetectionCorrect
          ? tc.expected.shouldFindExisting
            ? ('true_positive' as const)
            : ('true_negative' as const)
          : tc.expected.shouldFindExisting
            ? ('false_negative' as const)
            : ('false_positive' as const),
        score: r.duplicateDetectionCorrect ? 1.0 : 0.0,
      }
    })
  const duplicateAgg = aggregateDuplicateResults(duplicateResults)

  // Priority accuracy (only for cases with expected priority)
  const priorityTestCases = testCases.filter((tc) => tc.expected.priority)
  const priorityCorrect = results.filter((r) => {
    const tc = priorityTestCases.find((tc) => tc.id === r.testCaseId)
    return tc && r.priorityCorrect
  }).length
  const priorityAccuracy =
    priorityTestCases.length > 0 ? priorityCorrect / priorityTestCases.length : 1

  // Results by classification
  const byClassification: PMEvalMetrics['byClassification'] = {}
  const classifications = ['bug', 'feature_request', 'change_request', 'skip'] as const
  for (const classification of classifications) {
    const classResults = classificationResults.filter(
      (r) => r.expected === classification
    )
    if (classResults.length > 0) {
      const correct = classResults.filter((r) => r.score === 1.0).length
      byClassification[classification] = {
        total: classResults.length,
        correct,
        accuracy: correct / classResults.length,
      }
    }
  }

  return {
    total,
    passed,
    classificationAccuracy: classificationAgg.accuracy,
    duplicatePrecision: duplicateAgg.precision,
    duplicateRecall: duplicateAgg.recall,
    priorityAccuracy,
    byClassification,
  }
}

/**
 * Print evaluation report
 */
function printReport(
  results: PMEvalResult[],
  metrics: PMEvalMetrics,
  verbose: boolean
): void {
  console.log('\n' + '='.repeat(60))
  console.log('PM AGENT EVALUATION REPORT')
  console.log('='.repeat(60))

  console.log('\n📊 DATASET STATISTICS:')
  console.log(`   Total test cases: ${datasetStats.totalTestCases}`)
  console.log(`   Bugs: ${datasetStats.byClassification.bug}`)
  console.log(`   Feature requests: ${datasetStats.byClassification.feature_request}`)
  console.log(`   Change requests: ${datasetStats.byClassification.change_request}`)
  console.log(`   Skip cases: ${datasetStats.byClassification.skip}`)
  console.log(`   Duplicate tests: ${datasetStats.duplicateTestCases}`)
  console.log(`   Edge cases: ${datasetStats.edgeCases}`)

  console.log('\n📈 OVERALL METRICS:')
  console.log(`   Tests run: ${metrics.total}`)
  console.log(`   Tests passed: ${metrics.passed}`)
  console.log(
    `   Pass rate: ${((metrics.passed / metrics.total) * 100).toFixed(1)}%`
  )

  console.log('\n🎯 CLASSIFICATION ACCURACY:')
  console.log(`   Overall: ${(metrics.classificationAccuracy * 100).toFixed(1)}%`)
  for (const [classification, stats] of Object.entries(metrics.byClassification)) {
    if (stats) {
      console.log(
        `   ${classification}: ${stats.correct}/${stats.total} (${(stats.accuracy * 100).toFixed(1)}%)`
      )
    }
  }

  console.log('\n🔍 DUPLICATE DETECTION:')
  console.log(`   Precision: ${(metrics.duplicatePrecision * 100).toFixed(1)}%`)
  console.log(`   Recall: ${(metrics.duplicateRecall * 100).toFixed(1)}%`)

  console.log('\n⚡ PRIORITY ACCURACY:')
  console.log(`   ${(metrics.priorityAccuracy * 100).toFixed(1)}%`)

  // Print failures
  const failures = results.filter(
    (r) => !r.classificationCorrect || !r.duplicateDetectionCorrect || r.error
  )
  if (failures.length > 0) {
    console.log('\n❌ FAILURES:')
    for (const failure of failures) {
      console.log(`   [${failure.testCaseId}]`)
      if (failure.error) {
        console.log(`      Error: ${failure.error}`)
      }
      if (!failure.classificationCorrect) {
        console.log(`      Classification: got "${failure.actualClassification}"`)
      }
      if (!failure.duplicateDetectionCorrect) {
        console.log(
          `      Duplicate detection: found=${failure.foundExistingIssue}`
        )
      }
    }
  }

  if (verbose && results.length > 0) {
    console.log('\n📝 DETAILED RESULTS:')
    for (const result of results) {
      const status =
        result.classificationCorrect && result.duplicateDetectionCorrect && !result.error
          ? '✅'
          : '❌'
      console.log(`   ${status} [${result.testCaseId}]`)
      console.log(`      Classification: ${result.actualClassification}`)
      console.log(`      Duplicate found: ${result.foundExistingIssue}`)
    }
  }

  console.log('\n' + '='.repeat(60))
}

/**
 * Main evaluation runner
 */
async function main(): Promise<void> {
  const { filter, verbose, dryRun } = parseArgs()

  console.log('🚀 Starting PM Agent Evaluation')
  console.log(`   Filter: ${filter || 'none'}`)
  console.log(`   Verbose: ${verbose}`)
  console.log(`   Dry run: ${dryRun}`)

  // Get test cases (optionally filtered)
  let testCases = pmEvalDataset.testCases
  if (filter) {
    testCases = getTestCasesByTag(filter)
    if (testCases.length === 0) {
      // Try filtering by ID prefix
      testCases = pmEvalDataset.testCases.filter((tc) =>
        tc.id.toLowerCase().includes(filter.toLowerCase())
      )
    }
  }

  console.log(`\n   Running ${testCases.length} test cases...\n`)

  if (testCases.length === 0) {
    console.log('No test cases match the filter.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('Dry run - listing test cases:')
    for (const tc of testCases) {
      console.log(`  - [${tc.id}] ${tc.name}`)
      console.log(`    Expected: ${tc.expected.classification}`)
      console.log(`    Tags: ${tc.tags.join(', ')}`)
    }
    process.exit(0)
  }

  // Setup test environment
  const { projectId } = await setupTestEnvironment()

  // Run evaluations
  const results: PMEvalResult[] = []
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`[${i + 1}/${testCases.length}] ${testCase.name}...`)

    const result = await evaluateTestCase(testCase, projectId, verbose)
    results.push(result)

    const status =
      result.classificationCorrect && result.duplicateDetectionCorrect && !result.error
        ? '✅ PASS'
        : '❌ FAIL'
    console.log(`   ${status}`)
  }

  // Calculate and print metrics
  const metrics = calculateMetrics(results, testCases)
  printReport(results, metrics, verbose)

  // Exit with error code if not all tests passed
  if (metrics.passed !== metrics.total) {
    process.exit(1)
  }
}

// Run the evaluation
main().catch((error) => {
  console.error('Evaluation failed:', error)
  process.exit(1)
})
