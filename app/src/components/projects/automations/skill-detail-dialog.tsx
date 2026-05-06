'use client'

import { useEffect, useState } from 'react'
import { Badge, Dialog, MarkdownContent, Spinner, Text } from '@/components/ui'

interface Frontmatter {
  name?: string
  description?: string
  version?: string | null
  triggers?: {
    manual?: { entity?: string }
    scheduled?: { cron: string }
    events?: string[]
  } | null
}

interface SkillDetailResponse {
  skillId: string
  source: 'bundled' | 'custom'
  frontmatter: Frontmatter
  content: string
}

interface Props {
  open: boolean
  projectId: string
  skillId: string
  onCloseAction: () => void
}

export function SkillDetailDialog({ open, projectId, skillId, onCloseAction }: Props) {
  const [data, setData] = useState<SkillDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/automations/${skillId}?projectId=${projectId}`)
        if (!res.ok) throw new Error(`Failed to load skill (${res.status})`)
        const body = (await res.json()) as SkillDetailResponse
        if (cancelled) return
        setData(body)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load skill')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, projectId, skillId])

  return (
    <Dialog open={open} onClose={onCloseAction} title={data?.frontmatter?.name ?? skillId} size="lg">
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      ) : error ? (
        <Text variant="muted">{error}</Text>
      ) : data ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{data.source}</Badge>
            {data.frontmatter.version && (
              <span className="text-[10px] text-[color:var(--text-tertiary)]">
                v{data.frontmatter.version}
              </span>
            )}
          </div>
          {data.frontmatter.description && (
            <Text variant="muted" size="sm">
              {data.frontmatter.description}
            </Text>
          )}
          <div className="max-h-[60vh] overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)] p-3">
            <MarkdownContent content={data.content} />
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
