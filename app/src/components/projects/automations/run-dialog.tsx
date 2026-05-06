'use client'

import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, Text } from '@/components/ui'

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
  onClose: () => void
}

export function AutomationRunDialog({ open, runId, skillId, projectId, onClose }: Props) {
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
    <Dialog open={open} onClose={onClose} title={`Run · ${skillId}`} size="lg">
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
            <pre className="bg-[color:var(--bg-muted)] rounded p-2 text-xs overflow-x-auto max-h-[30vh]">
              {JSON.stringify(output, null, 2)}
            </pre>
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
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
