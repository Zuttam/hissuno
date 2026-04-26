/**
 * Shared types for the skill-based automation system.
 *
 * A "skill" is a markdown document (SKILL.md) plus an optional set of
 * supporting files. The frontmatter describes what triggers it, what input
 * it expects, and what capabilities it needs at runtime.
 *
 * Bundled skills ship in `packages/skills/`. Custom skills live in blob
 * storage. Both surface to the project as a single catalog.
 */

import type { SkillSource, TriggerType } from '@/lib/db/queries/automation-runs'

export type EntityType =
  | 'issue'
  | 'customer'
  | 'scope'
  | 'session'
  | 'feedback'
  | 'knowledge_source'
  | 'package'

export type EventName =
  | 'issue.created'
  | 'feedback.created'
  | 'customer.created'
  | 'session.closed'
  | 'knowledge.created'

export type SkillFrontmatter = {
  /** Stable kebab-case id used for DB rows and routing. Must match folder name. */
  name: string
  /** One-paragraph human description shown in the UI. */
  description: string
  /** Author-provided semver-like string. Snapshotted into automation_runs.skill_version. */
  version?: string
  /** Triggers describe how/when the runner can be invoked. */
  triggers?: {
    manual?: { entity?: EntityType }
    scheduled?: { cron: string }
    events?: EventName[]
  }
  /**
   * Input schema. v1 is a flat record of `{ name: { type, required, description? } }`.
   * Mastra's input validation hooks into this when running.
   */
  input?: Record<
    string,
    {
      type: 'string' | 'number' | 'boolean'
      required?: boolean
      description?: string
    }
  >
  /** Per-skill capabilities. v1: sandbox is always on; webSearch is optional. */
  capabilities?: {
    sandbox?: boolean
    webSearch?: boolean
  }
  /** Per-run wall-clock cap in ms. Defaults to 30 * 60_000. */
  timeoutMs?: number
}

/**
 * A discovered skill in the catalog.
 *
 * For bundled skills, `path` points to a real filesystem path. For custom
 * skills, `path` is the blob storage key prefix. The runner uses the
 * appropriate filesystem provider to read these.
 */
export type SkillDescriptor = {
  source: SkillSource
  /** Skill id (kebab-case, matches folder name and frontmatter.name). */
  id: string
  frontmatter: SkillFrontmatter
  /** Filesystem-relative path to the skill directory. */
  path: string
}

/**
 * Trigger context passed to dispatchAutomationRun.
 *
 * The runner uses this both to fill the static system-prompt prefix and to
 * persist a row in automation_runs.
 */
export type TriggerContext = {
  type: TriggerType
  entity?: {
    type: EntityType
    id: string
    /** Pre-fetched human-readable name for the prompt; optional. */
    name?: string
    /** Pre-fetched JSON snapshot for the prompt; optional. */
    snapshot?: Record<string, unknown>
  }
  /** Optional structured input from the caller (manual UI, cron, event). */
  input?: Record<string, unknown>
}
