import { notFound } from 'next/navigation'
import { ProjectAnalysisProgress } from '@/components/analysis/project-analysis-progress'
import { getProjectById } from '@/lib/supabase/projects'

interface AnalysisProgressPageProps {
  params: { id: string }
}

export default async function AnalysisProgressPage({ params }: AnalysisProgressPageProps) {
  const project = await getProjectById(params.id)

  if (!project) {
    notFound()
  }

  return <ProjectAnalysisProgress projectId={params.id} initialProject={project} />
}

