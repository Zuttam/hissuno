/**
 * System-prompt harness.
 *
 * Every automation run starts with a fixed prefix the skill author can rely
 * on: who's running, why (trigger + entity), and how to use the available
 * tools. The skill body itself loads on demand via the Workspace `skill` tool.
 */

import type { SkillDescriptor, TriggerContext } from './types'

export type HarnessInput = {
  skill: SkillDescriptor
  trigger: TriggerContext
  project: { id: string; name: string }
}

export function buildHarnessPrefix(input: HarnessInput): string {
  const { skill, trigger, project } = input

  const triggerSection = renderTriggerSection(trigger)
  const sandboxAvailable = skill.frontmatter.capabilities?.sandbox ?? false
  const webSearchAvailable = skill.frontmatter.capabilities?.webSearch ?? false

  const toolingSection = [
    `- Load the skill instructions: call the \`skill\` tool with name="${skill.id}".`,
    `- Report progress with the \`report_progress\` tool between phases. Keep messages short.`,
    sandboxAvailable
      ? `- Use \`execute_command\` to run \`hissuno\`, \`gh\`, \`git\`, etc. in your sandbox.`
      : `- The hissuno CLI is NOT available in this run. Use the data tools the skill provides.`,
    webSearchAvailable
      ? `- Use \`web_search\` for external research.`
      : `- Web search is disabled for this skill. Stay within the project's data.`,
    `- Final output: write a JSON object to \`output.json\` in the workspace filesystem before finishing. The dispatcher reads that file and stores it as the run output.`,
  ].join('\n')

  return [
    `You are a hissuno automation agent running the "${skill.id}" skill.`,
    ``,
    `# Trigger`,
    triggerSection,
    ``,
    `# Project`,
    `Project: ${project.name} (${project.id})`,
    ``,
    `# How to work`,
    toolingSection,
    ``,
    `Begin by calling \`skill\` with name="${skill.id}" to load the full instructions, then follow them.`,
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
