/**
 * analyze_codebase tool.
 *
 * Exposed to skill-runner agents when the project has a codebase configured.
 * Lazily acquires a lease on the project's codebase, then spawns a fresh
 * Mastra Agent (the "subagent") with read-only tools whose paths are scoped
 * to the lease directory. The subagent answers a focused natural-language
 * question and returns its synthesized text.
 *
 * The lease is acquired with leaserId = runId; multiple calls in the same
 * run reuse/refresh the same lease entry. Release is handled centrally in
 * dispatch.ts's executeRun finally block — calling releaseCodebase(runId)
 * is idempotent so we don't track per-tool state here.
 */

import { Agent } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { exec } from 'child_process'
import { readFile, readdir, stat } from 'fs/promises'
import { join, relative, resolve } from 'path'
import { promisify } from 'util'
import { z } from 'zod'

import { acquireCodebase, getCodebaseInfo } from '@/lib/codebase/manager'
import { getCodebaseById } from '@/lib/codebase/service'
import { resolveModel, type ModelConfig } from '@/mastra/models'

const execAsync = promisify(exec)

export const CODEBASE_SUBAGENT_MODEL: ModelConfig = {
  name: 'codebase-subagent',
  tier: 'default',
  fallback: 'anthropic/claude-sonnet-4-6',
}

const SUBAGENT_MAX_STEPS = 15
const BASH_DEFAULT_TIMEOUT_MS = 30_000
const BASH_MAX_OUTPUT_BYTES = 256 * 1024
const FILE_READ_MAX_BYTES = 256 * 1024
const LIST_MAX_ENTRIES = 500
const GREP_DEFAULT_MAX_RESULTS = 100

const SKIP_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '__pycache__',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.nyc_output',
])

export const analyzeCodebaseTool = createTool({
  id: 'analyze_codebase',
  description: `Investigate the project's connected codebase by asking a focused natural-language question.
Spawns a fresh subagent with read-only access (list_files / read_file / grep / scoped bash) to a leased checkout.
Use this to ground effort estimates, find existing implementations, trace code paths, and reason about architecture before proposing changes. Read-only — does not modify the codebase.`,
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .describe(
        'Focused question for the subagent. Be specific. The subagent will answer with file:line citations.',
      ),
    codebase_id: z
      .string()
      .optional()
      .describe(
        "Optional codebase id. Defaults to the project's first enabled codebase.",
      ),
  }),
  outputSchema: z.object({
    text: z.string(),
    codebase: z
      .object({
        id: z.string(),
        branch: z.string(),
        repositoryUrl: z.string(),
        commitSha: z.string().nullable(),
      })
      .nullable(),
    error: z.string().optional(),
  }),
  execute: async (input, ctx) => {
    const requestContext = ctx?.requestContext
    const abortSignal = ctx?.abortSignal as AbortSignal | undefined

    const projectId = requestContext?.get?.('projectId') as string | undefined
    const runId = requestContext?.get?.('runId') as string | undefined
    if (!projectId || !runId) {
      return {
        text: '',
        codebase: null,
        error: 'analyze_codebase requires runId and projectId in request context.',
      }
    }

    const codebaseInfo = await resolveCodebase({ projectId, codebaseId: input.codebase_id })
    if (!codebaseInfo.ok) {
      return { text: '', codebase: null, error: codebaseInfo.error }
    }

    const acquireResult = await acquireCodebase({
      projectId,
      userId: codebaseInfo.userId,
      leaserId: runId,
    })

    const codebaseRef = {
      id: codebaseInfo.codebaseId,
      branch: codebaseInfo.branch,
      repositoryUrl: codebaseInfo.repositoryUrl,
      commitSha: acquireResult.commitSha,
    }

    if (!acquireResult.localPath) {
      return {
        text: '',
        codebase: codebaseRef,
        error: acquireResult.error ?? 'Codebase unavailable.',
      }
    }

    const localPath = acquireResult.localPath
    const subagent = new Agent({
      id: `codebase-subagent-${runId}-${Date.now()}`,
      name: 'Codebase Subagent',
      instructions: buildSubagentInstructions({
        question: input.question,
        repositoryUrl: codebaseInfo.repositoryUrl,
        branch: codebaseInfo.branch,
        commitSha: acquireResult.commitSha,
      }),
      model: ({ requestContext: rc }) => resolveModel(CODEBASE_SUBAGENT_MODEL, rc),
      tools: createScopedTools(localPath),
    })

    try {
      const response = await subagent.generate(input.question, {
        requestContext,
        maxSteps: SUBAGENT_MAX_STEPS,
        abortSignal,
      })
      return {
        text: response.text ?? '',
        codebase: codebaseRef,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return {
        text: '',
        codebase: codebaseRef,
        error: `Subagent failed: ${message}`,
      }
    }
  },
})

type ResolvedCodebase =
  | { ok: true; codebaseId: string; branch: string; repositoryUrl: string; userId: string }
  | { ok: false; error: string }

async function resolveCodebase(args: {
  projectId: string
  codebaseId?: string
}): Promise<ResolvedCodebase> {
  if (args.codebaseId) {
    const row = await getCodebaseById(args.codebaseId)
    if (!row || row.project_id !== args.projectId) {
      return { ok: false, error: `Codebase ${args.codebaseId} not found in this project.` }
    }
    if (row.kind !== 'github' || !row.repository_url || !row.repository_branch) {
      return {
        ok: false,
        error: 'Codebase is not a GitHub codebase or is missing repository url/branch.',
      }
    }
    return {
      ok: true,
      codebaseId: row.id,
      branch: row.repository_branch,
      repositoryUrl: row.repository_url,
      userId: row.user_id,
    }
  }
  const info = await getCodebaseInfo(args.projectId)
  if (!info) {
    return { ok: false, error: 'No codebase configured for this project.' }
  }
  return {
    ok: true,
    codebaseId: info.codebaseId,
    branch: info.branch,
    repositoryUrl: info.repositoryUrl,
    userId: info.userId,
  }
}

function buildSubagentInstructions(args: {
  question: string
  repositoryUrl: string
  branch: string
  commitSha: string | null
}): string {
  return [
    'You are a focused codebase analysis subagent. You have read-only tools scoped to a single repository checkout. Investigate the question below and return a concise, citation-rich answer.',
    '',
    '# Repository',
    `URL: ${args.repositoryUrl}`,
    `Branch: ${args.branch}`,
    args.commitSha ? `Commit: ${args.commitSha}` : '',
    '',
    '# Question',
    args.question,
    '',
    '# Tools',
    '- `list_files`: directory listing relative to the codebase root.',
    '- `read_file`: read a text file (optional line range).',
    '- `grep`: ripgrep search across the codebase.',
    '- `bash`: run a shell command with cwd locked to the codebase root. Use for `git log`, `find`, `jq`, etc. Read-only intent only — do not modify files.',
    '',
    '# How to work',
    '- All paths in tool inputs are relative to the codebase root. Absolute paths or `..` traversals are rejected.',
    '- Be efficient. Prefer `grep` to narrow before `read_file`. Avoid reading large trees.',
    '- Answer concisely: lead with the answer, then 3-8 supporting bullets with `file:line` citations.',
    '- If the codebase does not contain enough information to answer, say so plainly.',
  ]
    .filter(Boolean)
    .join('\n')
}

function createScopedTools(rootPath: string) {
  return {
    list_files: createListFilesTool(rootPath),
    read_file: createReadFileTool(rootPath),
    grep: createGrepTool(rootPath),
    bash: createBashTool(rootPath),
  }
}

function safeResolve(rootPath: string, relativePath: string): string | null {
  if (!relativePath || relativePath.includes('\0')) return null
  if (relativePath.startsWith('/')) return null
  const target = resolve(rootPath, relativePath)
  const rel = relative(rootPath, target)
  if (rel === '..' || rel.startsWith('..' + (process.platform === 'win32' ? '\\' : '/'))) {
    return null
  }
  return target
}

function createListFilesTool(rootPath: string) {
  return createTool({
    id: 'list_files',
    description:
      'List files and directories in the codebase. Optionally narrow to a relative subdirectory and recursion depth.',
    inputSchema: z.object({
      relative_path: z
        .string()
        .optional()
        .describe('Subdirectory relative to the codebase root (e.g., "src/lib"). Defaults to root.'),
      depth: z
        .number()
        .int()
        .min(1)
        .max(5)
        .optional()
        .default(1)
        .describe('Recursion depth. 1 = immediate children only.'),
    }),
    outputSchema: z.object({
      entries: z.array(
        z.object({
          path: z.string(),
          type: z.enum(['file', 'dir']),
          size: z.number().optional(),
        }),
      ),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const rel = input.relative_path ?? ''
      const start = rel ? safeResolve(rootPath, rel) : rootPath
      if (!start) {
        return { entries: [], truncated: false, error: `Path escapes codebase root: ${rel}` }
      }
      const depth = input.depth ?? 1
      try {
        const out = await walk(start, rootPath, depth)
        const truncated = out.length > LIST_MAX_ENTRIES
        return { entries: out.slice(0, LIST_MAX_ENTRIES), truncated }
      } catch (err) {
        return {
          entries: [],
          truncated: false,
          error: err instanceof Error ? err.message : 'list failed',
        }
      }
    },
  })
}

async function walk(
  current: string,
  root: string,
  remainingDepth: number,
): Promise<Array<{ path: string; type: 'file' | 'dir'; size?: number }>> {
  if (remainingDepth <= 0) return []
  const entries = await readdir(current, { withFileTypes: true })
  const out: Array<{ path: string; type: 'file' | 'dir'; size?: number }> = []
  for (const entry of entries) {
    if (SKIP_DIRECTORIES.has(entry.name)) continue
    const full = join(current, entry.name)
    const path = relative(root, full)
    if (entry.isDirectory()) {
      out.push({ path, type: 'dir' })
      if (remainingDepth > 1) {
        const sub = await walk(full, root, remainingDepth - 1)
        out.push(...sub)
        if (out.length > LIST_MAX_ENTRIES) return out
      }
    } else if (entry.isFile()) {
      try {
        const s = await stat(full)
        out.push({ path, type: 'file', size: s.size })
      } catch {
        out.push({ path, type: 'file' })
      }
    }
  }
  return out
}

function createReadFileTool(rootPath: string) {
  return createTool({
    id: 'read_file',
    description:
      'Read a text file from the codebase. Optional 1-indexed start_line / end_line to narrow output. Truncates at 256KB.',
    inputSchema: z.object({
      relative_path: z.string().describe('File path relative to the codebase root.'),
      start_line: z.number().int().min(1).optional(),
      end_line: z.number().int().min(1).optional(),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const target = safeResolve(rootPath, input.relative_path)
      if (!target) {
        return {
          path: input.relative_path,
          content: '',
          truncated: false,
          error: 'Path escapes codebase root.',
        }
      }
      try {
        const buf = await readFile(target)
        const oversize = buf.byteLength > FILE_READ_MAX_BYTES
        let text = oversize
          ? buf.subarray(0, FILE_READ_MAX_BYTES).toString('utf8')
          : buf.toString('utf8')
        if (input.start_line || input.end_line) {
          const lines = text.split('\n')
          const start = (input.start_line ?? 1) - 1
          const end = input.end_line ?? lines.length
          text = lines.slice(start, end).join('\n')
        }
        return { path: input.relative_path, content: text, truncated: oversize }
      } catch (err) {
        return {
          path: input.relative_path,
          content: '',
          truncated: false,
          error: err instanceof Error ? err.message : 'read failed',
        }
      }
    },
  })
}

function createGrepTool(rootPath: string) {
  return createTool({
    id: 'grep',
    description:
      'Search for a regex pattern in the codebase using ripgrep. Returns file:line:text matches.',
    inputSchema: z.object({
      pattern: z.string().describe('Regex pattern. Anchor or escape as needed.'),
      glob: z
        .string()
        .optional()
        .describe('Optional glob to scope results, e.g. "*.ts" or "src/**/*.tsx".'),
      max_results: z.number().int().min(1).max(500).optional().default(GREP_DEFAULT_MAX_RESULTS),
      case_insensitive: z.boolean().optional().default(false),
    }),
    outputSchema: z.object({
      matches: z.array(
        z.object({
          file: z.string(),
          line: z.number(),
          text: z.string(),
        }),
      ),
      truncated: z.boolean(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      const max = input.max_results ?? GREP_DEFAULT_MAX_RESULTS
      const args: string[] = ['rg', '--vimgrep', '--no-heading']
      if (input.case_insensitive) args.push('-i')
      args.push(`--max-count=${max}`)
      if (input.glob) {
        args.push('-g', input.glob)
      }
      args.push('--', input.pattern)
      const command = args.map(shellQuote).join(' ')
      try {
        const { stdout } = await execAsync(command, {
          cwd: rootPath,
          maxBuffer: BASH_MAX_OUTPUT_BYTES,
          timeout: BASH_DEFAULT_TIMEOUT_MS,
          shell: '/bin/bash',
        })
        const out = bufToString(stdout)
        const lines = out.split('\n').filter(Boolean)
        const matches: GrepMatch[] = []
        for (const line of lines.slice(0, max)) {
          const parsed = parseRgVimgrep(line)
          if (parsed) matches.push(parsed)
        }
        return { matches, truncated: lines.length >= max }
      } catch (err: unknown) {
        const e = err as {
          code?: number
          stdout?: unknown
          stderr?: unknown
          message?: string
        }
        // ripgrep exits 1 when there are no matches — not an error.
        const stdoutStr = bufToString(e.stdout)
        if (e.code === 1 && stdoutStr.length === 0) {
          return { matches: [], truncated: false }
        }
        return {
          matches: [],
          truncated: false,
          error: bufToString(e.stderr) || e.message || 'grep failed',
        }
      }
    },
  })
}

type GrepMatch = { file: string; line: number; text: string }

function parseRgVimgrep(line: string): GrepMatch | null {
  const m = line.match(/^([^:]+):(\d+):\d+:(.*)$/)
  if (!m) return null
  return { file: m[1], line: Number(m[2]), text: m[3] }
}

function bufToString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Buffer.isBuffer(v)) return v.toString('utf8')
  return String(v)
}

function shellQuote(s: string): string {
  if (/^[a-zA-Z0-9_./=-]+$/.test(s)) return s
  return `'${s.replace(/'/g, `'\\''`)}'`
}

function createBashTool(rootPath: string) {
  return createTool({
    id: 'bash',
    description:
      'Run a shell command with cwd locked to the codebase root. Use for git log, find, jq, etc. Read-only intent — do NOT modify files. Default timeout 30s, max output 256KB.',
    inputSchema: z.object({
      command: z.string().describe('Shell command to execute. Runs via /bin/bash.'),
      timeout_ms: z.number().int().min(1_000).max(120_000).optional().default(BASH_DEFAULT_TIMEOUT_MS),
    }),
    outputSchema: z.object({
      stdout: z.string(),
      stderr: z.string(),
      exit_code: z.number(),
      error: z.string().optional(),
    }),
    execute: async (input) => {
      try {
        const { stdout, stderr } = await execAsync(input.command, {
          cwd: rootPath,
          maxBuffer: BASH_MAX_OUTPUT_BYTES,
          timeout: input.timeout_ms ?? BASH_DEFAULT_TIMEOUT_MS,
          shell: '/bin/bash',
        })
        return {
          stdout: bufToString(stdout),
          stderr: bufToString(stderr),
          exit_code: 0,
        }
      } catch (err: unknown) {
        const e = err as {
          code?: number
          signal?: string
          stdout?: unknown
          stderr?: unknown
          message?: string
        }
        return {
          stdout: bufToString(e.stdout),
          stderr: bufToString(e.stderr),
          exit_code: typeof e.code === 'number' ? e.code : 1,
          error: e.signal ? `Killed by signal ${e.signal}` : undefined,
        }
      }
    },
  })
}
