'use client'

import { useMemo } from 'react'
import { WorkflowEditorDialog, type WorkflowStepConfig } from './workflow-editor-dialog'
import { updateFeedbackReviewSettings } from '@/lib/api/settings'

const STEPS: WorkflowStepConfig[] = [
  {
    id: 'classify',
    name: 'Classify Feedback',
    description: 'Applies tags, assigns product scope, and categorizes into bug reports, feature requests, etc.',
    guidelineKey: 'classification_guidelines',
    placeholder: 'Guide how feedback is categorized (e.g., distinguish between bug reports, feature requests, and change requests)...',
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Generates a concise title and description based on the conversation',
  },
  {
    id: 'pm-decision',
    name: 'Create or Upvote Issue',
    description: 'Decides whether to create a new issue, upvote an existing one, or skip',
    guidelineKey: 'analysis_guidelines',
    placeholder: 'Guide what factors to consider when creating issues...',
    toggleKey: 'issue_tracking_enabled',
  },
]

interface FeedbackReviewDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  classificationGuidelines: string
  analysisGuidelines: string
  issueTrackingEnabled: boolean
  onSaved: () => void
}

export function FeedbackReviewDialog({
  open,
  onClose,
  projectId,
  classificationGuidelines,
  analysisGuidelines,
  issueTrackingEnabled,
  onSaved,
}: FeedbackReviewDialogProps) {
  const initialValues = useMemo(
    () => ({
      classification_guidelines: classificationGuidelines,
      analysis_guidelines: analysisGuidelines,
      issue_tracking_enabled: issueTrackingEnabled,
    }),
    [classificationGuidelines, analysisGuidelines, issueTrackingEnabled]
  )

  return (
    <WorkflowEditorDialog
      open={open}
      onClose={onClose}
      title="Feedback Review"
      subtitle="Classifies feedback and creates issues"
      projectId={projectId}
      steps={STEPS}
      initialValues={initialValues}
      onSaved={onSaved}
      saveFn={updateFeedbackReviewSettings}
    />
  )
}
