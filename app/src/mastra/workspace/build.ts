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

import {
  LocalFilesystem,
  LocalSandbox,
  Workspace,
  type WorkspaceSandbox,
} from '@mastra/core/workspace'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCustomSkillBundle } from '@/lib/automations/custom-skills'
import type { SkillDescriptor } from '@/lib/automations/types'
import { resolveConnectionToken } from '@/lib/integrations/credential-resolver'

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

function resolveLocalBinDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, '..', '..', '..', '..', 'node_modules', '.bin'),
    join(here, '..', '..', '..', 'node_modules', '.bin'),
    join(process.cwd(), 'node_modules', '.bin'),
    join(process.cwd(), '..', 'node_modules', '.bin'),
    join(process.cwd(), 'app', 'node_modules', '.bin'),
  ]
  return candidates.find((c) => existsSync(c)) ?? null
}

function prependLocalBinToPath(currentPath: string): string {
  const localBin = resolveLocalBinDir()
  if (!localBin) return currentPath
  if (currentPath.split(':').includes(localBin)) return currentPath
  return `${localBin}:${currentPath}`
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
  const bundledSkillsDir = resolveBundledSkillsDir()
  if (!bundledSkillsDir) throw new Error('Bundled skills directory not found')

  // Per-run scratch directory. Lives under the OS temp dir so it cleans up
  // naturally and never leaks into the repo working tree.
  const workDir = join(tmpdir(), 'hissuno-automation', opts.runId)
  await mkdir(workDir, { recursive: true })

  // For custom skills, materialize the SKILL.md (plus any references/ +
  // scripts/ files from the manifest) from blob storage into a per-run
  // skills directory and add it to the Workspace skills array. Mastra's
  // skill loader then treats custom skills the same as bundled ones.
  const skillDirs: string[] = [bundledSkillsDir]
  if (opts.skill.source === 'custom') {
    const bundle = await getCustomSkillBundle(opts.projectId, opts.skill.id)
    if (!bundle) {
      throw new Error(`Custom skill content missing for ${opts.skill.id}`)
    }
    const customSkillsRoot = join(workDir, '.skills')
    const customSkillDir = join(customSkillsRoot, opts.skill.id)
    await mkdir(customSkillDir, { recursive: true })
    await Promise.all([
      writeFile(join(customSkillDir, 'SKILL.md'), bundle.skillMd, 'utf8'),
      ...bundle.files.map(async (f) => {
        const target = join(customSkillDir, f.path)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, f.content, 'utf8')
      }),
    ])
    skillDirs.push(customSkillsRoot)
  }

  const enableSandbox = opts.enableSandbox ?? true

  // Build the per-run env. The CLI inside the sandbox is pre-authenticated
  // using a project-scoped API key minted by the dispatcher specifically for
  // this run. Trigger context surfaces as `$ISSUE_ID`, `$ENTITY_TYPE`, etc.
  // We deliberately drop process.env passthrough so global admin secrets
  // (like the host's HISSUNO_API_KEY) don't leak into the sandbox.
  //
  // PATH is augmented with the repo's node_modules/.bin so skill scripts can
  // invoke locally-installed tools (tsx, etc.). The E2B template must bake
  // these in separately.
  const sandboxEnv: NodeJS.ProcessEnv = {
    PATH: prependLocalBinToPath(process.env.PATH ?? ''),
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

  // Plugin credentials: skills declare `requires.plugins` and the resolver
  // injects per-plugin tokens as env vars. Naming convention:
  //   <PLUGIN>_ACCESS_TOKEN          — primary access token / api key
  //   <PLUGIN>_EXTERNAL_ACCOUNT_ID   — workspace/org/install identifier
  //   <PLUGIN>_CREDENTIALS           — full credentials JSON (for plugins
  //                                    where one token isn't enough)
  // Plugin id `github-app` → env prefix `GITHUB_APP`.
  const requiredPlugins = opts.skill.frontmatter.requires?.plugins ?? []
  for (const pluginId of requiredPlugins) {
    const resolved = await resolveConnectionToken(opts.projectId, pluginId).catch((err) => {
      throw new Error(
        `Skill "${opts.skill.id}" requires plugin "${pluginId}" but: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
    const prefix = pluginId.toUpperCase().replace(/-/g, '_')
    if (resolved.accessToken) {
      sandboxEnv[`${prefix}_ACCESS_TOKEN`] = resolved.accessToken
    }
    sandboxEnv[`${prefix}_EXTERNAL_ACCOUNT_ID`] = resolved.externalAccountId
    sandboxEnv[`${prefix}_CREDENTIALS`] = JSON.stringify(resolved.credentials)
  }

  return new Workspace({
    id: `automation-run-${opts.runId}`,
    name: `Run ${opts.runId} (${opts.skill.id})`,
    filesystem: new LocalFilesystem({ basePath: workDir }),
    skills: skillDirs,
    sandbox: enableSandbox
      ? await createSandbox({ runId: opts.runId, workDir, env: sandboxEnv })
      : undefined,
  })
}

/**
 * Pick a sandbox provider based on `SANDBOX_PROVIDER`. Defaults to
 * `LocalSandbox` (works without external services) for dev. Set to `e2b`
 * in prod with `E2B_API_KEY` + `E2B_SANDBOX_TEMPLATE` to run inside a
 * pre-built E2B template image (see infra/sandbox/README.md for the spec).
 *
 * Adding a provider is two lines: a new case here and a corresponding
 * env-var doc.
 */
async function createSandbox(opts: {
  runId: string
  workDir: string
  env: NodeJS.ProcessEnv
}): Promise<WorkspaceSandbox> {
  const provider = (process.env.SANDBOX_PROVIDER ?? 'local').toLowerCase()
  if (provider === 'e2b') {
    const { E2BSandbox } = await import('@mastra/e2b')
    const apiKey = process.env.E2B_API_KEY
    const template = process.env.E2B_SANDBOX_TEMPLATE
    if (!apiKey) throw new Error('SANDBOX_PROVIDER=e2b requires E2B_API_KEY.')
    if (!template) throw new Error('SANDBOX_PROVIDER=e2b requires E2B_SANDBOX_TEMPLATE.')
    return new E2BSandbox({
      id: `automation-${opts.runId}`,
      apiKey,
      template,
      env: opts.env as Record<string, string>,
      timeout: 30 * 60 * 1000,
    })
  }
  return new LocalSandbox({
    workingDirectory: opts.workDir,
    env: opts.env,
  })
}
