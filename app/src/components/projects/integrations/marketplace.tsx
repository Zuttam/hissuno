'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui'
import { IntegrationIcon } from './integration-icon'
import { INTEGRATION_TYPES } from './integration-registry'

interface MarketplaceProps {
  connectedTypes: Set<string>
  onSelect: (integrationId: string) => void
}

export function Marketplace({ connectedTypes, onSelect }: MarketplaceProps) {
  const [search, setSearch] = useState('')

  const available = useMemo(() => INTEGRATION_TYPES.filter((t) => !t.comingSoon), [])
  const comingSoon = useMemo(() => INTEGRATION_TYPES.filter((t) => t.comingSoon), [])

  const filteredAvailable = useMemo(() => {
    if (!search.trim()) return available
    const q = search.toLowerCase()
    return available.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    )
  }, [search, available])

  const filteredComingSoon = useMemo(() => {
    if (!search.trim()) return comingSoon
    const q = search.toLowerCase()
    return comingSoon.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    )
  }, [search, comingSoon])

  return (
    <div className="space-y-6">
      {/* Available integrations */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-tertiary)]">
            All Integrations
          </h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-48 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredAvailable.map((integration) => {
            const isConnected = connectedTypes.has(integration.id)

            return (
              <button
                key={integration.id}
                type="button"
                onClick={() => onSelect(integration.id)}
                className="flex items-start gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-3 text-left transition cursor-pointer hover:bg-[color:var(--surface-hover)]"
              >
                <IntegrationIcon type={integration.id} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">
                      {integration.name}
                    </span>
                    {isConnected && (
                      <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--accent-success)]" title="Connected" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[color:var(--text-tertiary)]">
                    {integration.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {filteredAvailable.length === 0 && !search.trim() && (
          <p className="py-8 text-center text-sm text-[color:var(--text-tertiary)]">
            No integrations available.
          </p>
        )}

        {filteredAvailable.length === 0 && search.trim() && filteredComingSoon.length === 0 && (
          <p className="py-8 text-center text-sm text-[color:var(--text-tertiary)]">
            No integrations found.
          </p>
        )}
      </div>

      {/* Coming soon */}
      {filteredComingSoon.length > 0 && (
        <div>
          <h3 className="mb-3 font-mono text-xs uppercase tracking-wide text-[color:var(--text-tertiary)]">
            Coming Soon
          </h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredComingSoon.map((integration) => (
              <div
                key={integration.id}
                className="flex items-start gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-3 opacity-60"
              >
                <IntegrationIcon type={integration.id} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--foreground)]">
                      {integration.name}
                    </span>
                    <Badge variant="default">Coming Soon</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[color:var(--text-tertiary)]">
                    {integration.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing integration link */}
      <p className="text-center text-xs text-[color:var(--text-tertiary)]">
        Don&apos;t see what you need?{' '}
        <a
          href="https://github.com/zuttam/hissuno/issues/new?labels=integration-request&title=Integration+request:+"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[color:var(--foreground)] underline transition-colors"
        >
          Request an integration
        </a>
      </p>
    </div>
  )
}
