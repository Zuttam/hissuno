'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { IntegrationIcon } from './integration-icon'
import { getAvailableIntegrations } from './integration-registry'

interface ConnectDropdownProps {
  onSelect: (integrationId: string) => void
}

export function ConnectDropdown({ onSelect }: ConnectDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const availableIntegrations = getAvailableIntegrations()

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-[4px] border border-[color:var(--border-subtle)] px-2.5 py-1.5 text-xs font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
      >
        <Plus size={14} />
        Connect Integration
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[280px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-1 shadow-lg">
          <div className="flex flex-col gap-0.5">
            {availableIntegrations.map((integration) => (
              <button
                key={integration.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onSelect(integration.id)
                }}
                className="flex w-full items-center gap-2 rounded-[2px] px-2 py-1.5 text-left text-xs text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-hover)]"
              >
                <IntegrationIcon type={integration.id} size={16} />
                <span>{integration.setupLabel ? `${integration.setupLabel} ${integration.name}` : integration.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
