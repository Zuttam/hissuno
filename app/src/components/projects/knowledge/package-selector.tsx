'use client'

import { useState, useEffect, useCallback } from 'react'
import { Select, Spinner } from '@/components/ui'
import type { NamedPackageWithSources } from '@/lib/knowledge/types'

interface PackageSelectorProps {
  projectId: string
  value: string | null
  onChange: (packageId: string | null) => void
  disabled?: boolean
  className?: string
}

export function PackageSelector({
  projectId,
  value,
  onChange,
  disabled,
  className,
}: PackageSelectorProps) {
  const [packages, setPackages] = useState<NamedPackageWithSources[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPackages = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/packages`)
      if (!response.ok) {
        throw new Error('Failed to load packages')
      }
      const data = await response.json()
      setPackages(data.packages ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchPackages()
  }, [fetchPackages])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-sm text-[color:var(--text-secondary)]">Loading packages...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-sm text-[color:var(--accent-danger)]">
        Failed to load packages
      </div>
    )
  }

  if (packages.length === 0) {
    return (
      <div className="text-sm text-[color:var(--text-secondary)]">
        No packages available
      </div>
    )
  }

  return (
    <Select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={className}
    >
      <option value="">Select a package...</option>
      {packages.map((pkg) => (
        <option key={pkg.id} value={pkg.id}>
          {pkg.name} ({pkg.sourceCount} sources)
        </option>
      ))}
    </Select>
  )
}
