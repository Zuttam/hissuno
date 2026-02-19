'use client'

import { ReactNode } from 'react'
import { Dialog, Button, Alert, type DialogSize } from '@/components/ui'

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
  saved?: boolean
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
  saved = false,
}: EditDialogProps) {
  const handleSave = async () => {
    await onSave()
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size={size}>
      <div className="flex flex-col gap-6">
        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {children}
        </div>

        {/* Footer with alerts and Save/Cancel */}
        <div className="flex items-center gap-3 border-t border-[color:var(--border-subtle)] pt-4">
          {error && (
            <Alert variant="danger" className="border-0 py-2 px-3 text-xs">❌ {error}</Alert>
          )}
          {saved && (
            <Alert variant="success" className="border-0 py-2 px-3 text-xs">✅ Saved</Alert>
          )}
          <div className="flex-1" />
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
