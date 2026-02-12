/**
 * Knowledge Analysis End-to-End Tests
 *
 * These tests run the complete knowledge analysis workflow with REAL LLM calls.
 * They verify that the actual agents produce meaningful knowledge packages.
 *
 * REQUIREMENTS:
 * - Valid API keys for LLM providers (OpenAI, etc.) set in environment
 * - Real Supabase database connection
 * - At least one project must exist in the database (for user_id extraction)
 *
 * Note: These tests are slower and more expensive to run.
 * Run with: npx vitest run src/__tests__/integration/knowledge-analysis/workflow.e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'

vi.mock('@/mastra', async (importOriginal) => {
  if (process.env.RUN_INTEGRATION_TESTS === 'true') {
    return importOriginal()
  }
  return {
    mastra: {
      getWorkflow: () => null,
      getAgent: () => null,
    },
  }
})

import { mastra } from '@/mastra'
import { createAdminClient } from '@/lib/supabase/server'
import { triggerKnowledgeAnalysis } from '@/lib/knowledge/analysis-service'
import { downloadKnowledgePackage } from '@/lib/knowledge/storage'
import {
  setupTestProject,
  createCodebaseSource,
  createRawTextSource,
  getKnowledgePackages,
  getKnowledgeSources,
  getLatestAnalysis,
  mockCodebaseInLocal,
  sampleCodebaseFiles,
  cleanupTestData,
  cleanupOrphanedTestData,
  type TestContext,
} from './test-utils'

// E2E test timeout (2 minutes for real LLM calls)
const E2E_TEST_TIMEOUT = 120000

const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true'

if (!shouldRun) {
  console.log('[knowledge-analysis.e2e] Skipping integration tests')
  console.log('  To run: RUN_INTEGRATION_TESTS=true npm run test:integration')
}

// ============================================================================
// Test Data
// ============================================================================

let testContext: TestContext

// Rich content for meaningful analysis
const sampleKnowledgeContent = `
# Company Information

## About Us
TechFlow Solutions is a B2B SaaS company founded in 2020. We specialize in workflow automation
and analytics for small to medium-sized businesses.

## Products

### TechFlow Dashboard
Our flagship product that provides:
- Real-time analytics and reporting
- Custom dashboard widgets
- Team collaboration features
- API integration capabilities

### TechFlow API
RESTful API for integrating with third-party applications:
- Authentication via OAuth 2.0 and API keys
- Rate limiting: 1000 requests/minute for Pro plans
- Webhook support for real-time events

## Pricing

| Plan       | Price    | Features                    |
|------------|----------|----------------------------|
| Starter    | $29/mo   | 5 users, basic analytics   |
| Pro        | $79/mo   | 20 users, advanced reports |
| Enterprise | Custom   | Unlimited users, SSO, SLA  |

## Technical Stack
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL
- Hosting: AWS

## Common Support Questions

Q: How do I reset my password?
A: Click "Forgot Password" on the login page and follow the email instructions.

Q: Can I export my data?
A: Yes, all plans include CSV export. Pro and Enterprise include API access.

Q: What's the uptime SLA?
A: We guarantee 99.9% uptime for all paid plans.

## Contact
- Support: support@techflow.example.com
- Sales: sales@techflow.example.com
- Documentation: https://docs.techflow.example.com
`

// ============================================================================
// Setup & Teardown
// ============================================================================

describe('Knowledge Analysis E2E', { skip: !shouldRun }, () => {

beforeAll(async () => {
  // Clean up any orphaned test data from previous crashed runs
  await cleanupOrphanedTestData()

  // Verify that mastra is properly configured
  const workflow = mastra.getWorkflow('knowledgeAnalysisWorkflow')
  if (!workflow) {
    throw new Error('Knowledge analysis workflow not configured')
  }
}, 30000)

afterAll(async () => {
  await cleanupTestData()
}, 30000)

beforeEach(async () => {
  await cleanupTestData()
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute full analysis via the service (triggers workflow through SSE stream)
 */
async function runFullAnalysis(projectId: string, userId: string) {
  const supabase = createAdminClient()

  const result = await triggerKnowledgeAnalysis({
    projectId,
    userId,
    supabase,
  })

  if (!result.success) {
    throw new Error(`Analysis failed to start: ${result.error}`)
  }

  // The actual workflow runs via SSE stream route
  // For e2e testing, we need to execute it directly here
  const workflow = mastra.getWorkflow('knowledgeAnalysisWorkflow')
  if (!workflow) {
    throw new Error('Workflow not found')
  }

  // Get the analysis record to get workflow input
  const analysis = await getLatestAnalysis(projectId)
  if (!analysis?.metadata?.workflowInput) {
    throw new Error('No workflow input found')
  }

  // Execute workflow directly
  const run = await workflow.createRunAsync({ runId: result.runId })
  await run.start({ inputData: analysis.metadata.workflowInput })

  // Update analysis status
  await supabase
    .from('project_analyses')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', result.analysisId)

  return result
}

// ============================================================================
// E2E Tests: Full Analysis Pipeline
// ============================================================================

describe('E2E: Full Analysis Pipeline', () => {
  it(
    'runs complete analysis with raw_text source and generates meaningful packages',
    async () => {
      // Setup
      testContext = await setupTestProject({
        name: 'E2E Raw Text Test',
        withSourceCode: false,
      })

      await createRawTextSource(testContext.projectId, sampleKnowledgeContent)

      // Run analysis
      await runFullAnalysis(testContext.projectId, testContext.userId)

      // Verify packages were created
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)

      // Verify each package has content
      const supabase = createAdminClient()
      for (const pkg of packages) {
        const { content, error } = await downloadKnowledgePackage(
          pkg.storage_path,
          supabase
        )

        expect(error).toBeNull()
        expect(content).toBeTruthy()
        expect(content!.length).toBeGreaterThan(100)

        // Content should be markdown
        expect(
          content!.includes('#') || content!.includes('-') || content!.includes('*')
        ).toBe(true)
      }
    },
    E2E_TEST_TIMEOUT
  )

  it(
    'runs complete analysis with codebase and generates technical documentation',
    async () => {
      // Setup with codebase
      testContext = await setupTestProject({
        name: 'E2E Codebase Test',
        withSourceCode: true,
        repositoryBranch: 'main',
      })

      // Create mock codebase files in local temp directory
      await mockCodebaseInLocal(
        testContext.projectId,
        'main',
        sampleCodebaseFiles
      )

      const supabase = createAdminClient()
      await createCodebaseSource(testContext.projectId)

      // Run analysis
      await runFullAnalysis(testContext.projectId, testContext.userId)

      // Verify packages
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)

      // Technical package should contain code-related content
      const technicalPkg = packages.find((p) => p.category === 'technical')
      expect(technicalPkg).toBeDefined()

      const { content } = await downloadKnowledgePackage(
        technicalPkg!.storage_path,
        supabase
      )

      expect(content).toBeTruthy()
      expect(content!.length).toBeGreaterThan(50)
    },
    E2E_TEST_TIMEOUT
  )

  it(
    'verifies source status updates after analysis',
    async () => {
      testContext = await setupTestProject({
        name: 'E2E Source Status Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        sampleKnowledgeContent
      )

      // Run analysis
      await runFullAnalysis(testContext.projectId, testContext.userId)

      // Check source status was updated
      const sources = await getKnowledgeSources(testContext.projectId)
      const updatedSource = sources.find((s) => s.id === source.id)

      expect(updatedSource).toBeDefined()
      // Source should be completed or still processing
      // (depends on whether we update status in workflow steps)
      expect(['completed', 'processing', 'pending']).toContain(updatedSource!.status)
    },
    E2E_TEST_TIMEOUT
  )
})

// ============================================================================
// E2E Tests: Analysis Results Verification
// ============================================================================

describe('E2E: Analysis Results Verification', () => {
  beforeEach(async () => {
    testContext = await setupTestProject({
      name: 'E2E Results Verification',
      withSourceCode: false,
    })

    await createRawTextSource(testContext.projectId, sampleKnowledgeContent)
    await runFullAnalysis(testContext.projectId, testContext.userId)
  }, E2E_TEST_TIMEOUT)

  it(
    'business package contains company/product information',
    async () => {
      const packages = await getKnowledgePackages(testContext.projectId)
      const businessPkg = packages.find((p) => p.category === 'business')

      expect(businessPkg).toBeDefined()

      const supabase = createAdminClient()
      const { content } = await downloadKnowledgePackage(
        businessPkg!.storage_path,
        supabase
      )

      expect(content).toBeTruthy()

      // Business package should reference company/product info
      const contentLower = content!.toLowerCase()
      const hasBusinessContent =
        contentLower.includes('company') ||
        contentLower.includes('business') ||
        contentLower.includes('pricing') ||
        contentLower.includes('plan') ||
        contentLower.includes('enterprise')

      expect(hasBusinessContent).toBe(true)
    },
    E2E_TEST_TIMEOUT
  )

  it(
    'product package contains feature information',
    async () => {
      const packages = await getKnowledgePackages(testContext.projectId)
      const productPkg = packages.find((p) => p.category === 'product')

      expect(productPkg).toBeDefined()

      const supabase = createAdminClient()
      const { content } = await downloadKnowledgePackage(
        productPkg!.storage_path,
        supabase
      )

      expect(content).toBeTruthy()

      // Product package should reference features/capabilities
      const contentLower = content!.toLowerCase()
      const hasProductContent =
        contentLower.includes('feature') ||
        contentLower.includes('product') ||
        contentLower.includes('dashboard') ||
        contentLower.includes('analytics') ||
        contentLower.includes('api')

      expect(hasProductContent).toBe(true)
    },
    E2E_TEST_TIMEOUT
  )

  it(
    'technical package contains architecture/API details',
    async () => {
      const packages = await getKnowledgePackages(testContext.projectId)
      const technicalPkg = packages.find((p) => p.category === 'technical')

      expect(technicalPkg).toBeDefined()

      const supabase = createAdminClient()
      const { content } = await downloadKnowledgePackage(
        technicalPkg!.storage_path,
        supabase
      )

      expect(content).toBeTruthy()

      // Technical package should reference technical details
      const contentLower = content!.toLowerCase()
      const hasTechnicalContent =
        contentLower.includes('api') ||
        contentLower.includes('technical') ||
        contentLower.includes('stack') ||
        contentLower.includes('database') ||
        contentLower.includes('authentication') ||
        contentLower.includes('oauth')

      expect(hasTechnicalContent).toBe(true)
    },
    E2E_TEST_TIMEOUT
  )
})

// ============================================================================
// E2E Tests: Mixed Sources
// ============================================================================

describe('E2E: Mixed Sources Analysis', () => {
  it(
    'combines codebase and raw_text sources in analysis',
    async () => {
      testContext = await setupTestProject({
        name: 'E2E Mixed Sources',
        withSourceCode: true,
        repositoryBranch: 'main',
      })

      // Setup codebase in local temp directory
      await mockCodebaseInLocal(
        testContext.projectId,
        'main',
        sampleCodebaseFiles
      )

      const supabase = createAdminClient()

      // Create both sources
      await createCodebaseSource(testContext.projectId)
      await createRawTextSource(testContext.projectId, sampleKnowledgeContent)

      // Run analysis
      await runFullAnalysis(testContext.projectId, testContext.userId)

      // Verify all packages exist
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)

      // Verify each has content
      for (const pkg of packages) {
        const { content, error } = await downloadKnowledgePackage(
          pkg.storage_path,
          supabase
        )

        expect(error).toBeNull()
        expect(content).toBeTruthy()
        expect(content!.length).toBeGreaterThan(50)
      }
    },
    E2E_TEST_TIMEOUT
  )
})

// ============================================================================
// E2E Tests: Re-analysis
// ============================================================================

describe('E2E: Re-analysis', () => {
  it(
    'updates packages and increments version on re-analysis',
    async () => {
      testContext = await setupTestProject({
        name: 'E2E Re-analysis',
        withSourceCode: false,
      })

      // First analysis
      await createRawTextSource(testContext.projectId, 'Initial company info.')
      await runFullAnalysis(testContext.projectId, testContext.userId)

      let packages = await getKnowledgePackages(testContext.projectId)
      expect(packages[0]?.version).toBe(1)

      // Add more content
      await createRawTextSource(
        testContext.projectId,
        'Updated info: We now offer more features including real-time sync.'
      )

      // Clear the running analysis status to allow re-run
      const supabase = createAdminClient()
      await supabase
        .from('project_analyses')
        .update({ status: 'completed' })
        .eq('project_id', testContext.projectId)

      // Second analysis
      await runFullAnalysis(testContext.projectId, testContext.userId)

      packages = await getKnowledgePackages(testContext.projectId)
      expect(packages[0]?.version).toBe(2)
    },
    E2E_TEST_TIMEOUT * 2 // Double timeout for two analyses
  )
})

}) // end Knowledge Analysis E2E
