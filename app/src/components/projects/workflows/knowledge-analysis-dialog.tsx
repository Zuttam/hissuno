'use client'

import { useMemo } from 'react'
import { WorkflowEditorDialog, type WorkflowStepConfig } from './workflow-editor-dialog'
import { updateKnowledgeAnalysisSettings } from '@/lib/api/settings'

const STEPS: WorkflowStepConfig[] = [
  {
    id: 'fetch-content',
    name: 'Fetch Content',
    description: 'Fetches content from the knowledge source',
  },
  {
    id: 'sanitize-content',
    name: 'Analyze Content',
    description: 'Scans for sensitive information and sanitizes',
  },
  {
    id: 'save-and-embed',
    name: 'Save & Embed',
    description: 'Stores content and generates vector embeddings',
  },
  {
    id: 'trigger-graph-eval',
    name: 'Find Relationships',
    description: 'Triggers async discovery of related customers, sessions, issues, and product scopes',
    guidelineKey: 'knowledge_relationship_guidelines',
    placeholder: 'Guide relationship discovery (e.g., prioritize recent sessions, focus on specific product areas)...',
    rows: 8,
  },
]

interface KnowledgeAnalysisDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  relationshipGuidelines: string
  onSaved: () => void
}

export function KnowledgeAnalysisDialog({
  open,
  onClose,
  projectId,
  relationshipGuidelines,
  onSaved,
}: KnowledgeAnalysisDialogProps) {
  const initialValues = useMemo(
    () => ({ knowledge_relationship_guidelines: relationshipGuidelines }),
    [relationshipGuidelines]
  )

  return (
    <WorkflowEditorDialog
      open={open}
      onClose={onClose}
      title="Knowledge Analysis"
      subtitle="Analyzes sources and finds relationships to existing entities"
      projectId={projectId}
      steps={STEPS}
      initialValues={initialValues}
      onSaved={onSaved}
      saveFn={updateKnowledgeAnalysisSettings}
    />
  )
}
