'use client'

import { useState, useCallback } from 'react'
import { Dialog, Button } from '@/components/ui'
import { SessionPicker } from '@/components/sessions/session-picker'

interface AddFeedbackDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  excludeSessionIds: string[]
  onAddSessions: (sessionIds: string[]) => Promise<void>
}

export function AddFeedbackDialog({
  open,
  onClose,
  projectId,
  excludeSessionIds,
  onAddSessions,
}: AddFeedbackDialogProps) {
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleToggleSession = useCallback((sessionId: string) => {
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]
    )
  }, [])

  const handleSubmit = useCallback(async () => {
    if (selectedSessionIds.length === 0) return

    setIsSubmitting(true)
    try {
      await onAddSessions(selectedSessionIds)
      setSelectedSessionIds([])
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedSessionIds, onAddSessions, onClose])

  const handleClose = useCallback(() => {
    setSelectedSessionIds([])
    onClose()
  }, [onClose])

  return (
    <Dialog open={open} onClose={handleClose} title="Add Linked Feedback" size="lg">
      <div className="flex flex-col gap-4">
        <SessionPicker
          projectId={projectId}
          selectedSessionIds={selectedSessionIds}
          onToggleSession={handleToggleSession}
          excludeSessionIds={excludeSessionIds}
        />

        {selectedSessionIds.length > 0 && (
          <p className="text-xs text-[color:var(--accent-success)]">
            {selectedSessionIds.length} feedback{selectedSessionIds.length !== 1 ? ' items' : ''} selected
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={selectedSessionIds.length === 0}
          >
            Add
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
