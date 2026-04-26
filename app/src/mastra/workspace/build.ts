/**
 * Per-run Mastra Workspace factory.
 *
 * Each automation run gets its own Workspace bound to:
 * - The bundled skills directory (so the agent's `skill` tool can load the
 *   selected skill on demand).
 * - A LocalSandbox (dev) or E2BSandbox (prod, when wired) for running
 *   commands like `hissuno`, `gh`, `git`.
 * - A scratch filesystem for the agent to write its `output.json`.
 *
 * For Phase 1 the sandbox is opt-in via the skill's frontmatter capabilities;
 * Phase 2+ flips the default to always-on once we have a real base image.
 */

import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SkillDescriptor } from '@/lib/automations/types'

export type WorkspaceForRunOptions = {
  runId: string
  skill: SkillDescriptor
  /** Project the run is scoped to. Used for sandbox env. */
  projectId: string
  /**
   * Per-run, project-scoped API key for the `hissuno` CLI inside the sandbox.
   * Minted by the dispatcher before this factory runs and revoked when the
   * run completes. Required — the runner does not fall back to global env
   * (that was the v1 alpha shortcut and got removed).
   */
  apiKey: string
  /** Optional triggering entity surfaced to the sandbox via env vars. */
  entity?: { type: string; id: string }
  /** Optional structured input surfaced as JSON env var. */
  input?: Record<string, unknown>
  /** Whether to attach a sandbox. Defaults to true (the design says always-on). */
  enableSandbox?: boolean
}

function resolveBundledSkillsDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, '..', '..', '..', 'packages', 'skills'),
    join(process.cwd(), 'packages', 'skills'),
    join(process.cwd(), 'app', 'packages', 'skills'),
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

export async function buildWorkspaceForRun(opts: WorkspaceForRunOptions): Promise<Workspace> {
  const skillsDir = resolveBundledSkillsDir()
  if (!skillsDir) throw new Error('Bundled skills directory not found')

  // Per-run scratch directory. Lives under the OS temp dir so it cleans up
  // naturally and never leaks into the repo working tree.
  const workDir = join(tmpdir(), 'hissuno-automation', opts.runId)
  await mkdir(workDir, { recursive: true })

  const enableSandbox = opts.enableSandbox ?? true

  // Build the per-run env. The CLI inside the sandbox is pre-authenticated
  // using a project-scoped API key minted by the dispatcher specifically for
  // this run. Trigger context surfaces as `$ISSUE_ID`, `$ENTITY_TYPE`, etc.
  // We deliberately drop process.env passthrough so global admin secrets
  // (like the host's HISSUNO_API_KEY) don't leak into the sandbox.
  const sandboxEnv: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: process.env.NODE_ENV,
    HISSUNO_API_KEY: opts.apiKey,
    HISSUNO_PROJECT_ID: opts.projectId,
    HISSUNO_RUN_ID: opts.runId,
    HISSUNO_SKILL_ID: opts.skill.id,
  }
  if (opts.entity) {
    sandboxEnv.ENTITY_TYPE = opts.entity.type
    sandboxEnv.ENTITY_ID = opts.entity.id
    if (opts.entity.type === 'issue') sandboxEnv.ISSUE_ID = opts.entity.id
    if (opts.entity.type === 'customer') sandboxEnv.CUSTOMER_ID = opts.entity.id
    if (opts.entity.type === 'scope') sandboxEnv.SCOPE_ID = opts.entity.id
    if (opts.entity.type === 'package') sandboxEnv.PACKAGE_ID = opts.entity.id
  }
  if (opts.input && Object.keys(opts.input).length > 0) {
    sandboxEnv.HISSUNO_RUN_INPUT = JSON.stringify(opts.input)
  }

  return new Workspace({
    id: `automation-run-${opts.runId}`,
    name: `Run ${opts.runId} (${opts.skill.id})`,
    filesystem: new LocalFilesystem({ basePath: workDir }),
    skills: [skillsDir],
    sandbox: enableSandbox
      ? new LocalSandbox({
          workingDirectory: workDir,
          env: sandboxEnv,
        })
      : undefined,
  })
}
