/**
 * In-memory pubsub for real-time progress streaming.
 *
 * Source of truth for run state is `automation_runs` in Postgres — events are
 * appended there durably. This bus is a fast-path so SSE clients don't have
 * to poll while the run happens on the same node. SSE handlers fall back to
 * polling progress_events from the DB if no in-memory subscriber is present
 * (e.g. cross-replica reconnect).
 */

import type { ProgressEvent } from '@/lib/db/queries/automation-runs'

type Listener = (event: ProgressEvent) => void

const subscribers = new Map<string, Set<Listener>>()

export function subscribeRunEvents(runId: string, listener: Listener): () => void {
  let set = subscribers.get(runId)
  if (!set) {
    set = new Set()
    subscribers.set(runId, set)
  }
  set.add(listener)
  return () => {
    set?.delete(listener)
    if (set && set.size === 0) subscribers.delete(runId)
  }
}

export function publishRunEvent(runId: string, event: ProgressEvent): void {
  const set = subscribers.get(runId)
  if (!set) return
  for (const listener of set) {
    try {
      listener(event)
    } catch (err) {
      console.error('[run-bus] subscriber threw', err)
    }
  }
}

/** Used by the dispatcher to signal the run is finished and the channel can close. */
export function closeRunChannel(runId: string): void {
  subscribers.delete(runId)
}
