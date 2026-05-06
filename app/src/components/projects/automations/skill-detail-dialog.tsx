'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge, Dialog, MarkdownContent, Spinner, Text } from '@/components/ui'
import { summarizeOutputSchema } from '@/lib/automations/output-schema'
import type { JsonSchemaNode } from '@/lib/automations/types'

interface Frontmatter {
  name?: string
  description?: string
  version?: string | null
  triggers?: {
    manual?: { entity?: string }
    scheduled?: { cron: string }
    events?: string[]
  } | null
  output?: JsonSchemaNode | null
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

  const outputFields = useMemo(
    () => (data?.frontmatter.output ? summarizeOutputSchema(data.frontmatter.output) : null),
    [data?.frontmatter.output],
  )

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
          {outputFields && outputFields.length > 0 && (
            <div className="flex flex-col gap-1">
              <Text variant="muted" size="sm">Output schema</Text>
              <div className="rounded-[4px] border border-[color:var(--border-subtle)] overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[color:var(--bg-muted)] text-left text-[color:var(--text-tertiary)]">
                      <th className="px-2 py-1 font-medium">Field</th>
                      <th className="px-2 py-1 font-medium">Type</th>
                      <th className="px-2 py-1 font-medium">Required</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputFields.map((f) => (
                      <tr key={f.path} className="border-t border-[color:var(--border-subtle)]">
                        <td className="px-2 py-1 font-mono">{f.path}</td>
                        <td className="px-2 py-1 font-mono text-[color:var(--text-tertiary)]">{f.type}</td>
                        <td className="px-2 py-1">{f.required ? 'yes' : 'no'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="max-h-[60vh] overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)] p-3">
            <MarkdownContent content={data.content} />
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
