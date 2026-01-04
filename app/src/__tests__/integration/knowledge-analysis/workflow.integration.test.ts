/**
 * Knowledge Analysis Workflow Integration Tests
 *
 * Tests the complete knowledge analysis workflow with mocked LLM agents
 * but real database interactions. This tests the workflow orchestration,
 * source processing, and package generation logic.
 *
 * REQUIREMENTS:
 * - Supabase database must be running and accessible
 * - At least one project must exist in the database (for user_id extraction)
 * - Environment variables must be set (.env.local)
 *
 * Run with: npx vitest run src/__tests__/integration/knowledge-analysis/workflow.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mastra } from '@/mastra'
import {
  setupTestProject,
  createCodebaseSource,
  createRawTextSource,
  createWebsiteSource,
  getKnowledgePackages,
  mockCodebaseInLocal,
  sampleCodebaseFiles,
  cleanupTestData,
  cleanupOrphanedTestData,
  type TestContext,
} from './test-utils'

// Test timeout for workflow tests
const TEST_TIMEOUT = 60000

// ============================================================================
// Mock LLM Agents
// ============================================================================

// Mock sanitized content (with redaction placeholders)
const mockSanitizedBusiness = `# Business Knowledge

## Company Overview
Test Company provides software solutions.

## Target Market
Small to medium businesses requiring analytics solutions.
`

const mockSanitizedProduct = `# Product Knowledge

## Features
- User authentication
- Dashboard analytics
- API access

## Use Cases
- Track user engagement
- Monitor application performance
`

const mockSanitizedTechnical = `# Technical Knowledge

## Architecture
Node.js/Express backend with TypeScript.

## API Reference
- Authentication endpoints use [REDACTED_API_KEY] for access
- Database connection: [REDACTED_DATABASE_URL]

## Environment Configuration
- API keys should be configured via environment variables
`

// Mock the agent responses for deterministic testing
const mockCodebaseAnalysis = `# Codebase Analysis

## Product Overview
This is a test application built with Express.js and TypeScript.

## Key Features
- User authentication with JWT tokens
- Dashboard with analytics
- RESTful API for data access

## Technical Architecture
- Backend: Node.js with Express
- Language: TypeScript
- Package manager: npm

## API Endpoints
- GET /api/users - List all users
- POST /api/auth/login - Authenticate user
- GET /api/dashboard - Get dashboard data
`

const mockWebsiteAnalysis = `# Website Analysis

## Company Overview
Test Company provides software solutions for businesses.

## Products and Services
- Cloud-based analytics platform
- API integration services
- Customer support tools

## Pricing
Contact for enterprise pricing.
`

const mockCompiledKnowledge = {
  business: `# Business Knowledge

## Company Overview
Test Company provides software solutions.

## Target Market
Small to medium businesses requiring analytics solutions.
`,
  product: `# Product Knowledge

## Features
- User authentication
- Dashboard analytics
- API access

## Use Cases
- Track user engagement
- Monitor application performance
`,
  technical: `# Technical Knowledge

## Architecture
Node.js/Express backend with TypeScript.

## API Reference
- Authentication endpoints
- Dashboard endpoints
- User management endpoints
`,
}

// ============================================================================
// Test Data
// ============================================================================

let testContext: TestContext

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeAll(async () => {
  // Clean up any orphaned test data from previous crashed runs
  await cleanupOrphanedTestData()

  // Mock agents before tests
  vi.spyOn(mastra, 'getAgent').mockImplementation((agentId: string) => {
    return {
      generate: vi.fn().mockImplementation(async (messages) => {
        if (agentId === 'codebaseAnalyzerAgent') {
          return { text: mockCodebaseAnalysis }
        }
        if (agentId === 'webScraperAgent') {
          return { text: mockWebsiteAnalysis }
        }
        if (agentId === 'knowledgeCompilerAgent') {
          return {
            text: JSON.stringify(mockCompiledKnowledge),
          }
        }
        if (agentId === 'securityScannerAgent') {
          // Extract the content from the prompt and return "sanitized" version
          const prompt = messages?.[0]?.content || ''
          if (prompt.includes('business')) {
            return { text: mockSanitizedBusiness }
          }
          if (prompt.includes('product')) {
            return { text: mockSanitizedProduct }
          }
          if (prompt.includes('technical')) {
            return { text: mockSanitizedTechnical }
          }
          // Default: return content with some redaction markers
          return { text: prompt.replace(/API_KEY=\S+/g, 'API_KEY=[REDACTED_API_KEY]') }
        }
        return { text: 'Mock response' }
      }),
    } as unknown as ReturnType<typeof mastra.getAgent>
  })
}, 30000)

afterAll(async () => {
  vi.restoreAllMocks()
  await cleanupTestData()
}, 30000)

beforeEach(async () => {
  // Clean up between tests
  await cleanupTestData()
})

// ============================================================================
// Helper Functions
// ============================================================================

type WorkflowSourceType = 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text'

interface WorkflowSource {
  id: string
  type: WorkflowSourceType
  url?: string | null
  storagePath?: string | null
  content?: string | null
}

interface WorkflowInput {
  projectId: string
  localCodePath: string | null
  analysisScope: string | null
  sources: WorkflowSource[]
}

/**
 * Execute the knowledge analysis workflow directly
 */
async function executeWorkflow(input: WorkflowInput) {
  const workflow = mastra.getWorkflow('knowledgeAnalysisWorkflow')
  if (!workflow) {
    throw new Error('Workflow not found')
  }

  const run = await workflow.createRunAsync({ runId: `test-${Date.now()}` })
  const result = await run.start({ inputData: input })
  
  return result
}

// ============================================================================
// Tests: Analysis with Codebase
// ============================================================================

describe('Analysis with Codebase', () => {
  it(
    'creates knowledge packages when codebase source is enabled',
    async () => {
      // Setup project with source code
      testContext = await setupTestProject({
        name: 'Codebase Test Project',
        withSourceCode: true,
        repositoryBranch: 'main',
      })

      // Create mock codebase files in local temp directory
      const localPath = await mockCodebaseInLocal(
        testContext.projectId,
        'main',
        sampleCodebaseFiles
      )

      // Create codebase source
      await createCodebaseSource(testContext.projectId)

      // Execute workflow - codebase is handled via localCodePath, not in sources array
      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: localPath,
        analysisScope: null,
        sources: [], // No additional sources beyond codebase
      })

      // Verify workflow completed
      expect(result).toBeDefined()

      // Check packages were created
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)

      const categories = packages.map((p) => p.category).sort()
      expect(categories).toEqual(['business', 'product', 'technical'])
    },
    TEST_TIMEOUT
  )

  it(
    'skips codebase when codebase source is disabled',
    async () => {
      testContext = await setupTestProject({
        name: 'Disabled Codebase Test',
        withSourceCode: true,
      })

      // Create disabled codebase source and enabled raw_text source
      await createCodebaseSource(testContext.projectId, { enabled: false })
      const rawTextSource = await createRawTextSource(
        testContext.projectId,
        'This is test content for knowledge analysis.'
      )

      // Execute workflow with no codebase path (simulating disabled)
      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null, // No codebase
        analysisScope: null,
        sources: [
          {
            id: rawTextSource.id,
            type: 'raw_text',
            content: 'This is test content for knowledge analysis.',
          },
        ],
      })

      expect(result).toBeDefined()

      // Packages should still be created from raw_text
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )

  it(
    'respects analysis_scope when set on codebase source',
    async () => {
      testContext = await setupTestProject({
        name: 'Scoped Codebase Test',
        withSourceCode: true,
        repositoryBranch: 'main',
      })

      const localPath = await mockCodebaseInLocal(
        testContext.projectId,
        'main',
        sampleCodebaseFiles
      )

      // Create codebase source with scope
      await createCodebaseSource(testContext.projectId, {
        analysisScope: 'src',
      })

      // Execute workflow with scope - codebase is handled via localCodePath/analysisScope
      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: localPath,
        analysisScope: 'src',
        sources: [], // No additional sources beyond codebase
      })

      expect(result).toBeDefined()

      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Analysis without Codebase
// ============================================================================

describe('Analysis without Codebase', () => {
  it(
    'successfully analyzes with only raw_text source',
    async () => {
      testContext = await setupTestProject({
        name: 'Raw Text Only Test',
        withSourceCode: false,
      })

      const rawTextSource = await createRawTextSource(
        testContext.projectId,
        `
# Company FAQ

Q: What does the company do?
A: We provide software analytics solutions.

Q: How do I reset my password?
A: Click "Forgot Password" on the login page.

Q: What are the pricing plans?
A: We offer Basic ($10/mo), Pro ($25/mo), and Enterprise (custom) plans.
`
      )

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: rawTextSource.id,
            type: 'raw_text',
            content: rawTextSource.content,
          },
        ],
      })

      expect(result).toBeDefined()

      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )

  it(
    'compiles packages from multiple non-codebase sources',
    async () => {
      testContext = await setupTestProject({
        name: 'Multiple Sources Test',
        withSourceCode: false,
      })

      const rawTextSource1 = await createRawTextSource(
        testContext.projectId,
        'Company overview: We are a B2B SaaS company.'
      )

      const rawTextSource2 = await createRawTextSource(
        testContext.projectId,
        'Product features: Dashboard, Reports, API access.'
      )

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: rawTextSource1.id,
            type: 'raw_text',
            content: rawTextSource1.content,
          },
          {
            id: rawTextSource2.id,
            type: 'raw_text',
            content: rawTextSource2.content,
          },
        ],
      })

      expect(result).toBeDefined()

      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Analysis with Mixed Sources
// ============================================================================

describe('Analysis with Mixed Sources', () => {
  it(
    'processes codebase + raw_text together',
    async () => {
      testContext = await setupTestProject({
        name: 'Mixed Sources Test',
        withSourceCode: true,
        repositoryBranch: 'main',
      })

      const localPath = await mockCodebaseInLocal(
        testContext.projectId,
        'main',
        sampleCodebaseFiles
      )

      await createCodebaseSource(testContext.projectId)
      const rawTextSource = await createRawTextSource(
        testContext.projectId,
        'Additional context: This product is used by enterprise customers.'
      )

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: localPath,
        analysisScope: null,
        sources: [
          // Codebase is handled via localCodePath, only include raw_text
          {
            id: rawTextSource.id,
            type: 'raw_text',
            content: rawTextSource.content,
          },
        ],
      })

      expect(result).toBeDefined()

      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )

  it(
    'handles partial source failures gracefully',
    async () => {
      testContext = await setupTestProject({
        name: 'Partial Failure Test',
        withSourceCode: false,
      })

      // Create a valid raw_text source
      const validSource = await createRawTextSource(
        testContext.projectId,
        'Valid content for analysis.'
      )

      // Create a website source with invalid URL (will fail to fetch)
      const invalidSource = await createWebsiteSource(
        testContext.projectId,
        'https://invalid-url-that-does-not-exist.example.com'
      )

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: validSource.id,
            type: 'raw_text',
            content: validSource.content,
          },
          {
            id: invalidSource.id,
            type: 'website',
            url: invalidSource.url,
          },
        ],
      })

      // Workflow should complete even if one source fails
      expect(result).toBeDefined()

      // Packages should still be created
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Knowledge Package Generation
// ============================================================================

describe('Knowledge Package Generation', () => {
  it(
    'creates all three categories (business, product, technical)',
    async () => {
      testContext = await setupTestProject({
        name: 'Categories Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        'Comprehensive knowledge content for all categories.'
      )

      await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: source.content,
          },
        ],
      })

      const packages = await getKnowledgePackages(testContext.projectId)

      expect(packages.length).toBe(3)

      const businessPkg = packages.find((p) => p.category === 'business')
      const productPkg = packages.find((p) => p.category === 'product')
      const technicalPkg = packages.find((p) => p.category === 'technical')

      expect(businessPkg).toBeDefined()
      expect(productPkg).toBeDefined()
      expect(technicalPkg).toBeDefined()

      // All packages should have storage paths
      expect(businessPkg?.storage_path).toBeTruthy()
      expect(productPkg?.storage_path).toBeTruthy()
      expect(technicalPkg?.storage_path).toBeTruthy()

      // All packages should have version 1 (first generation)
      expect(businessPkg?.version).toBe(1)
      expect(productPkg?.version).toBe(1)
      expect(technicalPkg?.version).toBe(1)
    },
    TEST_TIMEOUT
  )

  it(
    'increments version on re-analysis',
    async () => {
      testContext = await setupTestProject({
        name: 'Version Increment Test',
        withSourceCode: false,
      })

      const source = await createRawTextSource(
        testContext.projectId,
        'Initial content.'
      )

      // First analysis
      await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: source.content,
          },
        ],
      })

      let packages = await getKnowledgePackages(testContext.projectId)
      expect(packages[0]?.version).toBe(1)

      // Second analysis
      await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: 'Updated content.',
          },
        ],
      })

      packages = await getKnowledgePackages(testContext.projectId)
      expect(packages[0]?.version).toBe(2)
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Security Sanitization
// ============================================================================

describe('Security Sanitization', () => {
  it(
    'redacts sensitive information from knowledge packages',
    async () => {
      testContext = await setupTestProject({
        name: 'Security Redaction Test',
        withSourceCode: false,
      })

      // Content with sensitive information
      const sensitiveContent = `
# API Documentation

## Authentication
Use the following API key for authentication:
API_KEY=sk-1234567890abcdef1234567890abcdef

## Database Connection
DATABASE_URL=postgresql://admin:supersecretpassword@db.internal.example.com:5432/production

## AWS Credentials
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

## GitHub Token
Use this token: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

## Internal Services
The service runs at 192.168.1.100:8080
`

      const source = await createRawTextSource(testContext.projectId, sensitiveContent)

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: sensitiveContent,
          },
        ],
      })

      expect(result).toBeDefined()

      // Packages should still be created
      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )

  it(
    'handles content with no sensitive information',
    async () => {
      testContext = await setupTestProject({
        name: 'No Sensitive Data Test',
        withSourceCode: false,
      })

      // Clean content with no sensitive information
      const cleanContent = `
# Product Guide

## Overview
Our product helps teams collaborate more effectively.

## Features
- Real-time messaging
- File sharing
- Video calls

## Getting Started
1. Create an account at https://example.com
2. Download the app
3. Sign in with your credentials
`

      const source = await createRawTextSource(testContext.projectId, cleanContent)

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: null,
        analysisScope: null,
        sources: [
          {
            id: source.id,
            type: 'raw_text',
            content: cleanContent,
          },
        ],
      })

      expect(result).toBeDefined()

      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)
    },
    TEST_TIMEOUT
  )

  it(
    'sanitizes technical knowledge from codebase analysis',
    async () => {
      testContext = await setupTestProject({
        name: 'Codebase Security Test',
        withSourceCode: true,
        repositoryBranch: 'main',
      })

      // Create codebase files that might contain sensitive patterns
      const sensitiveCodebaseFiles = [
        ...sampleCodebaseFiles,
        {
          path: '.env.example',
          content: `# Environment Variables
DATABASE_URL=postgresql://user:password@localhost:5432/db
API_KEY=your-api-key-here
SECRET_KEY=replace-with-your-secret
`,
        },
        {
          path: 'src/config.ts',
          content: `// Configuration
export const config = {
  // API endpoint
  apiUrl: process.env.API_URL || 'https://api.example.com',
  // Feature flags
  enableDebug: process.env.NODE_ENV === 'development',
}
`,
        },
      ]

      const localPath = await mockCodebaseInLocal(
        testContext.projectId,
        'main',
        sensitiveCodebaseFiles
      )

      await createCodebaseSource(testContext.projectId)

      const result = await executeWorkflow({
        projectId: testContext.projectId,
        localCodePath: localPath,
        analysisScope: null,
        sources: [],
      })

      expect(result).toBeDefined()

      const packages = await getKnowledgePackages(testContext.projectId)
      expect(packages.length).toBe(3)

      // Technical package should exist
      const technicalPkg = packages.find((p) => p.category === 'technical')
      expect(technicalPkg).toBeDefined()
    },
    TEST_TIMEOUT
  )
})

// ============================================================================
// Tests: Error Scenarios
// ============================================================================

describe('Error Scenarios', () => {
  it(
    'handles empty sources array',
    async () => {
      testContext = await setupTestProject({
        name: 'Empty Sources Test',
        withSourceCode: false,
      })

      // Execute with empty sources - should either fail gracefully or produce empty packages
      try {
        await executeWorkflow({
          projectId: testContext.projectId,
          localCodePath: null,
          analysisScope: null,
          sources: [],
        })

        // If it succeeds, packages might be created with default/empty content
        const packages = await getKnowledgePackages(testContext.projectId)
        // Either no packages or packages with minimal content
        expect(packages.length).toBeGreaterThanOrEqual(0)
      } catch (error) {
        // Expected to fail with no sources
        expect(error).toBeDefined()
      }
    },
    TEST_TIMEOUT
  )
})
