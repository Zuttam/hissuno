'use client'

import { useState, useCallback, useEffect, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ProjectInfoSection } from '@/components/projects/edit-dialogs/project-details-dialog'
import { LimitReachedDialog } from '@/components/billing/limit-reached-dialog'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'

interface LimitError {
  current: number
  limit: number
  upgradeUrl: string
}

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
  onProjectCreated?: (project: { id: string; name: string }) => void
}

export function CreateProjectDialog({
  open,
  onClose,
  onProjectCreated,
}: CreateProjectDialogProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState<LimitError | null>(null)
  const [billingRequired, setBillingRequired] = useState(false)
  const [isCheckingBilling, setIsCheckingBilling] = useState(true)

  // Reset form and check billing status when dialog opens
  useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setError(null)
      setLimitError(null)
      setBillingRequired(false)
      setIsCheckingBilling(true)

      void fetch('/api/user/profile')
        .then((res) => res.json())
        .then((data) => {
          if (data.profile?.billing_skipped) {
            setBillingRequired(true)
          }
        })
        .catch(() => {
          // Ignore - proceed with normal flow
        })
        .finally(() => {
          setIsCheckingBilling(false)
        })
    }
  }, [open])

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
  }, [])

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value)
  }, [])

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Project name is required')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', trimmedName)
      if (description.trim()) {
        formData.append('description', description.trim())
      }
      formData.append('codebaseSource', 'none')
      formData.append('skipAnalysis', 'true')

      const response = await fetch('/api/projects', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()

        // Handle limit exceeded
        if (response.status === 429 && data.code === 'LIMIT_EXCEEDED') {
          setLimitError({
            current: data.details?.current ?? 0,
            limit: data.details?.limit ?? 0,
            upgradeUrl: data.details?.upgradeUrl ?? '/account/billing',
          })
          return
        }

        throw new Error(data.error ?? 'Failed to create project')
      }

      const { project } = await response.json()
      onProjectCreated?.(project)
      onClose()
      router.push(`/projects/${project.id}/dashboard`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCloseLimitDialog = () => {
    setLimitError(null)
    onClose()
  }

  // Show limit dialog if limit exceeded
  if (limitError) {
    return (
      <LimitReachedDialog
        open={true}
        onClose={handleCloseLimitDialog}
        current={limitError.current}
        limit={limitError.limit}
        upgradeUrl={limitError.upgradeUrl}
        dimension="analyzed_sessions"
      />
    )
  }

  // Show billing required message
  if (billingRequired && !isCheckingBilling) {
    return (
      <Dialog open={open} onClose={onClose} title="Set Up Billing" size="xxl">
        <div className="flex flex-col items-center gap-5 py-4 text-center">
          {/* Billing illustration */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[color:var(--surface-hover)]">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="12" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="2" className="text-[color:var(--text-secondary)]" />
              <path d="M4 20H44" stroke="currentColor" strokeWidth="2" className="text-[color:var(--text-secondary)]" />
              <rect x="8" y="28" width="12" height="4" rx="1" fill="currentColor" className="text-[color:var(--border)]" />
              <rect x="8" y="34" width="8" height="2" rx="1" fill="currentColor" className="text-[color:var(--border)]" />
              <circle cx="37" cy="32" r="3" stroke="currentColor" strokeWidth="1.5" className="text-[color:var(--accent-primary)]" />
              <circle cx="33" cy="32" r="3" stroke="currentColor" strokeWidth="1.5" className="text-[color:var(--accent-primary)]" />
            </svg>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">
              Billing plan required
            </p>
            <p className="max-w-xs text-sm text-[color:var(--text-secondary)]">
              To create your own projects, you need to set up a billing plan first. You can still access projects you&apos;ve been invited to.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose()
                router.push('/account/billing')
              }}
            >
              Choose a Plan
            </Button>
          </div>
        </div>
      </Dialog>
    )
  }

  if (isCheckingBilling) {
    return (
      <Dialog open={open} onClose={onClose} title="Create Project" size="xxl">
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create Project" size="xxl">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}

        <ProjectInfoSection
          name={name}
          description={description}
          onNameChange={handleNameChange}
          onDescriptionChange={handleDescriptionChange}
        />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} loading={isCreating} disabled={isCreating}>
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
