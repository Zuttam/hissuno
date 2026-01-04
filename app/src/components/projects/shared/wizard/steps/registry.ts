import { ProjectDetailsStep } from './project-details-step'
import { KnowledgeStep } from './knowledge-step'
import { SessionsStep } from './sessions-step'
import { IssuesStep } from './issues-step'
import type { ProjectStepId, ProjectWizardMode, ProjectWizardFormData, StepDefinition } from './types'

/**
 * Step registry containing project wizard steps
 */
export const PROJECT_STEP_REGISTRY: Record<ProjectStepId, StepDefinition> = {
  'project-details': {
    id: 'project-details',
    title: 'What are you building?',
    shortTitle: 'Details',
    description: 'Give your project a name so we can identify it.',
    component: ProjectDetailsStep,
    validate: (data: ProjectWizardFormData) => {
      if (!data.name?.trim()) {
        return { isValid: false, error: 'Project name is required' }
      }
      return { isValid: true }
    },
  },

  knowledge: {
    id: 'knowledge',
    title: 'What should your agents know?',
    shortTitle: 'Knowledge',
    description: 'Add knowledge sources so your support agent can answer questions accurately.',
    component: KnowledgeStep,
    validate: () => ({ isValid: true }),
    isOptional: true,
    integrationTrigger: 'github',
  },

  sessions: {
    id: 'sessions',
    title: 'How do you talk with your customers?',
    shortTitle: 'Sessions',
    description:
      'Configure which channels you want to use to connect your customers to Hissuno. You can set Hissuno native agents to join channels and answer questions and gather feedback automatically for you.',
    component: SessionsStep,
    validate: () => ({ isValid: true }),
    isOptional: true,
    integrationTrigger: 'slack',
  },

  issues: {
    id: 'issues',
    title: 'How should we handle customer issues?',
    shortTitle: 'Issues',
    description: 'Configure how issues are detected and tracked from your customer conversations.',
    component: IssuesStep,
    validate: () => ({ isValid: true }),
    isOptional: true,
  },
}

/**
 * Default step ordering for project flows
 */
export const FLOW_STEP_ORDER: Record<ProjectWizardMode, ProjectStepId[]> = {
  create: ['project-details', 'knowledge', 'sessions', 'issues'],
  edit: ['project-details', 'knowledge', 'sessions', 'issues'],
}

/**
 * Get step definitions for a flow
 */
export function getStepsForFlow(
  flow: ProjectWizardMode,
  customOrder?: ProjectStepId[]
): StepDefinition[] {
  const stepIds = customOrder ?? FLOW_STEP_ORDER[flow]
  return stepIds.map((id) => PROJECT_STEP_REGISTRY[id])
}

/**
 * Get step index by ID
 */
export function getStepIndex(stepId: ProjectStepId, flow: ProjectWizardMode): number {
  return FLOW_STEP_ORDER[flow].indexOf(stepId)
}

/**
 * Get step ID by index
 */
export function getStepIdByIndex(
  index: number,
  flow: ProjectWizardMode
): ProjectStepId | null {
  return FLOW_STEP_ORDER[flow][index] ?? null
}

/**
 * Get the next step ID after the current one
 */
export function getNextStepId(
  currentStepId: ProjectStepId,
  flow: ProjectWizardMode
): ProjectStepId | null {
  const currentIndex = getStepIndex(currentStepId, flow)
  return getStepIdByIndex(currentIndex + 1, flow)
}

/**
 * Get the previous step ID before the current one
 */
export function getPreviousStepId(
  currentStepId: ProjectStepId,
  flow: ProjectWizardMode
): ProjectStepId | null {
  const currentIndex = getStepIndex(currentStepId, flow)
  if (currentIndex <= 0) return null
  return getStepIdByIndex(currentIndex - 1, flow)
}
