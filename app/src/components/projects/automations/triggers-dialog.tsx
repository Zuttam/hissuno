'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Dialog, Input } from '@/components/ui'

const ALL_EVENTS = [
  'issue.created',
  'feedback.created',
  'contact.created',
  'company.created',
  'session.created',
  'session.closed',
  'knowledge.created',
] as const

const ENTITY_OPTIONS = [
  '',
  'issue',
  'customer',
  'scope',
  'session',
  'feedback',
  'knowledge_source',
  'package',
] as const

type EventName = (typeof ALL_EVENTS)[number]
type EntityType = Exclude<(typeof ENTITY_OPTIONS)[number], ''>

type SkillTriggers = {
  manual?: { entity?: EntityType }
  scheduled?: { cron: string }
  events?: EventName[]
}

interface Props {
  open: boolean
  skillId: string
  skillName: string
  declaredTriggers: SkillTriggers | null
  effectiveTriggers: SkillTriggers | null
  hasOverride: boolean
  onCloseAction: () => void
  onSaveAction: (triggers: SkillTriggers | null) => Promise<void>
}

export function TriggersDialog({
  open,
  skillName,
  declaredTriggers,
  effectiveTriggers,
  hasOverride,
  onCloseAction,
  onSaveAction,
}: Props) {
  const initial = effectiveTriggers ?? declaredTriggers ?? {}
  const [manualOn, setManualOn] = useState(Boolean(initial.manual))
  const [manualEntity, setManualEntity] = useState<EntityType | ''>(initial.manual?.entity ?? '')
  const [scheduledOn, setScheduledOn] = useState(Boolean(initial.scheduled))
  const [cron, setCron] = useState(initial.scheduled?.cron ?? '')
  const [eventsSet, setEventsSet] = useState<Set<EventName>>(new Set(initial.events ?? []))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset whenever the dialog opens with a different skill or override state.
  useEffect(() => {
    if (!open) return
    const seed = effectiveTriggers ?? declaredTriggers ?? {}
    setManualOn(Boolean(seed.manual))
    setManualEntity(seed.manual?.entity ?? '')
    setScheduledOn(Boolean(seed.scheduled))
    setCron(seed.scheduled?.cron ?? '')
    setEventsSet(new Set(seed.events ?? []))
    setError(null)
  }, [open, effectiveTriggers, declaredTriggers])

  const composed = useMemo<SkillTriggers>(() => {
    const t: SkillTriggers = {}
    if (manualOn) t.manual = manualEntity ? { entity: manualEntity } : {}
    if (scheduledOn && cron.trim()) t.scheduled = { cron: cron.trim() }
    if (eventsSet.size > 0) t.events = Array.from(eventsSet) as EventName[]
    return t
  }, [manualOn, manualEntity, scheduledOn, cron, eventsSet])

  const canSave = useMemo(() => {
    if (scheduledOn && !cron.trim()) return false
    return manualOn || (scheduledOn && cron.trim().length > 0) || eventsSet.size > 0
  }, [manualOn, scheduledOn, cron, eventsSet])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSaveAction(composed)
      onCloseAction()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save triggers.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetToDefaults = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onSaveAction(null)
      onCloseAction()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset triggers.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleEvent = (event: EventName, on: boolean) => {
    setEventsSet((prev) => {
      const next = new Set(prev)
      if (on) next.add(event)
      else next.delete(event)
      return next
    })
  }

  return (
    <Dialog open={open} onClose={onCloseAction} title={`Triggers — ${skillName}`} size="lg">
      <div className="flex flex-col gap-5">
        <p className="text-xs text-[color:var(--text-secondary)]">
          Override when this automation runs. Saving replaces the SKILL.md defaults for this project.
          {hasOverride && ' Currently using a project override.'}
        </p>

        {/* Manual */}
        <div className="flex flex-col gap-2 rounded-[4px] border border-[color:var(--border-subtle)] p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={manualOn}
              onChange={(e) => setManualOn(e.target.checked)}
            />
            <span className="font-medium">Manual</span>
            <span className="text-xs text-[color:var(--text-tertiary)]">
              Run on demand from the UI.
            </span>
          </label>
          {manualOn && (
            <div className="flex items-center gap-2 pl-6 text-xs">
              <label className="text-[color:var(--text-secondary)]">Entity scope:</label>
              <select
                value={manualEntity}
                onChange={(e) => setManualEntity(e.target.value as EntityType | '')}
                className="rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-xs"
              >
                {ENTITY_OPTIONS.map((opt) => (
                  <option key={opt || 'none'} value={opt}>
                    {opt || 'None (project-level)'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Scheduled */}
        <div className="flex flex-col gap-2 rounded-[4px] border border-[color:var(--border-subtle)] p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={scheduledOn}
              onChange={(e) => setScheduledOn(e.target.checked)}
            />
            <span className="font-medium">Scheduled</span>
            <span className="text-xs text-[color:var(--text-tertiary)]">
              Cron expression (e.g. <code>0 9 * * *</code>).
            </span>
          </label>
          {scheduledOn && (
            <div className="pl-6">
              <Input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 9 * * *"
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>

        {/* Events */}
        <div className="flex flex-col gap-2 rounded-[4px] border border-[color:var(--border-subtle)] p-3">
          <span className="text-sm font-medium">Events</span>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            Fire when these events occur in the project.
          </span>
          <div className="grid grid-cols-2 gap-1.5 pl-1 pt-1">
            {ALL_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={eventsSet.has(event)}
                  onChange={(e) => toggleEvent(event, e.target.checked)}
                />
                <code className="text-[color:var(--text-secondary)]">{event}</code>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-[color:var(--accent-danger)]">{error}</p>}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleResetToDefaults()}
            disabled={isSaving || !hasOverride}
            title={hasOverride ? 'Clear the override; use SKILL.md defaults' : 'No override to reset'}
          >
            Reset to defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onCloseAction} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!canSave || isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
