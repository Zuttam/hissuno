/**
 * Shared types for the skill-based automation system.
 *
 * A "skill" is a markdown document (SKILL.md) plus an optional set of
 * supporting files. The frontmatter describes what triggers it, what input
 * it expects, and what capabilities it needs at runtime.
 *
 * Bundled automation skills ship in `src/lib/automations/skills/`. Custom
 * skills live in blob storage. Both surface to the project as a single
 * catalog. (User-facing skills shipped via the CLI live in `packages/skills/`
 * and are unrelated to this catalog.)
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
  | 'issue.status_changed'
  | 'feedback.created'
  | 'contact.created'
  | 'company.created'
  | 'session.created'
  | 'session.closed'
  | 'knowledge.created'
  | 'scope.created'
  | 'scope.updated'
  /** External webhook landed for a plugin connection. Payload flows via trigger.input. */
  | 'webhook.slack'
  | 'webhook.github'

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
  /**
   * Output schema. When set, the harness passes a Zod equivalent to Mastra's
   * `structuredOutput`, which coerces the agent's final response into a typed
   * object. The dispatcher persists `response.object` as `automation_runs.output`
   * instead of reading `output.json`. Skills without this field keep the file-based
   * output path. Subset of JSON Schema — no $ref / oneOf / anyOf.
   */
  output?: JsonSchemaNode
  /** Per-skill capabilities. v1: sandbox is always on; webSearch is optional. */
  capabilities?: {
    sandbox?: boolean
    webSearch?: boolean
  }
  /** Per-run wall-clock cap in ms. Defaults to 30 * 60_000. */
  timeoutMs?: number
  /**
   * Declared runtime dependencies. The harness fails the run early if any
   * required plugin is not connected for the project.
   *
   * `plugins`: each id must match a registered integration plugin. The
   * resolver injects per-plugin tokens into the sandbox env (e.g.
   * `SLACK_ACCESS_TOKEN`, `LINEAR_API_KEY`). Multi-connection plugins
   * additionally require the script to read `<PLUGIN>_EXTERNAL_ACCOUNT_ID` to
   * disambiguate; the harness chooses one connection per run.
   *
   * `scopes`: surfaced for UX/connect-time only — not enforced at run time.
   */
  requires?: {
    plugins?: string[]
    scopes?: string[]
  }
}

/**
 * Narrow JSON Schema subset usable in SKILL.md frontmatter.
 *
 * Keep intentionally small so YAML stays readable and the converter in
 * `output-schema.ts` can stay deterministic.
 */
export type JsonSchemaNode =
  | JsonSchemaObject
  | JsonSchemaArray
  | JsonSchemaPrimitive

export type JsonSchemaObject = {
  type: 'object'
  description?: string
  properties: Record<string, JsonSchemaNode>
  required?: string[]
}

export type JsonSchemaArray = {
  type: 'array'
  description?: string
  items: JsonSchemaNode
}

export type JsonSchemaPrimitive = {
  type: 'string' | 'number' | 'integer' | 'boolean'
  description?: string
  enum?: (string | number | boolean)[]
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
