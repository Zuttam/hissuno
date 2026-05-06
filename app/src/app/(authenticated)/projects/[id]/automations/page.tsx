'use client'

import { useCallback, useEffect, useState } from 'react'
import { useProject } from '@/components/providers/project-provider'
import { Button, Card, PageHeader, Spinner, Text } from '@/components/ui'
import { AutomationRunDialog } from '@/components/projects/automations/run-dialog'

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
  capabilities: { sandbox?: boolean; webSearch?: boolean } | null
}

export default function AutomationsPage() {
  const { project, projectId, isLoading: isLoadingProject } = useProject()
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeRun, setActiveRun] = useState<{ runId: string; skillId: string } | null>(null)

  useEffect(() => {
    if (!projectId) return
    void (async () => {
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
    })()
  }, [projectId])

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
          Skill-based automations that run on top of your project's data. Pick one and click Run.
        </Text>

        {skills.length === 0 ? (
          <Card className="p-4">
            <Text>No automations available yet.</Text>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {skills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onRun={() => handleRun(skill)} />
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
          onClose={() => setActiveRun(null)}
        />
      )}
    </>
  )
}

function SkillCard({
  skill,
  onRun,
}: {
  skill: SkillSummary
  onRun: () => void
}) {
  const triggerSummary = formatTriggers(skill.triggers)
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2">
            <Text className="font-medium">{skill.name}</Text>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--bg-muted)] text-[color:var(--fg-muted)]">
              {skill.source}
            </span>
            {skill.version && (
              <span className="text-[10px] text-[color:var(--fg-muted)]">v{skill.version}</span>
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
        <Button onClick={onRun} variant="primary" size="sm">
          Run now
        </Button>
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
