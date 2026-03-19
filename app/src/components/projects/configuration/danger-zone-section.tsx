'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog } from '@/components/ui/dialog'
import { Button, Heading } from '@/components/ui'
import { deleteProject } from '@/lib/api/projects'

interface DangerZoneSectionProps {
  projectId: string
  projectName: string
  isOwner: boolean
}

export function DangerZoneSection({ projectId, projectName, isOwner }: DangerZoneSectionProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOwner) return null

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      await deleteProject(projectId)
      router.push('/projects')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project')
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="border-t border-[color:var(--accent-danger)] pt-6">
        <Heading as="h3" size="subsection">Danger Zone</Heading>
        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
          Permanently delete this project and all its data. This action cannot be undone.
        </p>
        <Button
          variant="danger"
          size="md"
          className="mt-4"
          onClick={() => setShowDialog(true)}
        >
          Delete Project
        </Button>
      </div>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} title="Delete Project">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[color:var(--text-secondary)]">
            This will permanently delete <strong>{projectName}</strong> and all its data including
            sessions, issues, integrations, and knowledge. This action cannot be undone.
          </p>
          <div>
            <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1">
              Type <strong>{projectName}</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
              className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none"
            />
          </div>
          {error && (
            <div className="rounded-[4px] border border-[color:var(--accent-danger)] p-3 text-sm text-[color:var(--accent-danger)]">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setShowDialog(false)
                setConfirmName('')
                setError(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              disabled={confirmName !== projectName || isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
