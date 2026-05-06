/**
 * System-prompt harness.
 *
 * Every automation run starts with a fixed prefix the skill author can rely
 * on: who's running, why (trigger + entity), and how to use the available
 * tools. The skill body itself loads on demand via the Workspace `skill` tool.
 */

import { summarizeOutputSchema } from './output-schema'
import type { SkillDescriptor, TriggerContext } from './types'

export type HarnessCodebase = {
  repositoryUrl: string
  branch: string
  /** Optional human-friendly name; falls back to repositoryUrl when absent. */
  name?: string | null
}

export type HarnessInput = {
  skill: SkillDescriptor
  trigger: TriggerContext
  project: { id: string; name: string }
  /** Present when the project has at least one enabled GitHub codebase. */
  codebase?: HarnessCodebase | null
}

export function buildHarnessPrefix(input: HarnessInput): string {
  const { skill, trigger, project, codebase } = input

  const triggerSection = renderTriggerSection(trigger)
  const sandboxAvailable = skill.frontmatter.capabilities?.sandbox ?? false
  const webSearchAvailable = skill.frontmatter.capabilities?.webSearch ?? false
  const codebaseAvailable = !!codebase
  const hasOutputSchema = !!skill.frontmatter.output

  const toolingLines = [
    `- Load the skill instructions: call the \`skill\` tool with name="${skill.id}".`,
    `- Report progress with the \`report_progress\` tool between phases. Keep messages short.`,
    sandboxAvailable
      ? `- Use \`execute_command\` to run \`hissuno\`, \`gh\`, \`git\`, etc. in your sandbox.`
      : `- The hissuno CLI is NOT available in this run. Use the data tools the skill provides.`,
    webSearchAvailable
      ? `- Use \`web_search\` for external research.`
      : `- Web search is disabled for this skill. Stay within the project's data.`,
    codebaseAvailable
      ? `- Use \`analyze_codebase\` with a focused question to investigate the connected codebase. It runs a fresh subagent with read/grep/scoped-bash access; it does not modify the code.`
      : null,
    hasOutputSchema
      ? `- Final output: end your run with a clear assistant message that contains every field listed in the # Output section below. The harness coerces it into a typed object automatically — you do not need to write JSON yourself.`
      : `- Final output: write a JSON object to \`output.json\` in the workspace filesystem before finishing. The dispatcher reads that file and stores it as the run output.`,
  ].filter((line): line is string => line !== null)

  const sections: string[] = [
    `You are a hissuno automation agent running the "${skill.id}" skill.`,
    ``,
    `# Trigger`,
    triggerSection,
    ``,
    `# Project`,
    `Project: ${project.name} (${project.id})`,
  ]

  if (codebase) {
    sections.push(``, `# Codebase`, renderCodebaseSection(codebase))
  }

  sections.push(``, `# How to work`, toolingLines.join('\n'))

  if (hasOutputSchema && skill.frontmatter.output) {
    sections.push(``, `# Output`, renderOutputSection(skill.frontmatter.output))
  }

  sections.push(
    ``,
    `Begin by calling \`skill\` with name="${skill.id}" to load the full instructions, then follow them.`,
  )

  return sections.join('\n')
}

function renderOutputSection(schema: NonNullable<SkillDescriptor['frontmatter']['output']>): string {
  const fields = summarizeOutputSchema(schema)
  const lines = [
    `Your final assistant message must include the following fields. The harness will`,
    `validate and coerce the structure automatically; you do not need to format JSON yourself.`,
    ``,
  ]
  for (const f of fields) {
    const flag = f.required ? '' : ' (optional)'
    const desc = f.description ? ` — ${f.description}` : ''
    lines.push(`- \`${f.path}\`: ${f.type}${flag}${desc}`)
  }
  return lines.join('\n')
}

function renderCodebaseSection(codebase: HarnessCodebase): string {
  const label = codebase.name?.trim() || codebase.repositoryUrl
  return [
    `This project has a codebase connected: ${label} (branch: ${codebase.branch}).`,
    `Call \`analyze_codebase\` with a focused natural-language question to ground decisions in real code (find existing implementations, size effort, trace data flow, etc.). Read-only.`,
  ].join('\n')
}

function renderTriggerSection(trigger: TriggerContext): string {
  const lines: string[] = [`Type: ${trigger.type}`]

  if (trigger.entity) {
    const entityHeader = trigger.entity.name
      ? `Entity: ${trigger.entity.type} ${trigger.entity.id} (${trigger.entity.name})`
      : `Entity: ${trigger.entity.type} ${trigger.entity.id}`
    lines.push(entityHeader)

    if (trigger.entity.snapshot) {
      lines.push(`Entity snapshot:`)
      lines.push('```json')
      lines.push(JSON.stringify(trigger.entity.snapshot, null, 2))
      lines.push('```')
    }
  }

  if (trigger.input && Object.keys(trigger.input).length > 0) {
    lines.push(`Input:`)
    lines.push('```json')
    lines.push(JSON.stringify(trigger.input, null, 2))
    lines.push('```')
  }

  return lines.join('\n')
}
