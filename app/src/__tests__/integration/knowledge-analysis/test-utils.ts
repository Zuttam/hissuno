// @ts-nocheck -- TODO: re-write to use automation_runs after compilation_runs is dropped
/**
 * Test Utilities for Knowledge Analysis Integration Tests
 *
 * Provides helper functions for:
 * - Creating test projects with source code configuration
 * - Managing knowledge sources of various types
 * - Creating mock codebases in local temp directories
 * - Cleanup operations
 */

import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { db } from '@/lib/db'
import { eq, inArray, and, or, ilike, isNotNull, sql, desc, asc, count } from 'drizzle-orm'
import { projects, knowledgeSources, knowledgeEmbeddings, codebases, compilationRuns } from '@/lib/db/schema/app'
import { getLocalPath } from '@/lib/codebase/git-operations'
import type { KnowledgeSourceType } from '@/lib/knowledge/types'

// ============================================================================
// Types
// ============================================================================

export interface TestContext {
  projectId: string
  userId: string
  sourceCodeId: string | null
}

export interface TestKnowledgeSource {
  id: string
  type: KnowledgeSourceType
  url?: string | null
  content?: string | null
  storagePath?: string | null
  analysisScope?: string | null
  enabled?: boolean
}

// ============================================================================
// Test Data Tracking
// ============================================================================

let testProjectIds: string[] = []
let testSourceIds: string[] = []
let testPackageIds: string[] = []
let testSourceCodeIds: string[] = []
let testLocalPaths: string[] = []

// ============================================================================
// Project Setup
// ============================================================================

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Get a valid user ID from an existing project (for RLS)
 */
async function getExistingUserId(): Promise<string> {
  const [existingProject] = await db
    .select({ user_id: projects.user_id })
    .from(projects)
    .limit(1)

  if (!existingProject?.user_id) {
    throw new Error('No existing project found to get user_id for test project')
  }

  return existingProject.user_id
}

/**
 * Create a test project with optional source code configuration
 */
export async function setupTestProject(options: {
  name?: string
  withSourceCode?: boolean
  repositoryUrl?: string
  repositoryBranch?: string
}): Promise<TestContext> {
  const userId = await getExistingUserId()

  const {
    name,
    withSourceCode = false,
    repositoryUrl = 'https://github.com/test/repo',
    repositoryBranch = 'main',
  } = options

  // Create test project
  const [project] = await db
    .insert(projects)
    .values({
      name: name ?? 'Knowledge Analysis Test Project',
      description: 'Test project for knowledge analysis integration tests',
      user_id: userId,
    })
    .returning({ id: projects.id })

  if (!project) {
    throw new Error('Failed to create test project')
  }

  testProjectIds.push(project.id)

  let sourceCodeId: string | null = null

  // Create codebase entity directly (no longer a knowledge_source)
  if (withSourceCode) {
    const [sourceCode] = await db
      .insert(codebases)
      .values({
        project_id: project.id,
        user_id: userId,
        kind: 'github',
        repository_url: repositoryUrl,
        repository_branch: repositoryBranch,
      })
      .returning({ id: codebases.id })

    if (!sourceCode) {
      throw new Error('Failed to create source code entry')
    }

    sourceCodeId = sourceCode.id
    testSourceCodeIds.push(sourceCode.id)
  }

  return { projectId: project.id, userId, sourceCodeId }
}

// ============================================================================
// Knowledge Source Management
// ============================================================================

/**
 * Create a knowledge source for a project
 */
export async function createKnowledgeSource(
  projectId: string,
  type: KnowledgeSourceType,
  options: {
    url?: string | null
    content?: string | null
    storagePath?: string | null
    analysisScope?: string | null
    enabled?: boolean
  } = {}
): Promise<TestKnowledgeSource> {
  const [source] = await db
    .insert(knowledgeSources)
    .values({
      project_id: projectId,
      type,
      url: options.url ?? null,
      content: options.content ?? null,
      storage_path: options.storagePath ?? null,
      analysis_scope: options.analysisScope ?? null,
      enabled: options.enabled ?? true,
      status: 'pending',
    })
    .returning()

  if (!source) {
    throw new Error('Failed to create knowledge source')
  }

  testSourceIds.push(source.id)

  return {
    id: source.id,
    type: source.type as KnowledgeSourceType,
    url: source.url,
    content: source.content,
    storagePath: source.storage_path,
    analysisScope: source.analysis_scope,
    enabled: source.enabled ?? undefined,
  }
}

/**
 * @deprecated Codebase is now a first-class entity (source_codes), not a knowledge source.
 * Tests should create codebases directly via the codebases table.
 */
export async function createCodebaseSource(): Promise<never> {
  throw new Error('createCodebaseSource is removed. Codebase is now a first-class entity in source_codes.')
}

/**
 * Create a raw_text knowledge source
 */
export async function createRawTextSource(
  projectId: string,
  content: string,
  enabled: boolean = true
): Promise<TestKnowledgeSource> {
  return createKnowledgeSource(projectId, 'raw_text', { content, enabled })
}

/**
 * Create a website knowledge source
 */
export async function createWebsiteSource(
  projectId: string,
  url: string,
  enabled: boolean = true
): Promise<TestKnowledgeSource> {
  return createKnowledgeSource(projectId, 'website', { url, enabled })
}

/**
 * Get knowledge sources for a project
 */
export async function getKnowledgeSources(projectId: string) {
  const sources = await db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.project_id, projectId))

  return sources
}

/**
 * Get the latest project analysis record
 */
export async function getLatestAnalysis(projectId: string) {
  const [analysis] = await db
    .select()
    .from(compilationRuns)
    .where(eq(compilationRuns.project_id, projectId))
    .orderBy(desc(compilationRuns.started_at))
    .limit(1)

  return analysis ?? null
}

// ============================================================================
// Local Filesystem Utilities
// ============================================================================

/**
 * Create mock codebase files in local temp directory for testing
 * Uses the same path structure as the git-operations module
 */
export async function mockCodebaseInLocal(
  projectId: string,
  branch: string,
  files: { path: string; content: string }[]
): Promise<string> {
  const localPath = getLocalPath(projectId, branch)

  // Create the base directory
  await mkdir(localPath, { recursive: true })

  for (const file of files) {
    const fullPath = join(localPath, file.path)
    const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))

    // Create subdirectories if needed
    if (dirPath !== localPath) {
      await mkdir(dirPath, { recursive: true })
    }

    await writeFile(fullPath, file.content, 'utf-8')
  }

  testLocalPaths.push(localPath)
  return localPath
}

/**
 * Sample codebase files for testing
 */
export const sampleCodebaseFiles = [
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'test-app',
        version: '1.0.0',
        description: 'A test application for knowledge analysis',
        main: 'src/index.ts',
        scripts: {
          start: 'node dist/index.js',
          build: 'tsc',
          test: 'vitest',
        },
        dependencies: {
          express: '^4.18.0',
          typescript: '^5.0.0',
        },
      },
      null,
      2
    ),
  },
  {
    path: 'README.md',
    content: `# Test App

A sample application for testing knowledge analysis.

## Features

- User authentication
- Dashboard with analytics
- API for data access

## Installation

\`\`\`bash
npm install
npm run build
npm start
\`\`\`

## API Endpoints

- GET /api/users - List all users
- POST /api/auth/login - Authenticate user
- GET /api/dashboard - Get dashboard data
`,
  },
  {
    path: 'src/index.ts',
    content: `import express from 'express'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { dashboardRouter } from './routes/dashboard'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

// Routes
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/dashboard', dashboardRouter)

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`)
})
`,
  },
  {
    path: 'src/routes/auth.ts',
    content: `import { Router } from 'express'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body
  // Authentication logic here
  res.json({ token: 'jwt-token' })
})

authRouter.post('/logout', (req, res) => {
  res.json({ success: true })
})
`,
  },
]

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up all test data created during tests (tracked by IDs)
 */
export async function cleanupTestData(): Promise<void> {
  // Capture current arrays BEFORE resetting (in case of crash during cleanup)
  const projectIds = [...testProjectIds]
  const sourceIds = [...testSourceIds]
  const packageIds = [...testPackageIds]
  const sourceCodeIds = [...testSourceCodeIds]
  const localPaths = [...testLocalPaths]

  // Reset tracking arrays IMMEDIATELY (before async operations)
  // This ensures subsequent tests start fresh even if cleanup fails
  testProjectIds = []
  testSourceIds = []
  testPackageIds = []
  testSourceCodeIds = []
  testLocalPaths = []

  // Delete knowledge embeddings first (foreign key on packages)
  for (const projectId of projectIds) {
    await db.delete(knowledgeEmbeddings).where(eq(knowledgeEmbeddings.project_id, projectId))
  }

  // Delete knowledge sources
  if (sourceIds.length > 0) {
    await db.delete(knowledgeSources).where(inArray(knowledgeSources.id, sourceIds))
  }

  // Delete project analyses and remaining packages/sources by project
  for (const projectId of projectIds) {
    await db.delete(compilationRuns).where(eq(compilationRuns.project_id, projectId))
    await db.delete(knowledgeSources).where(eq(knowledgeSources.project_id, projectId))
  }

  // Delete source codes
  if (sourceCodeIds.length > 0) {
    await db.delete(codebases).where(inArray(codebases.id, sourceCodeIds))
  }

  // Delete test projects
  if (projectIds.length > 0) {
    await db.delete(projects).where(inArray(projects.id, projectIds))
  }

  // Clean up local directories
  for (const localPath of localPaths) {
    try {
      await rm(localPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Clean up orphaned test data by name pattern (safety net for crashed tests)
 * Call this at the start of test suites to ensure clean state
 */
export async function cleanupOrphanedTestData(): Promise<void> {
  // Find test projects by name pattern (catches orphaned data from crashed tests)
  const testProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      or(
        ilike(projects.name, '%Test Project%'),
        ilike(projects.name, '%E2E%'),
        ilike(projects.name, '%Integration Test%')
      )
    )

  if (testProjects.length === 0) {
    return
  }

  const projectIds = testProjects.map((p) => p.id)

  // Delete in order respecting foreign keys
  await db.delete(knowledgeSources).where(inArray(knowledgeSources.project_id, projectIds))
  await db.delete(compilationRuns).where(inArray(compilationRuns.project_id, projectIds))
  await db.delete(codebases).where(inArray(codebases.project_id, projectIds))
  await db.delete(projects).where(inArray(projects.id, projectIds))
}

/**
 * Reset test data tracking (call at start of each test)
 */
export function resetTestTracking(): void {
  testProjectIds = []
  testSourceIds = []
  testPackageIds = []
  testSourceCodeIds = []
  testLocalPaths = []
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Poll until a condition is met or timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<boolean> {
  const { timeout = 30000, interval = 1000 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true
    }
    await wait(interval)
  }

  return false
}

/**
 * Wait for all sources to be processed (not pending/analyzing)
 */
export async function waitForSourcesProcessed(
  projectId: string,
  timeout: number = 60000
): Promise<boolean> {
  return waitForCondition(
    async () => {
      const sources = await getKnowledgeSources(projectId)
      return sources.every(
        (s) => s.status === 'done' || s.status === 'failed'
      )
    },
    { timeout, interval: 2000 }
  )
}

/**
 * Wait for analysis to complete
 */
export async function waitForAnalysisComplete(
  projectId: string,
  timeout: number = 120000
): Promise<boolean> {
  return waitForCondition(
    async () => {
      const analysis = await getLatestAnalysis(projectId)
      return analysis?.status === 'completed' || analysis?.status === 'failed'
    },
    { timeout, interval: 2000 }
  )
}

/**
 * Wait for workflow to complete by checking if sources are analyzed and embeddings are created.
 * Use this after executeWorkflow() to ensure all async steps have finished.
 */
export async function waitForWorkflowCompletion(
  projectId: string,
  options: {
    timeout?: number
    checkEmbeddings?: boolean
  } = {}
): Promise<{ hasEmbeddings: boolean }> {
  const { timeout = 30000, checkEmbeddings = false } = options

  // Wait for all sources to be processed
  await waitForSourcesProcessed(projectId, timeout)

  // Optionally wait for embeddings
  let hasEmbeddings = false
  if (checkEmbeddings) {
    const embeddingsCreated = await waitForCondition(
      async () => {
        const [result] = await db
          .select({ count: count() })
          .from(knowledgeEmbeddings)
          .where(eq(knowledgeEmbeddings.project_id, projectId))
        return (result?.count ?? 0) > 0
      },
      { timeout: timeout / 2, interval: 500 }
    )
    hasEmbeddings = embeddingsCreated
  }

  return { hasEmbeddings }
}