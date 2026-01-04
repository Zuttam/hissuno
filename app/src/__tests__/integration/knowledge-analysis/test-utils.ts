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
import { createAdminClient } from '@/lib/supabase/server'
import { getLocalPath } from '@/lib/codebase/git-operations'
import type { KnowledgeSourceType, KnowledgePackageRecord } from '@/lib/knowledge/types'

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
  const supabase = createAdminClient()

  const { data: existingProject } = await supabase
    .from('projects')
    .select('user_id')
    .limit(1)
    .single()

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
  const supabase = createAdminClient()
  const userId = await getExistingUserId()

  const {
    name,
    withSourceCode = false,
    repositoryUrl = 'https://github.com/test/repo',
    repositoryBranch = 'main',
  } = options

  // Create test project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: name ?? 'Knowledge Analysis Test Project',
      description: 'Test project for knowledge analysis integration tests',
      user_id: userId,
    })
    .select('id')
    .single()

  if (projectError || !project) {
    throw new Error(`Failed to create test project: ${projectError?.message}`)
  }

  testProjectIds.push(project.id)

  let sourceCodeId: string | null = null

  // Create source code entry if requested (GitHub only)
  if (withSourceCode) {
    const { data: sourceCode, error: sourceCodeError } = await supabase
      .from('source_codes')
      .insert({
        user_id: userId,
        kind: 'github',
        repository_url: repositoryUrl,
        repository_branch: repositoryBranch,
      })
      .select('id')
      .single()

    if (sourceCodeError || !sourceCode) {
      throw new Error(`Failed to create source code entry: ${sourceCodeError?.message}`)
    }

    sourceCodeId = sourceCode.id
    testSourceCodeIds.push(sourceCode.id)

    // Create codebase knowledge_source with source_code_id
    const { data: codebaseSource, error: ksError } = await supabase
      .from('knowledge_sources')
      .insert({
        project_id: project.id,
        type: 'codebase',
        source_code_id: sourceCode.id,
        status: 'pending',
        enabled: true,
      })
      .select('id')
      .single()

    if (ksError || !codebaseSource) {
      throw new Error(`Failed to create codebase knowledge source: ${ksError?.message}`)
    }

    testSourceIds.push(codebaseSource.id)
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
  const supabase = createAdminClient()

  const { data: source, error } = await supabase
    .from('knowledge_sources')
    .insert({
      project_id: projectId,
      type,
      url: options.url ?? null,
      content: options.content ?? null,
      storage_path: options.storagePath ?? null,
      analysis_scope: options.analysisScope ?? null,
      enabled: options.enabled ?? true,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error || !source) {
    throw new Error(`Failed to create knowledge source: ${error?.message}`)
  }

  testSourceIds.push(source.id)

  return {
    id: source.id,
    type: source.type as KnowledgeSourceType,
    url: source.url,
    content: source.content,
    storagePath: source.storage_path,
    analysisScope: source.analysis_scope,
    enabled: source.enabled,
  }
}

/**
 * Create a codebase knowledge source for a project
 */
export async function createCodebaseSource(
  projectId: string,
  options: {
    analysisScope?: string | null
    enabled?: boolean
  } = {}
): Promise<TestKnowledgeSource> {
  return createKnowledgeSource(projectId, 'codebase', {
    analysisScope: options.analysisScope,
    enabled: options.enabled ?? true,
  })
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

// ============================================================================
// Knowledge Package Retrieval
// ============================================================================

/**
 * Get all knowledge packages for a project
 */
export async function getKnowledgePackages(
  projectId: string
): Promise<KnowledgePackageRecord[]> {
  const supabase = createAdminClient()

  const { data: packages, error } = await supabase
    .from('knowledge_packages')
    .select('*')
    .eq('project_id', projectId)
    .order('category', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch knowledge packages: ${error.message}`)
  }

  return (packages ?? []) as KnowledgePackageRecord[]
}

/**
 * Get knowledge sources for a project
 */
export async function getKnowledgeSources(projectId: string) {
  const supabase = createAdminClient()

  const { data: sources, error } = await supabase
    .from('knowledge_sources')
    .select('*')
    .eq('project_id', projectId)

  if (error) {
    throw new Error(`Failed to fetch knowledge sources: ${error.message}`)
  }

  return sources ?? []
}

/**
 * Get the latest project analysis record
 */
export async function getLatestAnalysis(projectId: string) {
  const supabase = createAdminClient()

  const { data: analysis, error } = await supabase
    .from('project_analyses')
    .select('*')
    .eq('project_id', projectId)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch analysis: ${error.message}`)
  }

  return analysis
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
  const supabase = createAdminClient()

  // Delete knowledge packages (foreign key on project)
  if (testPackageIds.length > 0) {
    await supabase.from('knowledge_packages').delete().in('id', testPackageIds)
  }

  // Delete knowledge sources
  if (testSourceIds.length > 0) {
    await supabase.from('knowledge_sources').delete().in('id', testSourceIds)
  }

  // Delete project analyses
  for (const projectId of testProjectIds) {
    await supabase.from('project_analyses').delete().eq('project_id', projectId)
    await supabase.from('knowledge_packages').delete().eq('project_id', projectId)
    await supabase.from('knowledge_sources').delete().eq('project_id', projectId)
  }

  // Delete source codes
  if (testSourceCodeIds.length > 0) {
    await supabase.from('source_codes').delete().in('id', testSourceCodeIds)
  }

  // Delete test projects
  if (testProjectIds.length > 0) {
    await supabase.from('projects').delete().in('id', testProjectIds)
  }

  // Clean up local directories
  for (const localPath of testLocalPaths) {
    try {
      await rm(localPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }

  // Reset tracking arrays
  testProjectIds = []
  testSourceIds = []
  testPackageIds = []
  testSourceCodeIds = []
  testLocalPaths = []
}

/**
 * Clean up orphaned test data by name pattern (safety net for crashed tests)
 * Call this at the start of test suites to ensure clean state
 */
export async function cleanupOrphanedTestData(): Promise<void> {
  const supabase = createAdminClient()

  // Find test projects by name pattern (catches orphaned data from crashed tests)
  const { data: testProjects } = await supabase
    .from('projects')
    .select('id')
    .or('name.ilike.%Test Project%,name.ilike.%E2E%,name.ilike.%Integration Test%')

  if (!testProjects || testProjects.length === 0) {
    return
  }

  const projectIds = testProjects.map((p) => p.id)

  // Get source_code_ids from codebase knowledge_sources before deletion
  const { data: codebaseSources } = await supabase
    .from('knowledge_sources')
    .select('source_code_id')
    .in('project_id', projectIds)
    .eq('type', 'codebase')
    .not('source_code_id', 'is', null)

  const sourceCodeIds = (codebaseSources ?? [])
    .map((s) => s.source_code_id)
    .filter(Boolean) as string[]

  // Delete in order respecting foreign keys
  await supabase.from('knowledge_packages').delete().in('project_id', projectIds)
  await supabase.from('knowledge_sources').delete().in('project_id', projectIds)
  await supabase.from('project_analyses').delete().in('project_id', projectIds)
  await supabase.from('projects').delete().in('id', projectIds)

  if (sourceCodeIds.length > 0) {
    await supabase.from('source_codes').delete().in('id', sourceCodeIds)
  }
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
 * Wait for all sources to be processed (not pending/processing)
 */
export async function waitForSourcesProcessed(
  projectId: string,
  timeout: number = 60000
): Promise<boolean> {
  return waitForCondition(
    async () => {
      const sources = await getKnowledgeSources(projectId)
      return sources.every(
        (s) => s.status === 'completed' || s.status === 'failed'
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
