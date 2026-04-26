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
  /** Whether to attach a sandbox. Defaults to skill.frontmatter.capabilities.sandbox ?? false. */
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

  const enableSandbox = opts.enableSandbox ?? opts.skill.frontmatter.capabilities?.sandbox ?? false

  return new Workspace({
    id: `automation-run-${opts.runId}`,
    name: `Run ${opts.runId} (${opts.skill.id})`,
    filesystem: new LocalFilesystem({ basePath: workDir }),
    skills: [skillsDir],
    sandbox: enableSandbox
      ? new LocalSandbox({
          workingDirectory: workDir,
          // Pass the run's project key into the sandbox so `hissuno` calls
          // are pre-authenticated. The dispatch fn is responsible for
          // minting the key before this factory runs.
          env: {
            ...process.env,
            HISSUNO_API_KEY: process.env.HISSUNO_RUN_API_KEY ?? '',
            HISSUNO_PROJECT_ID: process.env.HISSUNO_RUN_PROJECT_ID ?? '',
          },
        })
      : undefined,
  })
}
