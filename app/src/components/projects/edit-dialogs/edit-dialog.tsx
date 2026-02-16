'use client'

import { ReactNode } from 'react'
import { Dialog, Button, type DialogSize } from '@/components/ui'

export interface EditDialogProps {
  open: boolean
  onClose: () => void
  onSave: () => void | Promise<void>
  title: string
  children: ReactNode
  isSaving?: boolean
  saveLabel?: string
  cancelLabel?: string
  size?: DialogSize
  error?: string | null
}

export function EditDialog({
  open,
  onClose,
  onSave,
  title,
  children,
  isSaving = false,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  size = 'xxl',
  error,
}: EditDialogProps) {
  const handleSave = async () => {
    await onSave()
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size={size}>
      <div className="flex flex-col gap-6">
        {/* Error display */}
        {error && (
          <div className="rounded-[4px] border-2 border-[color:var(--accent-danger)] bg-transparent p-3 font-mono text-sm text-[color:var(--accent-danger)]">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {children}
        </div>

        {/* Footer with Save/Cancel */}
        <div className="flex items-center justify-end gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSaving}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={isSaving}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
