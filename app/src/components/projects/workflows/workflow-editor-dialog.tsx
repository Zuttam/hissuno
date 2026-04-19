'use client'

import { Dialog } from '@/components/ui'
import {
  WorkflowEditorBody,
  type WorkflowEditorBodyProps,
  type WorkflowStepConfig,
} from './workflow-editor-body'

export type { WorkflowStepConfig }

interface WorkflowEditorDialogProps
  extends Omit<WorkflowEditorBodyProps, 'onCancel' | 'cancelLabel' | 'saveLabel'> {
  open: boolean
  onClose: () => void
  title: string
}

export function WorkflowEditorDialog({
  open,
  onClose,
  title,
  ...bodyProps
}: WorkflowEditorDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="xl">
      {open && (
        <WorkflowEditorBody
          {...bodyProps}
          onCancel={onClose}
          onSaved={() => {
            bodyProps.onSaved()
            onClose()
          }}
        />
      )}
    </Dialog>
  )
}
