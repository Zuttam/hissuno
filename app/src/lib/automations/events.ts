/**
 * Event-trigger dispatcher.
 *
 * Write sites (e.g., issues-service.createIssue, customers-service.upsertContact)
 * call `notifyAutomationEvent(event, ctx)` after a successful insert. The
 * dispatcher looks up which bundled skills declared that event in their
 * effective triggers (project override if any, else SKILL.md frontmatter)
 * and dispatches one automation run per matching enabled skill.
 *
 * Fires fire-and-forget — failures don't block the originating write.
 */

import { dispatchAutomationRun } from './dispatch'
import { listBundledSkills } from './skills'
import { getProjectById } from '@/lib/db/queries/projects'
import { getEffectiveSkillSettings } from '@/lib/db/queries/project-skill-settings'
import type { EntityType, EventName } from './types'

export type EventContext = {
  projectId: string
  entity?: { type: EntityType; id: string }
}

export function notifyAutomationEvent(event: EventName, ctx: EventContext): void {
  void (async () => {
    try {
      const allBundled = listBundledSkills()
      if (allBundled.length === 0) return

      const project = await getProjectById(ctx.projectId)
      if (!project) return

      const settingsMap = await getEffectiveSkillSettings(
        project.id,
        allBundled.map((s) => ({ id: s.id, declaredTriggers: s.frontmatter.triggers ?? null })),
      )

      const matching = allBundled.filter((skill) => {
        const settings = settingsMap.get(skill.id)
        if (settings && !settings.enabled) return false
        const events = settings?.triggers?.events ?? []
        return events.includes(event)
      })
      if (matching.length === 0) return

      await Promise.allSettled(
        matching.map(async (skill) => {
          try {
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
            console.error(
              `[automation-events] failed to dispatch ${skill.id} on ${event}`,
              err,
            )
          }
        }),
      )
    } catch (err) {
      // Fire-and-forget — the originating write has already committed.
      console.error('[automation-events] dispatch error', err)
    }
  })()
}
