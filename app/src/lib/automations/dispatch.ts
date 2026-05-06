/**
 * Automation dispatch orchestrator.
 *
 * Single entry point for all three trigger types (manual, scheduled, event).
 * Creates the run row, builds the per-run workspace + agent, runs the agent,
 * captures output (or error), and persists status.
 *
 * The agent runs asynchronously — `dispatchAutomationRun` returns the run id
 * once the row is created and the agent is started, without waiting for it
 * to finish. Callers stream progress via the SSE route or poll the row.
 */

import { Mastra } from '@mastra/core/mastra'
import { RequestContext } from '@mastra/core/request-context'
import type { z } from 'zod'
import { findSkill, listBundledSkills } from './skills'
import {
  getCustomSkillDescriptor,
  listCustomSkillDescriptors,
} from './custom-skills'
import { buildHarnessPrefix, type HarnessCodebase } from './harness'
import { jsonSchemaToZod } from './output-schema'
import { closeRunChannel, publishRunEvent, subscribeRunCancel } from './run-bus'
import { buildWorkspaceForRun } from '@/mastra/workspace/build'
import { createSkillRunner } from '@/mastra/agents/skill-runner-agent'
import { getOrCreateAutomationApiKey } from './api-key'
import { getCodebaseInfo, releaseCodebase } from '@/lib/codebase/manager'
import { getCodebaseById } from '@/lib/codebase/service'
import {
  appendProgressEvent,
  createAutomationRun,
  markAutomationRunCancelled,
  markAutomationRunFailed,
  markAutomationRunStarted,
  markAutomationRunSucceeded,
  type AutomationRunRow,
  type ProgressEvent,
} from '@/lib/db/queries/automation-runs'
import { getProjectSkillSetting } from '@/lib/db/queries/project-skill-settings'
import type { SkillFrontmatter, TriggerContext } from './types'

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

export type DispatchInput = {
  projectId: string
  projectName: string
  skillId: string
  trigger: TriggerContext
}

export async function dispatchAutomationRun(
  input: DispatchInput,
): Promise<{ run: AutomationRunRow }> {
  const skill =
    findSkill(input.skillId) ?? (await getCustomSkillDescriptor(input.projectId, input.skillId))
  if (!skill) {
    throw new Error(`Skill not found: ${input.skillId}`)
  }

  // Per-project gating: if the skill is disabled for this project, refuse to
  // dispatch regardless of trigger source.
  const settings = await getProjectSkillSetting(input.projectId, skill.id)
  if (settings && !settings.enabled) {
    throw new Error(`Skill ${skill.id} is disabled for this project.`)
  }

  // Validate against the effective triggers (project override if any, else
  // the SKILL.md frontmatter declarations).
  const effectiveTriggers = (settings?.triggers as SkillFrontmatter['triggers'] | null | undefined)
    ?? skill.frontmatter.triggers
  validateTrigger(skill.id, effectiveTriggers ?? undefined, input.trigger)

  const run = await createAutomationRun({
    projectId: input.projectId,
    skillId: skill.id,
    skillVersion: skill.frontmatter.version ?? null,
    skillSource: skill.source,
    triggerType: input.trigger.type,
    triggerEntityType: input.trigger.entity?.type ?? null,
    triggerEntityId: input.trigger.entity?.id ?? null,
    input: input.trigger.input ?? {},
  })

  // Fire-and-forget. The route returns immediately; the agent runs in the
  // background. Errors are captured in the row, not thrown.
  void executeRun({
    run,
    skill,
    project: { id: input.projectId, name: input.projectName },
    trigger: input.trigger,
  })

  return { run }
}

type ExecuteRunInput = {
  run: AutomationRunRow
  skill: ReturnType<typeof findSkill>
  project: { id: string; name: string }
  trigger: TriggerContext
}

async function executeRun(input: ExecuteRunInput): Promise<void> {
  const { run, skill, project, trigger } = input
  if (!skill) return

  const startedEvent: ProgressEvent = {
    ts: new Date().toISOString(),
    type: 'run-start',
    message: `Starting ${skill.id}`,
  }

  await markAutomationRunStarted(run.id)
  await appendProgressEvent(run.id, startedEvent)
  publishRunEvent(run.id, startedEvent)

  const timeoutMs = skill.frontmatter.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // Compile the declared output schema (if any) up front so a malformed
  // frontmatter fails the run cleanly before we spend tokens.
  let outputZodSchema: z.ZodTypeAny | undefined
  if (skill.frontmatter.output) {
    try {
      outputZodSchema = jsonSchemaToZod(skill.frontmatter.output)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid output schema'
      const errorEvent: ProgressEvent = {
        ts: new Date().toISOString(),
        type: 'error',
        message,
      }
      await appendProgressEvent(run.id, errorEvent).catch(() => {})
      publishRunEvent(run.id, errorEvent)
      await markAutomationRunFailed(run.id, { message })
      closeRunChannel(run.id)
      return
    }
  }

  // Resolve the project's long-lived automation API key (created on first
  // use, stored encrypted). Reused across all runs — no per-run mint/revoke
  // churn. Rotation is a separate admin action.
  try {
    const automationKey = await getOrCreateAutomationApiKey(project.id)

    const workspace = await buildWorkspaceForRun({
      runId: run.id,
      skill,
      projectId: project.id,
      apiKey: automationKey.fullKey,
      entity: trigger.entity ? { type: trigger.entity.type, id: trigger.entity.id } : undefined,
      input: trigger.input,
    })
    const harnessCodebase = await resolveHarnessCodebase(project.id)
    const harnessPrefix = buildHarnessPrefix({
      skill,
      trigger,
      project,
      codebase: harnessCodebase,
    })
    const agent = createSkillRunner({
      runId: run.id,
      skillId: skill.id,
      harnessPrefix,
      workspace,
      codebaseAvailable: harnessCodebase !== null,
    })

    // Register the agent on a one-off Mastra so its workspace lifecycle
    // (skill discovery, sandbox warm-up) initializes properly.
    new Mastra({ agents: { runner: agent } })

    const requestContext = new RequestContext()
    requestContext.set('runId', run.id)
    requestContext.set('projectId', project.id)
    requestContext.set('skillId', skill.id)

    const userPrompt = [
      `Run the skill end-to-end. Load instructions, execute the work, and write your output.`,
      trigger.entity ? `Entity: ${trigger.entity.type}/${trigger.entity.id}.` : '',
    ]
      .filter(Boolean)
      .join(' ')

    // Wire cancellation: a cancel API call publishes via run-bus, which trips
    // the AbortController. Mastra propagates the abort signal into in-flight
    // tool calls + streaming so the agent terminates promptly.
    const abortController = new AbortController()
    const unsubscribeCancel = subscribeRunCancel(run.id, () => {
      abortController.abort(new Error('Run cancelled by user'))
    })

    let response: Awaited<ReturnType<typeof agent.generate>>
    try {
      // Mastra's `structuredOutput` runs a separate structuring pass over the
      // agent's tool-calling conversation and surfaces the typed result on
      // `response.object`. Skills without an `output` schema keep using the
      // file-based `output.json` path below. Branched calls keep TS happy
      // because the two `generate()` overloads have different option shapes.
      const generatePromise = outputZodSchema
        ? agent.generate(userPrompt, {
            requestContext,
            maxSteps: 25,
            abortSignal: abortController.signal,
            structuredOutput: { schema: outputZodSchema },
          })
        : agent.generate(userPrompt, {
            requestContext,
            maxSteps: 25,
            abortSignal: abortController.signal,
          })
      response = await Promise.race([
        generatePromise,
        new Promise<never>((_resolve, reject) =>
          setTimeout(() => reject(new Error(`Run timed out after ${timeoutMs}ms`)), timeoutMs),
        ),
      ])
    } catch (err) {
      if (abortController.signal.aborted) {
        const cancelEvent: ProgressEvent = {
          ts: new Date().toISOString(),
          type: 'cancelled',
          message: 'Run cancelled',
        }
        await appendProgressEvent(run.id, cancelEvent).catch(() => {})
        publishRunEvent(run.id, cancelEvent)
        await markAutomationRunCancelled(run.id)
        return
      }
      throw err
    } finally {
      unsubscribeCancel()
    }

    // Output resolution: when the skill declared an `output` schema, Mastra's
    // structuredOutput pass populates `response.object` with the typed result.
    // Otherwise, fall back to the legacy "agent writes output.json" contract.
    let output: Record<string, unknown> = {}
    if (outputZodSchema) {
      const obj = (response as { object?: unknown }).object
      output = (obj && typeof obj === 'object')
        ? (obj as Record<string, unknown>)
        : { text: response.text ?? '' }
    } else {
      try {
        const fs = workspace.filesystem
        if (fs) {
          const outputJson = await fs.readFile('output.json')
          const text =
            typeof outputJson === 'string'
              ? outputJson
              : Buffer.isBuffer(outputJson)
                ? outputJson.toString('utf8')
                : ''
          output = text ? (JSON.parse(text) as Record<string, unknown>) : { text: response.text }
        } else {
          output = { text: response.text ?? '' }
        }
      } catch {
        output = { text: response.text ?? '' }
      }
    }

    const finishEvent: ProgressEvent = {
      ts: new Date().toISOString(),
      type: 'run-finish',
      message: `Finished ${skill.id}`,
    }
    await appendProgressEvent(run.id, finishEvent)
    publishRunEvent(run.id, finishEvent)

    await markAutomationRunSucceeded(run.id, output)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const stack = err instanceof Error ? err.stack : undefined

    const errorEvent: ProgressEvent = {
      ts: new Date().toISOString(),
      type: 'error',
      message,
    }
    await appendProgressEvent(run.id, errorEvent).catch(() => {})
    publishRunEvent(run.id, errorEvent)

    await markAutomationRunFailed(run.id, { message, stack })
  } finally {
    // Idempotent — safe to call even if no codebase lease was acquired this run.
    await releaseCodebase(run.id).catch((err) => {
      console.warn(`[dispatch] Failed to release codebase lease for run ${run.id}:`, err)
    })
    closeRunChannel(run.id)
  }
}

/**
 * Look up the project's connected codebase (if any) and return a harness-shaped
 * descriptor. Returns null when nothing is configured. We pull the friendly
 * `name` from the codebases row when available; getCodebaseInfo() doesn't
 * include it, so when present we issue a second small fetch by id.
 */
async function resolveHarnessCodebase(projectId: string): Promise<HarnessCodebase | null> {
  const info = await getCodebaseInfo(projectId)
  if (!info) return null
  const row = await getCodebaseById(info.codebaseId).catch(() => null)
  return {
    repositoryUrl: info.repositoryUrl,
    branch: info.branch,
    name: row?.name ?? null,
  }
}

function validateTrigger(
  skillId: string,
  declared: NonNullable<ReturnType<typeof findSkill>>['frontmatter']['triggers'] | undefined,
  trigger: TriggerContext,
): void {
  if (!declared) {
    // No declarations means any trigger is allowed (lenient default).
    return
  }
  if (trigger.type === 'manual' && !declared.manual) {
    throw new Error(`Skill ${skillId} does not support manual triggers.`)
  }
  if (trigger.type === 'scheduled' && !declared.scheduled) {
    throw new Error(`Skill ${skillId} does not support scheduled triggers.`)
  }
  if (trigger.type === 'event') {
    const events = declared.events ?? []
    if (events.length === 0) {
      throw new Error(`Skill ${skillId} does not support event triggers.`)
    }
  }
  if (declared.manual?.entity && trigger.type === 'manual' && !trigger.entity) {
    throw new Error(`Skill ${skillId} requires a ${declared.manual.entity} entity for manual runs.`)
  }
}

/** Re-export so consumers don't have to import from skills.ts directly. */
export { listBundledSkills }

/**
 * Returns the merged catalog (bundled + custom) for a project. Custom
 * skills are loaded from the project-scoped blob storage; bundled skills
 * come from `src/lib/automations/skills/`.
 */
export async function listSkillsForProject(projectId: string) {
  const [custom] = await Promise.all([listCustomSkillDescriptors(projectId)])
  const customIds = new Set(custom.map((s) => s.id))
  const bundled = listBundledSkills().filter((s) => !customIds.has(s.id))
  return [...bundled, ...custom]
}
