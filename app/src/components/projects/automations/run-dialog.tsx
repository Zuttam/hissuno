'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dialog, Text } from '@/components/ui'
import { summarizeOutputSchema } from '@/lib/automations/output-schema'
import type { JsonSchemaNode } from '@/lib/automations/types'

type StreamEvent = {
  type: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}

type Props = {
  open: boolean
  runId: string
  skillId: string
  projectId: string
  /** When set, the output panel renders the produced fields against this schema. */
  outputSchema?: JsonSchemaNode | null
  onCloseAction: () => void
}

export function AutomationRunDialog({
  open,
  runId,
  skillId,
  projectId,
  outputSchema,
  onCloseAction,
}: Props) {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [status, setStatus] = useState<string>('queued')
  const [output, setOutput] = useState<Record<string, unknown> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!open) return
    const url = `/api/automations/runs/${runId}/stream?projectId=${projectId}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('message', (ev) => {
      try {
        const event = JSON.parse(ev.data) as StreamEvent
        setEvents((prev) => [...prev, event])
        if (event.type === 'snapshot' || event.type === 'final') {
          const next = (event.data?.status as string | undefined) ?? status
          setStatus(next)
        }
        if (event.type === 'output' && event.data) {
          setOutput(event.data as Record<string, unknown>)
        }
        if (event.type === 'error') {
          setErrorMessage(event.message ?? 'Run failed')
        }
      } catch (err) {
        console.error('[run-dialog] parse error', err)
      }
    })

    es.addEventListener('error', () => {
      // EventSource closes on terminal status; the server emits a `final` event
      // first, so we don't need to mirror its closure here.
      es.close()
    })

    return () => {
      es.close()
      eventSourceRef.current = null
    }
  }, [open, runId, projectId, status])

  return (
    <Dialog open={open} onClose={onCloseAction} title={`Run · ${skillId}`} size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Text variant="muted" size="sm">Status:</Text>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[color:var(--bg-muted)]">{status}</span>
        </div>

        <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto bg-[color:var(--bg-muted)] rounded p-2 font-mono text-xs">
          {events.length === 0 ? (
            <Text variant="muted">Waiting for events…</Text>
          ) : (
            events.map((event, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[color:var(--fg-muted)] shrink-0">
                  {event.timestamp.slice(11, 19)}
                </span>
                <span className="text-[color:var(--fg-muted)] shrink-0">[{event.type}]</span>
                <span className="break-all">{event.message ?? ''}</span>
              </div>
            ))
          )}
        </div>

        {output && (
          <div className="flex flex-col gap-1">
            <Text variant="muted" size="sm">Output</Text>
            {outputSchema ? (
              <StructuredOutputView output={output} schema={outputSchema} />
            ) : (
              <pre className="bg-[color:var(--bg-muted)] rounded p-2 text-xs overflow-x-auto max-h-[30vh]">
                {JSON.stringify(output, null, 2)}
              </pre>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="flex flex-col gap-1">
            <Text variant="muted" size="sm">Error</Text>
            <pre className="bg-[color:var(--bg-muted)] rounded p-2 text-xs overflow-x-auto text-[color:var(--fg-error)]">
              {errorMessage}
            </pre>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onCloseAction}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function StructuredOutputView({
  output,
  schema,
}: {
  output: Record<string, unknown>
  schema: JsonSchemaNode
}) {
  const fields = useMemo(() => summarizeOutputSchema(schema), [schema])
  return (
    <div className="rounded-[4px] border border-[color:var(--border-subtle)] overflow-hidden max-h-[40vh] overflow-y-auto">
      <table className="w-full text-xs">
        <tbody>
          {fields.map((f) => {
            const value = lookupPath(output, f.path)
            return (
              <tr key={f.path} className="border-t border-[color:var(--border-subtle)] first:border-t-0 align-top">
                <td className="px-2 py-1 font-mono text-[color:var(--text-secondary)] whitespace-nowrap">
                  {f.path}
                </td>
                <td className="px-2 py-1">
                  <ValueCell value={value} type={f.type} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ValueCell({ value, type }: { value: unknown; type: string }) {
  if (value === undefined) {
    return <span className="text-[color:var(--text-tertiary)] italic">missing</span>
  }
  if (type === 'object' || type.endsWith('[]')) {
    return (
      <pre className="bg-[color:var(--bg-muted)] rounded p-1 text-[10px] overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  }
  if (typeof value === 'string' && value.length > 200) {
    return (
      <pre className="bg-[color:var(--bg-muted)] rounded p-1 text-[10px] whitespace-pre-wrap">
        {value}
      </pre>
    )
  }
  return <span className="font-mono">{String(value)}</span>
}

function lookupPath(root: Record<string, unknown>, path: string): unknown {
  let current: unknown = root
  for (const segment of path.split('.')) {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[segment]
    } else {
      return undefined
    }
  }
  return current
}
