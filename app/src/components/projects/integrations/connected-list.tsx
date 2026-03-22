'use client'

import { Badge } from '@/components/ui'
import { IntegrationIcon } from './integration-icon'
import { formatRelativeTime } from '@/lib/utils/format-time'

export type IntegrationStatus = 'active' | 'idle' | 'not_connected'

export interface ConnectionInfo {
  id: string
  type: string
  name: string
  detail: string
  status: IntegrationStatus
  lastSyncAt: string | null
}

interface ConnectedListProps {
  connections: ConnectionInfo[]
  onSelect: (integrationId: string) => void
}

export function ConnectedList({ connections, onSelect }: ConnectedListProps) {
  return (
    <div>
      <h3 className="mb-1 font-mono text-xs uppercase tracking-wide text-[color:var(--text-tertiary)]">
        Connected
      </h3>
      {connections.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[color:var(--text-tertiary)]">
          No integrations connected yet. Use the dropdown above to connect your first integration.
        </p>
      ) : (
        <div className="flex flex-col">
          {connections.map((conn) => (
            <button
              key={conn.id}
              type="button"
              onClick={() => onSelect(conn.type)}
              className="flex items-center gap-3 rounded-[4px] px-3 py-2 text-left transition hover:bg-[color:var(--surface-hover)]"
            >
              <IntegrationIcon type={conn.type} size={20} />
              <span className="text-xs font-medium text-[color:var(--foreground)]">
                {conn.name}
              </span>
              {conn.detail && (
                <span className="text-xs text-[color:var(--text-tertiary)]">
                  {conn.detail}
                </span>
              )}
              <span className="ml-auto flex items-center gap-3">
                <Badge variant={conn.status === 'active' ? 'success' : conn.status === 'idle' ? 'warning' : 'default'}>
                  {conn.status === 'active' ? 'Active' : conn.status === 'idle' ? 'Idle' : 'Not Connected'}
                </Badge>
                {conn.lastSyncAt && (
                  <span className="text-xs text-[color:var(--text-tertiary)]">
                    {formatRelativeTime(conn.lastSyncAt)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
