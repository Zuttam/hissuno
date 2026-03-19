'use client'

import { useMemo } from 'react'
import { WorkflowEditorDialog, type WorkflowStepConfig } from './workflow-editor-dialog'
import { updateIssueAnalysisSettings } from '@/lib/api/settings'

const STEPS: WorkflowStepConfig[] = [
  {
    id: 'analyze',
    name: 'Analyze Impact & Effort',
    description: 'Assesses technical impact and implementation effort',
    guidelineKey: 'analysis_guidelines',
    placeholder: 'Guide how to assess impact and effort...',
    rows: 8,
  },
  {
    id: 'compute',
    name: 'Compute Scores',
    description: 'Calculates reach, impact, confidence, effort (RICE) scores',
  },
  {
    id: 'brief',
    name: 'Generate Brief',
    description: 'Creates a product brief with context and recommendations',
    guidelineKey: 'brief_guidelines',
    placeholder: 'Guide the brief format and level of detail...',
    rows: 8,
  },
]

interface IssueAnalysisDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  analysisGuidelines: string
  briefGuidelines: string
  onSaved: () => void
}

export function IssueAnalysisDialog({
  open,
  onClose,
  projectId,
  analysisGuidelines,
  briefGuidelines,
  onSaved,
}: IssueAnalysisDialogProps) {
  const initialValues = useMemo(
    () => ({ analysis_guidelines: analysisGuidelines, brief_guidelines: briefGuidelines }),
    [analysisGuidelines, briefGuidelines]
  )

  return (
    <WorkflowEditorDialog
      open={open}
      onClose={onClose}
      title="Issue Analysis"
      subtitle="Scores reach, impact, confidence, effort and generates a brief"
      projectId={projectId}
      steps={STEPS}
      initialValues={initialValues}
      onSaved={onSaved}
      saveFn={updateIssueAnalysisSettings}
    />
  )
}
