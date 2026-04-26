'use client'

import { useCallback, useEffect, useState } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { Button, Card, PageHeader, Spinner, Text } from '@/components/ui'
import { AutomationRunDialog } from '@/components/projects/automations/run-dialog'
import { RunHistoryDialog } from '@/components/projects/automations/run-history-dialog'

type SkillTriggers = {
  manual?: { entity?: string }
  scheduled?: { cron: string }
  events?: string[]
}

type LastRun = {
  runId: string
  status: string
  createdAt: string
  completedAt: string | null
}

type SkillSummary = {
  id: string
  source: 'bundled' | 'custom'
  name: string
  description: string
  version: string | null
  triggers: SkillTriggers | null
  capabilities: { sandbox?: boolean; webSearch?: boolean } | null
  enabled: boolean
  lastRun: LastRun | null
}

export default function AutomationsPage() {
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeRun, setActiveRun] = useState<{ runId: string; skillId: string } | null>(null)
  const [historyFor, setHistoryFor] = useState<SkillSummary | null>(null)

  const fetchSkills = useCallback(async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/automations?projectId=${projectId}`)
      if (!res.ok) {
        console.error('[automations] failed to load skills', res.status)
        return
      }
      const data = (await res.json()) as { skills: SkillSummary[] }
      setSkills(data.skills)
    } catch (err) {
      console.error('[automations] failed to load skills', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchSkills()
  }, [fetchSkills])

  const handleRun = useCallback(
    async (skill: SkillSummary) => {
      if (!projectId) return
      try {
        const res = await fetch(`/api/automations/${skill.id}/run?projectId=${projectId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const err = await res.text()
          alert(`Failed to start: ${err}`)
          return
        }
        const data = (await res.json()) as { runId: string }
        setActiveRun({ runId: data.runId, skillId: skill.id })
      } catch (err) {
        console.error('[automations] failed to start run', err)
        alert('Failed to start run')
      }
    },
    [projectId],
  )

  const handleToggle = useCallback(
    async (skill: SkillSummary, nextEnabled: boolean) => {
      if (!projectId) return
      // Optimistic update.
      setSkills((prev) =>
        prev.map((s) => (s.id === skill.id ? { ...s, enabled: nextEnabled } : s)),
      )
      try {
        const res = await fetch(`/api/automations/${skill.id}?projectId=${projectId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: nextEnabled }),
        })
        if (!res.ok) {
          const err = await res.text()
          alert(`Failed to update: ${err}`)
          // Roll back optimistic update.
          setSkills((prev) =>
            prev.map((s) => (s.id === skill.id ? { ...s, enabled: !nextEnabled } : s)),
          )
        }
      } catch (err) {
        console.error('[automations] toggle failed', err)
      }
    },
    [projectId],
  )

  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Automations" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Automations" />

      <div className="flex flex-col gap-3 px-4 py-4">
        <Text variant="muted">
          Skill-based automations that run on top of your project&apos;s data. Toggle each on/off,
          run on demand, or open the run history.
        </Text>

        {skills.length === 0 ? (
          <Card className="p-4">
            <Text>No automations available yet.</Text>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onRun={() => handleRun(skill)}
                onToggle={(next) => handleToggle(skill, next)}
                onOpenHistory={() => setHistoryFor(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {activeRun && (
        <AutomationRunDialog
          open
          runId={activeRun.runId}
          skillId={activeRun.skillId}
          projectId={projectId}
          onClose={() => {
            setActiveRun(null)
            void fetchSkills()
          }}
        />
      )}

      {historyFor && (
        <RunHistoryDialog
          open
          skillId={historyFor.id}
          skillName={historyFor.name}
          projectId={projectId}
          onClose={() => setHistoryFor(null)}
          onOpenRun={(runId) => {
            setHistoryFor(null)
            setActiveRun({ runId, skillId: historyFor.id })
          }}
        />
      )}
    </>
  )
}

function SkillCard({
  skill,
  onRun,
  onToggle,
  onOpenHistory,
}: {
  skill: SkillSummary
  onRun: () => void
  onToggle: (next: boolean) => void
  onOpenHistory: () => void
}) {
  const triggerSummary = formatTriggers(skill.triggers)
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Text className="font-medium">{skill.name}</Text>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--bg-muted)] text-[color:var(--fg-muted)]">
              {skill.source}
            </span>
            {skill.version && (
              <span className="text-[10px] text-[color:var(--fg-muted)]">v{skill.version}</span>
            )}
            {skill.lastRun && (
              <button
                type="button"
                onClick={onOpenHistory}
                className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--bg-muted)] text-[color:var(--fg-muted)] hover:bg-[color:var(--surface-hover)]"
                title={`${skill.lastRun.status} at ${formatTime(skill.lastRun.createdAt)}`}
              >
                last: {formatStatus(skill.lastRun.status)} · {formatRelative(skill.lastRun.createdAt)}
              </button>
            )}
          </div>
          <Text variant="muted" size="sm" className="line-clamp-2">
            {skill.description}
          </Text>
          {triggerSummary && (
            <Text variant="muted" size="xs">
              {triggerSummary}
            </Text>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={skill.enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="cursor-pointer"
            />
            <span className="text-[color:var(--fg-muted)]">{skill.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
          <div className="flex gap-1.5">
            <Button onClick={onOpenHistory} variant="secondary" size="sm">
              History
            </Button>
            <Button onClick={onRun} variant="primary" size="sm" disabled={!skill.enabled}>
              Run now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function formatTriggers(triggers: SkillTriggers | null): string | null {
  if (!triggers) return null
  const parts: string[] = []
  if (triggers.manual) parts.push('manual')
  if (triggers.scheduled) parts.push(`scheduled (${triggers.scheduled.cron})`)
  if (triggers.events && triggers.events.length > 0) parts.push(`events: ${triggers.events.join(', ')}`)
  if (parts.length === 0) return null
  return `Triggers: ${parts.join(' · ')}`
}

function formatStatus(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'ok'
    case 'failed':
      return 'fail'
    case 'cancelled':
      return 'cancelled'
    case 'running':
      return 'running'
    case 'queued':
      return 'queued'
    default:
      return status
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}
