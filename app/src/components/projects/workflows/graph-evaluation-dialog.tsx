'use client'

import { useMemo } from 'react'
import { WorkflowEditorDialog, type WorkflowStepConfig } from './workflow-editor-dialog'
import { updateGraphEvaluationSettingsClient } from '@/lib/api/settings'

const STEPS: WorkflowStepConfig[] = [
  {
    id: 'load',
    name: 'Load Entity Content',
    description: 'Loads text content from the entity for analysis',
  },
  {
    id: 'extract',
    name: 'Extract Topics',
    description: 'Extracts key topics from entity content',
  },
  {
    id: 'discover',
    name: 'Discover Relationships',
    description: 'Finds connections with existing entities using semantic and text matching',
  },
  {
    id: 'create',
    name: 'Create New Resources',
    description: 'Creates new contacts and issues from session feedback',
    toggleKey: 'creation_policy_enabled',
  },
]

interface GraphEvaluationDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  creationPolicyEnabled: boolean
  onSaved: () => void
}

export function GraphEvaluationDialog({
  open,
  onClose,
  projectId,
  creationPolicyEnabled,
  onSaved,
}: GraphEvaluationDialogProps) {
  const initialValues = useMemo(
    () => ({
      creation_policy_enabled: creationPolicyEnabled,
    }),
    [creationPolicyEnabled]
  )

  return (
    <WorkflowEditorDialog
      open={open}
      onClose={onClose}
      title="Graph Evaluation"
      subtitle="Discovers relationships between entities and optionally creates new ones"
      projectId={projectId}
      steps={STEPS}
      initialValues={initialValues}
      onSaved={onSaved}
      saveFn={updateGraphEvaluationSettingsClient}
    />
  )
}
