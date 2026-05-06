/**
 * Skill-runner agent factory.
 *
 * One generic Mastra Agent that loads a single skill (by id) and executes it.
 * The agent is instantiated per-run because (a) the workspace is per-run and
 * (b) the system-prompt prefix bakes in trigger-specific context.
 */

import { Agent } from '@mastra/core/agent'
import { Workspace } from '@mastra/core/workspace'
import { analyzeCodebaseTool } from '@/mastra/tools/analyze-codebase-tool'
import { reportProgressTool } from '@/mastra/tools/report-progress-tool'
import { webSearchTool } from '@/mastra/tools/web-search-tool'
import { resolveModel, type ModelConfig } from '@/mastra/models'

export const SKILL_RUNNER_MODEL: ModelConfig = {
  name: 'skill-runner',
  tier: 'default',
  fallback: 'anthropic/claude-sonnet-4-6',
}

export type SkillRunnerOptions = {
  runId: string
  skillId: string
  /** Static prefix prepended to whatever the skill's SKILL.md contains. */
  harnessPrefix: string
  workspace: Workspace
  /** When true, registers the analyze_codebase tool. The harness prompt should
   *  include a # Codebase section so the agent knows to use it. */
  codebaseAvailable?: boolean
}

export function createSkillRunner(opts: SkillRunnerOptions): Agent {
  const tools: Record<string, typeof reportProgressTool | typeof webSearchTool | typeof analyzeCodebaseTool> = {
    [reportProgressTool.id]: reportProgressTool,
    [webSearchTool.id]: webSearchTool,
  }
  if (opts.codebaseAvailable) {
    tools[analyzeCodebaseTool.id] = analyzeCodebaseTool
  }
  return new Agent({
    id: `skill-runner-${opts.runId}`,
    name: 'Skill Runner',
    instructions: opts.harnessPrefix,
    model: ({ requestContext }) => resolveModel(SKILL_RUNNER_MODEL, requestContext),
    tools,
    workspace: opts.workspace,
  })
}
