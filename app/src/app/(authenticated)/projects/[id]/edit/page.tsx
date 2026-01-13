import { notFound } from 'next/navigation'
import { getProjectById } from '@/lib/projects/queries'
import { getProjectSettings } from '@/lib/supabase/issues'
import { ProjectWizard } from '@/components/projects/project-wizard'
import type { ProjectWizardFormData, KnowledgeSourceInput } from '@/components/projects/shared/wizard/steps'
import { createClient } from '@/lib/supabase/server'
import type { KnowledgeSourceType, KnowledgeSourceWithCodebase } from '@/lib/knowledge/types'

interface EditProjectPageParams {
  id: string
}

export default async function EditProjectPage({
  params,
}: {
  params: Promise<EditProjectPageParams>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [project, settings, knowledgeSourcesResult] = await Promise.all([
    getProjectById(id),
    getProjectSettings(id),
    supabase
      .from('knowledge_sources')
      .select('*, source_code:source_codes(*)')
      .eq('project_id', id),
  ])

  const knowledgeSources = (knowledgeSourcesResult.data ?? []) as KnowledgeSourceWithCodebase[]
  const codebaseKnowledgeSource = knowledgeSources.find((ks) => ks.type === 'codebase')
  const sourceCode = codebaseKnowledgeSource?.source_code ?? null

  // Map non-codebase sources to form data format
  const otherKnowledgeSources: KnowledgeSourceInput[] = knowledgeSources
    .filter((ks) => ks.type !== 'codebase')
    .map((ks) => ({
      id: ks.id,
      type: ks.type as KnowledgeSourceType,
      url: ks.url ?? undefined,
      content: ks.content ?? undefined,
    }))

  if (!project) {
    notFound()
  }

  // Convert project data to wizard form data format
  const initialData: Partial<ProjectWizardFormData> = {
    // Project details
    name: project.name,
    description: project.description ?? '',

    // Codebase - source_code is now accessed through knowledge_sources
    codebase: {
      source: sourceCode?.kind === 'github' ? 'github' : 'none',
      repositoryUrl: sourceCode?.repository_url ?? undefined,
      repositoryBranch: sourceCode?.repository_branch ?? undefined,
      fullName: sourceCode?.repository_url
        ? extractGitHubFullName(sourceCode.repository_url)
        : undefined,
      analysisScope: codebaseKnowledgeSource?.analysis_scope ?? undefined,
    },
    knowledgeSources: otherKnowledgeSources,
    skipKnowledgeAnalysis: false,

    // Widget settings
    widget: {
      variant: settings?.widget_variant ?? 'popup',
      theme: settings?.widget_theme ?? 'light',
      position: settings?.widget_position ?? 'bottom-right',
      title: settings?.widget_title ?? 'Support',
      initialMessage: settings?.widget_initial_message ?? 'Hi! How can I help you today?',
      allowedOrigins: settings?.allowed_origins ?? [],
      tokenRequired: settings?.widget_token_required ?? false,
      idleTimeoutMinutes: settings?.session_idle_timeout_minutes ?? 5,
      goodbyeDelaySeconds: settings?.session_goodbye_delay_seconds ?? 90,
      idleResponseTimeoutSeconds: settings?.session_idle_response_timeout_seconds ?? 60,
    },
    slack: {
      connected: false, // Will be fetched client-side
    },

    // Issue settings
    issues: {
      trackingEnabled: settings?.issue_tracking_enabled ?? true,
      specThreshold: settings?.issue_spec_threshold ?? 3,
      specGuidelines: settings?.spec_guidelines ?? null,
      autoSessionTracking: false, // Default
    },
  }

  return (
    <ProjectWizard
      mode="edit"
      projectId={id}
      initialData={initialData}
    />
  )
}

/**
 * Extract GitHub full name (owner/repo) from repository URL
 */
function extractGitHubFullName(url: string): string | undefined {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/)
  return match?.[1]?.replace(/\.git$/, '')
}
