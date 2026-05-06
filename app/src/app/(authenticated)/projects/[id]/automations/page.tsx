'use client'

import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { Calendar, Download, FileText, History, Play, Trash2, Upload } from 'lucide-react'
import { useProject } from '@/components/providers/project-provider'
import { Badge, Card, PageHeader, Spinner, Text } from '@/components/ui'
import { AutomationRunDialog } from '@/components/projects/automations/run-dialog'
import { CustomSkillUploadDialog } from '@/components/projects/automations/custom-skill-upload-dialog'
import { RunHistoryDialog } from '@/components/projects/automations/run-history-dialog'
import { SkillDetailDialog } from '@/components/projects/automations/skill-detail-dialog'
import { TriggersDialog } from '@/components/projects/automations/triggers-dialog'
import { formatRelativeTime } from '@/lib/utils/format-time'
import type { JsonSchemaNode } from '@/lib/automations/types'

type SkillTriggers = {
  manual?: { entity?: string }
  scheduled?: { cron: string }
  events?: string[]
}

type SkillSummary = {
  id: string
  source: 'bundled' | 'custom'
  name: string
  description: string
  version: string | null
  triggers: SkillTriggers | null
  triggersOverridden: boolean
  declaredTriggers: SkillTriggers | null
  capabilities: { sandbox?: boolean; webSearch?: boolean } | null
  output: JsonSchemaNode | null
  enabled: boolean
  lastRun: { runId: string; status: string; ranAt: string } | null
}

export default function AutomationsPage() {
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeRun, setActiveRun] = useState<{
    runId: string
    skillId: string
    outputSchema: JsonSchemaNode | null
  } | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [historyFor, setHistoryFor] = useState<string | null>(null)
  const [detailFor, setDetailFor] = useState<string | null>(null)
  const [triggersFor, setTriggersFor] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
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
    void refresh()
  }, [refresh])

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
        setActiveRun({ runId: data.runId, skillId: skill.id, outputSchema: skill.output })
      } catch (err) {
        console.error('[automations] failed to start run', err)
        alert('Failed to start run')
      }
    },
    [projectId],
  )

  const handleToggleEnabled = useCallback(
    async (skill: SkillSummary, enabled: boolean) => {
      if (!projectId) return
      try {
        const res = await fetch(
          `/api/automations/${skill.id}/settings?projectId=${projectId}`,
          {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ enabled }),
          },
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? 'Toggle failed')
        }
        setSkills((prev) =>
          prev.map((s) => (s.id === skill.id ? { ...s, enabled } : s)),
        )
      } catch (err) {
        console.error('[automations] toggle failed', err)
        alert(err instanceof Error ? err.message : 'Toggle failed')
      }
    },
    [projectId],
  )

  const handleSaveTriggers = useCallback(
    async (skillId: string, triggers: SkillTriggers | null) => {
      if (!projectId) return
      const res = await fetch(
        `/api/automations/${skillId}/settings?projectId=${projectId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ triggers }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'Failed to save triggers')
      }
      await refresh()
    },
    [projectId, refresh],
  )

  const handleDownload = useCallback(
    async (skill: SkillSummary) => {
      if (!projectId) return
      try {
        const res = await fetch(`/api/automations/${skill.id}?projectId=${projectId}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `Download failed (${res.status})`)
        }
        const data = (await res.json()) as { content: string }
        const blob = new Blob([data.content], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${skill.id}.SKILL.md`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('[automations] download failed', err)
        alert(err instanceof Error ? err.message : 'Download failed')
      }
    },
    [projectId],
  )

  const handleDelete = useCallback(
    async (skill: SkillSummary) => {
      if (!projectId || skill.source !== 'custom') return
      if (!window.confirm(`Delete skill "${skill.name}"? This cannot be undone.`)) return
      try {
        const res = await fetch(
          `/api/automations/custom/${skill.id}?projectId=${projectId}`,
          { method: 'DELETE' },
        )
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? 'Delete failed')
        }
        await refresh()
      } catch (err) {
        console.error('[automations] delete failed', err)
        alert(err instanceof Error ? err.message : 'Delete failed')
      }
    },
    [projectId, refresh],
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

  const hasCustom = skills.some((s) => s.source === 'custom')

  return (
    <>
      <PageHeader
        title="Automations"
        actions={
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
          >
            <Upload size={14} />
            Upload custom skill
          </button>
        }
      />

      <div className="flex flex-col gap-3 px-4 py-4">
        <Text variant="muted">
          Automations are skills that run on triggers (manual, scheduled, or event-based). Bundled
          automations ship with Hissuno; you can also upload your own.
        </Text>

        {skills.length === 0 ? (
          <Card className="p-4">
            <div className="flex flex-col gap-2">
              <Text>Nothing to run yet.</Text>
              <Text variant="muted" size="sm">
                Upload a SKILL.md to add your first custom automation.
              </Text>
            </div>
          </Card>
        ) : (
          <>
            {!hasCustom && (
              <Text variant="muted" size="sm">
                Bundled skills are loaded. Upload your own SKILL.md to add custom automations.
              </Text>
            )}
            <div className="flex flex-col gap-2">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  onRun={() => handleRun(skill)}
                  onToggleEnabled={(enabled) => void handleToggleEnabled(skill, enabled)}
                  onOpenHistory={() => setHistoryFor(skill.id)}
                  onOpenDetails={() => setDetailFor(skill.id)}
                  onOpenTriggers={() => setTriggersFor(skill.id)}
                  onDownload={() => void handleDownload(skill)}
                  onDelete={() => void handleDelete(skill)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {activeRun && (
        <AutomationRunDialog
          open
          runId={activeRun.runId}
          skillId={activeRun.skillId}
          projectId={projectId}
          outputSchema={activeRun.outputSchema}
          onCloseAction={() => setActiveRun(null)}
        />
      )}

      {showUpload && (
        <CustomSkillUploadDialog
          open
          projectId={projectId}
          onCloseAction={() => setShowUpload(false)}
          onUploadedAction={() => void refresh()}
        />
      )}

      {historyFor && (
        <RunHistoryDialog
          open
          projectId={projectId}
          skillId={historyFor}
          onCloseAction={() => setHistoryFor(null)}
          onOpenRunAction={(runId) => {
            const skill = skills.find((s) => s.id === historyFor)
            setActiveRun({ runId, skillId: historyFor, outputSchema: skill?.output ?? null })
            setHistoryFor(null)
          }}
        />
      )}

      {detailFor && (
        <SkillDetailDialog
          open
          projectId={projectId}
          skillId={detailFor}
          onCloseAction={() => setDetailFor(null)}
        />
      )}

      {triggersFor && (() => {
        const skill = skills.find((s) => s.id === triggersFor)
        if (!skill) return null
        return (
          <TriggersDialog
            open
            skillId={skill.id}
            skillName={skill.name}
            declaredTriggers={skill.declaredTriggers as never}
            effectiveTriggers={skill.triggers as never}
            hasOverride={skill.triggersOverridden}
            onCloseAction={() => setTriggersFor(null)}
            onSaveAction={(triggers) => handleSaveTriggers(skill.id, triggers as never)}
          />
        )
      })()}
    </>
  )
}

function SkillCard({
  skill,
  onRun,
  onToggleEnabled,
  onOpenHistory,
  onOpenDetails,
  onOpenTriggers,
  onDownload,
  onDelete,
}: {
  skill: SkillSummary
  onRun: () => void
  onToggleEnabled: (enabled: boolean) => void
  onOpenHistory: () => void
  onOpenDetails: () => void
  onOpenTriggers: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const triggerSummary = formatTriggers(skill.triggers)
  const lastRunLabel = skill.lastRun
    ? `${skill.lastRun.status} · ${formatRelativeTime(skill.lastRun.ranAt)}`
    : 'Never run'

  const stop = (handler: () => void) => (event: MouseEvent) => {
    event.stopPropagation()
    handler()
  }

  return (
    <Card
      onClick={onOpenDetails}
      className="cursor-pointer p-3 transition hover:bg-[color:var(--surface-hover)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <Text className="font-medium">{skill.name}</Text>
            <Badge variant="default">{skill.source}</Badge>
            {skill.version && (
              <span className="text-[10px] text-[color:var(--fg-muted)]">v{skill.version}</span>
            )}
            {!skill.enabled && <Badge variant="default">disabled</Badge>}
            {skill.triggersOverridden && (
              <Badge variant="info">custom triggers</Badge>
            )}
          </div>
          <Text variant="muted" size="sm" className="line-clamp-2">
            {skill.description}
          </Text>
          <div className="flex items-center gap-3">
            {triggerSummary && (
              <Text variant="muted" size="xs">
                {triggerSummary}
              </Text>
            )}
            <Text variant="muted" size="xs">
              {lastRunLabel}
            </Text>
          </div>
        </div>
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-1 px-1 text-xs text-[color:var(--text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={skill.enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
            />
            Enabled
          </label>
          <button
            type="button"
            disabled={!skill.enabled}
            onClick={stop(onRun)}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={12} />
            <span>Run</span>
          </button>
          <button
            type="button"
            onClick={stop(onOpenTriggers)}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <Calendar size={12} />
            <span>Triggers</span>
          </button>
          <button
            type="button"
            onClick={stop(onOpenHistory)}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <History size={12} />
            <span>History</span>
          </button>
          <button
            type="button"
            onClick={stop(onOpenDetails)}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <FileText size={12} />
            <span>View</span>
          </button>
          <button
            type="button"
            onClick={stop(onDownload)}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
          >
            <Download size={12} />
            <span>Download</span>
          </button>
          {skill.source === 'custom' && (
            <button
              type="button"
              onClick={stop(onDelete)}
              className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>
          )}
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
