/**
 * Event-trigger dispatcher.
 *
 * Write sites (e.g., issues-service.createIssue, customers-service.upsertContact)
 * call `notifyAutomationEvent(event, ctx)` after a successful insert. The
 * dispatcher looks up which bundled skills declared that event in their
 * frontmatter (`triggers.events`) and dispatches one automation run per
 * matching skill.
 *
 * Fires fire-and-forget - failures don't block the originating write.
 *
 * Per-project enable/disable lives behind `isAutomationEnabledForProject`,
 * which today only special-cases the legacy `issue_analysis_enabled` flag.
 * Phase 7's per-project skill catalog widens this to a real allowlist.
 */

import { dispatchAutomationRun } from './dispatch'
import { listBundledSkills } from './skills'
import { getProjectById } from '@/lib/db/queries/projects'
import { getPmAgentSettingsAdmin } from '@/lib/db/queries/project-settings'
import type { EntityType, EventName } from './types'

export type EventContext = {
  projectId: string
  entity?: { type: EntityType; id: string }
}

/**
 * Returns whether `skillId` is enabled for `projectId`. Today this only
 * gates the legacy `hissuno-issue-analysis` flag; everything else fires by
 * default. Phase 7 lands the proper per-project skill registry.
 */
async function isAutomationEnabledForProject(
  skillId: string,
  projectId: string,
): Promise<boolean> {
  if (skillId === 'hissuno-issue-analysis') {
    try {
      const settings = await getPmAgentSettingsAdmin(projectId)
      return Boolean(settings.issue_analysis_enabled)
    } catch {
      return false
    }
  }
  return true
}

export function notifyAutomationEvent(event: EventName, ctx: EventContext): void {
  void (async () => {
    try {
      const matching = listBundledSkills().filter((skill) =>
        (skill.frontmatter.triggers?.events ?? []).includes(event),
      )
      if (matching.length === 0) return

      const project = await getProjectById(ctx.projectId)
      if (!project) return

      for (const skill of matching) {
        try {
          if (!(await isAutomationEnabledForProject(skill.id, project.id))) continue

          await dispatchAutomationRun({
            projectId: project.id,
            projectName: project.name,
            skillId: skill.id,
            trigger: {
              type: 'event',
              entity: ctx.entity,
            },
          })
        } catch (err) {
          // One skill failing shouldn't stop the others; log and continue.
          console.error(
            `[automation-events] failed to dispatch ${skill.id} on ${event}`,
            err,
          )
        }
      }
    } catch (err) {
      // Fire-and-forget - the originating write has already committed.
      console.error('[automation-events] dispatch error', err)
    }
  })()
}
